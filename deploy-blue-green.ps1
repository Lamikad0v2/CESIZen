# =============================================================
# deploy-blue-green.ps1 — Déploiement Blue/Green (TP5)
#
# Usage normal   : & .\deploy-blue-green.ps1 [-ImageTag <tag>]
# Rollback rapide: & .\deploy-blue-green.ps1 -Rollback
#
# Logique :
#   - Lit le slot actif dans C:\cesizen-state\active_slot.txt
#   - Déploie la nouvelle image sur le slot INACTIF
#   - Applique la migration expand (idempotente, rétro-compatible)
#   - Bascule Nginx par rechargement gracieux (nginx -s reload)
#   - Met à jour le fichier d'état
# =============================================================

param(
    [string]$ImageTag = ($env:DEPLOY_TAG ?? "latest"),
    [switch]$Rollback
)

$ErrorActionPreference = "Stop"

# ── Chemins ─────────────────────────────────────────────────────
$ProjectDir    = "C:\laragon\www\emotionalTracker"
$StateDir      = "C:\cesizen-state"
$StateFile     = Join-Path $StateDir "active_slot.txt"
$UpstreamConf  = Join-Path $ProjectDir "docker\nginx\upstream.conf"
$MigrationFile = Join-Path $ProjectDir "database\migrations\V1__initial_schema.sql"

Set-Location $ProjectDir

# ── Validation préalable ─────────────────────────────────────────
if (-not (Test-Path $MigrationFile)) {
    Write-Error "Migration introuvable : $MigrationFile"; exit 1
}
if (-not (Test-Path ".env")) {
    Write-Error ".env introuvable dans $ProjectDir"; exit 1
}

# ── Lecture des secrets depuis .env ─────────────────────────────
$secrets = @{}
Get-Content ".env" | Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $secrets[$parts[0].Trim()] = $parts[1].Trim()
}
$DB_PASS = $secrets['DB_PASS']
if (-not $DB_PASS) { Write-Error "DB_PASS manquant dans .env"; exit 1 }

# ── Déterminer les slots ──────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
if (-not (Test-Path $StateFile)) { Set-Content $StateFile "blue" }

$currentSlot = (Get-Content $StateFile).Trim()
$newSlot     = if ($currentSlot -eq "blue") { "green" } else { "blue" }

# ── Fonction : écrire upstream.conf + recharger Nginx ────────────
function Switch-NginxToSlot {
    param([string]$Slot)

    $content = @"
# upstream.conf — géré par deploy-blue-green.ps1
# Slot actif : $Slot — ne pas modifier manuellement.

upstream cesizen_active {
    server app-${Slot}:8080;
}

server {
    listen 80;
    server_name localhost;

    add_header X-Active-Slot "$Slot" always;

    location / {
        proxy_pass            http://cesizen_active;
        proxy_http_version    1.1;
        proxy_set_header      Host              `$host;
        proxy_set_header      X-Real-IP         `$remote_addr;
        proxy_set_header      X-Forwarded-For   `$proxy_add_x_forwarded_for;
        proxy_set_header      X-Forwarded-Proto `$scheme;
        proxy_read_timeout    60s;
        proxy_connect_timeout 10s;
    }
}
"@
    Set-Content -Path $UpstreamConf -Value $content -Encoding UTF8

    docker exec cesizen-proxy nginx -s reload
    if ($LASTEXITCODE -ne 0) { Write-Error "nginx -s reload a échoué"; exit 1 }
}

# ══════════════════════════════════════════════════════════════
# MODE ROLLBACK — bascule nginx sans redéployer ni migrer
# ══════════════════════════════════════════════════════════════
if ($Rollback) {
    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Red
    Write-Host " ROLLBACK : $currentSlot → $newSlot"                   -ForegroundColor Red
    Write-Host " (rechargement Nginx uniquement, aucune migration)"     -ForegroundColor Red
    Write-Host "=====================================================" -ForegroundColor Red

    $state = docker inspect --format='{{.State.Running}}' "cesizen-app-$newSlot" 2>$null
    if ($state -ne "true") {
        Write-Error "Slot $newSlot non démarré — impossible de rollback sans conteneur actif."
        exit 1
    }

    Switch-NginxToSlot -Slot $newSlot
    Set-Content $StateFile $newSlot

    Write-Host ""
    Write-Host " Rollback vers $newSlot effectué." -ForegroundColor Green
    Write-Host " Application : http://localhost"   -ForegroundColor Green
    exit 0
}

