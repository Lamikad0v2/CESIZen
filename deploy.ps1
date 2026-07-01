# =============================================================
# deploy.ps1 — Script de déploiement automatisé CESIZen
#
# Appelé par le pipeline CI après le push de l'image Docker.
# Exécution : & .\deploy.ps1
#
# Ordre des opérations (safe-deploy) :
#   1. Pull de la nouvelle image depuis GHCR
#   2. Démarrage de la base de données (si arrêtée)
#   3. Attente du healthcheck MySQL
#   4. Application idempotente de la migration V1
#   5. Redémarrage de l'app (sans toucher au volume BDD)
# =============================================================

$ErrorActionPreference = "Stop"

$ProjectDir   = "C:\laragon\www\emotionalTracker"
$MigrationFile = Join-Path $PSScriptRoot "database\migrations\V1__initial_schema.sql"

# ── Validation préalable ──────────────────────────────────────
if (-not (Test-Path $MigrationFile)) {
    Write-Error "Migration introuvable : $MigrationFile"
    exit 1
}

Set-Location $ProjectDir

# ── Lecture des secrets depuis .env ──────────────────────────
if (-not (Test-Path ".env")) {
    Write-Error ".env introuvable dans $ProjectDir. Crée-le depuis .env.example."
    exit 1
}
$secrets = @{}
Get-Content ".env" | Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $secrets[$parts[0].Trim()] = $parts[1].Trim()
}
$DB_PASS = $secrets['DB_PASS']
if (-not $DB_PASS) {
    Write-Error "DB_PASS manquant dans .env"
    exit 1
}

# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [1/5] Pull de la nouvelle image ===" -ForegroundColor Cyan
docker compose pull app
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose pull a echoue"; exit 1 }

# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [2/5] Demarrage de la base de donnees ===" -ForegroundColor Cyan
docker compose up -d db
if ($LASTEXITCODE -ne 0) { Write-Error "Impossible de demarrer le conteneur db"; exit 1 }

# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [3/5] Attente du healthcheck MySQL ===" -ForegroundColor Cyan
$maxWait = 60
$waited  = 0
$dbId    = ""
while ($waited -lt $maxWait) {
    $dbId   = docker compose ps -q db 2>$null
    if ($dbId) {
        $health = docker inspect --format='{{.State.Health.Status}}' $dbId 2>$null
        if ($health -eq "healthy") {
            Write-Host "  Base de donnees prete ($waited s)." -ForegroundColor Green
            break
        }
    }
    Write-Host "  Attente... ${waited}s / ${maxWait}s"
    Start-Sleep -Seconds 2
    $waited += 2
}
if ($waited -ge $maxWait) {
    Write-Error "Timeout : la base de donnees n'est pas disponible apres ${maxWait}s"
    exit 1
}

# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [4/5] Application de la migration V1 (idempotente) ===" -ForegroundColor Cyan
Write-Host "  Fichier : $MigrationFile"
Get-Content $MigrationFile | docker exec -i $dbId mysql -u cesizen -p"$DB_PASS" cesizen
if ($LASTEXITCODE -ne 0) { Write-Error "La migration a echoue"; exit 1 }
Write-Host "  Migration appliquee avec succes." -ForegroundColor Green

# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [5/5] Redemarrage de l'application ===" -ForegroundColor Cyan
docker compose up -d --no-deps --no-build app
if ($LASTEXITCODE -ne 0) { Write-Error "Impossible de redemarrer l'application"; exit 1 }

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " Deploiement termine avec succes !"          -ForegroundColor Green
Write-Host " Application disponible : http://localhost:8080" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