# ══════════════════════════════════════════════════════════════
# DÉPLOIEMENT NORMAL
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host " Blue/Green Deploy : $currentSlot → $newSlot"          -ForegroundColor Cyan
Write-Host " Image tag : $ImageTag"                                 -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# ── [1/6] Pull de l'image sur le nouveau slot ────────────────────
Write-Host ""
Write-Host "=== [1/6] Pull de l'image pour app-$newSlot ===" -ForegroundColor Yellow
$env:BLUE_TAG  = if ($newSlot -eq "blue")  { $ImageTag } else { "latest" }
$env:GREEN_TAG = if ($newSlot -eq "green") { $ImageTag } else { "latest" }

docker compose pull "app-$newSlot"
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose pull a échoué"; exit 1 }

# ── [2/6] S'assurer que la DB est active ─────────────────────────
Write-Host ""
Write-Host "=== [2/6] Démarrage de la base de données ===" -ForegroundColor Yellow
docker compose up -d db
if ($LASTEXITCODE -ne 0) { Write-Error "Impossible de démarrer db"; exit 1 }

# ── [3/6] Attente du healthcheck MySQL ───────────────────────────
Write-Host ""
Write-Host "=== [3/6] Attente du healthcheck MySQL ===" -ForegroundColor Yellow
$maxWait = 60; $waited = 0; $dbId = ""
while ($waited -lt $maxWait) {
    $dbId   = docker compose ps -q db 2>$null
    if ($dbId) {
        $health = docker inspect --format='{{.State.Health.Status}}' $dbId 2>$null
        if ($health -eq "healthy") {
            Write-Host "  Base de données prête (${waited}s)." -ForegroundColor Green
            break
        }
    }
    Write-Host "  Attente... ${waited}s / ${maxWait}s"
    Start-Sleep -Seconds 2; $waited += 2
}
if ($waited -ge $maxWait) { Write-Error "Timeout : MySQL non disponible après ${maxWait}s"; exit 1 }

# ── [4/6] Migration expand (idempotente, rétro-compatible) ───────
Write-Host ""
Write-Host "=== [4/6] Migration expand (idempotente) ===" -ForegroundColor Yellow
Write-Host "  Fichier : $MigrationFile"
Get-Content $MigrationFile | docker exec -i $dbId mysql -u cesizen -p"$DB_PASS" cesizen
if ($LASTEXITCODE -ne 0) { Write-Error "La migration a échoué"; exit 1 }
Write-Host "  Migration appliquée." -ForegroundColor Green

# ── [5/6] Démarrer le nouveau slot ───────────────────────────────
Write-Host ""
Write-Host "=== [5/6] Démarrage du slot app-$newSlot ===" -ForegroundColor Yellow
docker compose up -d --no-deps "app-$newSlot"
if ($LASTEXITCODE -ne 0) { Write-Error "Démarrage de app-$newSlot échoué"; exit 1 }

$maxWait = 30; $waited = 0
while ($waited -lt $maxWait) {
    $state = docker inspect --format='{{.State.Running}}' "cesizen-app-$newSlot" 2>$null
    if ($state -eq "true") {
        Write-Host "  Slot app-$newSlot en cours d'exécution (${waited}s)." -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 2; $waited += 2
}
if ($waited -ge $maxWait) { Write-Error "app-$newSlot n'a pas démarré après ${maxWait}s"; exit 1 }

# ── [6/6] Bascule Nginx (rechargement gracieux, zéro coupure) ────
Write-Host ""
Write-Host "=== [6/6] Bascule Nginx : $currentSlot → $newSlot ===" -ForegroundColor Yellow
Switch-NginxToSlot -Slot $newSlot
Set-Content $StateFile $newSlot
Write-Host "  Nginx rechargé — trafic basculé vers $newSlot." -ForegroundColor Green

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Déploiement blue/green terminé avec succès !"        -ForegroundColor Green
Write-Host " Slot précédent : $currentSlot (disponible pour rollback)" -ForegroundColor Green
Write-Host " Slot actif     : $newSlot"                           -ForegroundColor Green
Write-Host " Application    : http://localhost"                    -ForegroundColor Green
Write-Host " Diagnostic     : curl -I http://localhost | grep X-Active-Slot" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Rollback : .\deploy-blue-green.ps1 -Rollback"        -ForegroundColor DarkYellow
