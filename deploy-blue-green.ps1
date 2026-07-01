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
#   - Bascule Traefik via dynamic.yml (rechargement automatique)
#   - Met à jour le fichier d'état
# =============================================================

param(
    [string]$ImageTag = "",
    [switch]$Rollback
)

$ErrorActionPreference = "Stop"

# Compatibilité PowerShell 5.1 — pas de ?? ni de &&
if (-not $ImageTag) {
    if ($env:DEPLOY_TAG) { $ImageTag = $env:DEPLOY_TAG } else { $ImageTag = "latest" }
}

# ── Chemins ─────────────────────────────────────────────────────
$ProjectDir    = "C:\laragon\www\emotionalTracker"
$StateDir      = "C:\cesizen-state"
$StateFile     = Join-Path $StateDir "active_slot.txt"
$DynamicConf   = Join-Path $ProjectDir "docker\traefik\dynamic.yml"
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
if ($currentSlot -eq "blue") { $newSlot = "green" } else { $newSlot = "blue" }

# ── Fonction : écrire dynamic.yml → Traefik recharge tout seul ───
function Switch-TraefikToSlot {
    param([string]$Slot)

    # Remarque : dans un here-string PS, `` (double backtick) = backtick littéral
    # Le backtick est requis par la syntaxe de règle Traefik : PathPrefix(`/`)
    $content = @"
# dynamic.yml -- géré par deploy-blue-green.ps1
# Slot actif : $Slot

http:
  routers:
    cesizen:
      entryPoints:
        - web
      rule: "PathPrefix(``/``)"
      service: cesizen-active

  services:
    cesizen-active:
      loadBalancer:
        servers:
          - url: "http://app-${Slot}:8080"
"@
    Set-Content -Path $DynamicConf -Value $content -Encoding UTF8
    Write-Host "  dynamic.yml mis a jour (slot: $Slot)" -ForegroundColor Green
    Write-Host "  Traefik recharge automatiquement la configuration..." -ForegroundColor Green
    Start-Sleep -Seconds 2
}

# ══════════════════════════════════════════════════════════════
# MODE ROLLBACK — bascule Traefik sans redéployer ni migrer
# ══════════════════════════════════════════════════════════════
if ($Rollback) {
    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Red
    Write-Host " ROLLBACK : $currentSlot -> $newSlot"                  -ForegroundColor Red
    Write-Host " (mise a jour dynamic.yml uniquement, pas de migration)" -ForegroundColor Red
    Write-Host "=====================================================" -ForegroundColor Red

    $state = docker inspect --format="{{.State.Running}}" "cesizen-app-$newSlot" 2>$null
    if ($state -ne "true") {
        Write-Error "Slot $newSlot non demarre — rollback impossible sans conteneur actif."
        exit 1
    }

    Switch-TraefikToSlot -Slot $newSlot
    Set-Content $StateFile $newSlot

    Write-Host ""
    Write-Host " Rollback vers $newSlot effectue."  -ForegroundColor Green
    Write-Host " Application    : http://localhost"  -ForegroundColor Green
    Write-Host " Dashboard      : http://localhost:8080/dashboard/" -ForegroundColor Green
    exit 0
}

# ══════════════════════════════════════════════════════════════
# DÉPLOIEMENT NORMAL
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host " Blue/Green Deploy : $currentSlot -> $newSlot"         -ForegroundColor Cyan
Write-Host " Image tag : $ImageTag"                                 -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# ── [1/6] Pull de l'image sur le nouveau slot ────────────────────
Write-Host ""
Write-Host "=== [1/6] Pull de l'image pour app-$newSlot ===" -ForegroundColor Yellow

if ($newSlot -eq "blue") { $env:BLUE_TAG = $ImageTag; $env:GREEN_TAG = "latest" }
else                      { $env:GREEN_TAG = $ImageTag; $env:BLUE_TAG = "latest" }

docker compose pull "app-$newSlot"
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose pull a echoue"; exit 1 }

# ── [2/6] S'assurer que la DB est active ─────────────────────────
Write-Host ""
Write-Host "=== [2/6] Demarrage de la base de donnees ===" -ForegroundColor Yellow
docker compose up -d db
if ($LASTEXITCODE -ne 0) { Write-Error "Impossible de demarrer db"; exit 1 }

# ── [3/6] Attente du healthcheck MySQL ───────────────────────────
Write-Host ""
Write-Host "=== [3/6] Attente du healthcheck MySQL ===" -ForegroundColor Yellow
$maxWait = 60; $waited = 0; $dbId = ""
while ($waited -lt $maxWait) {
    $dbId = docker compose ps -q db 2>$null
    if ($dbId) {
        $health = docker inspect --format="{{.State.Health.Status}}" $dbId 2>$null
        if ($health -eq "healthy") {
            Write-Host "  Base de donnees prete (${waited}s)." -ForegroundColor Green
            break
        }
    }
    Write-Host "  Attente... ${waited}s / ${maxWait}s"
    Start-Sleep -Seconds 2
    $waited += 2
}
if ($waited -ge $maxWait) { Write-Error "Timeout : MySQL non disponible apres ${maxWait}s"; exit 1 }

# ── [4/6] Migration expand (idempotente, rétro-compatible) ───────
Write-Host ""
Write-Host "=== [4/6] Migration expand ===" -ForegroundColor Yellow
Write-Host "  Fichier : $MigrationFile"
Get-Content $MigrationFile | docker exec -i $dbId mysql -u cesizen -p"$DB_PASS" cesizen
if ($LASTEXITCODE -ne 0) { Write-Error "La migration a echoue"; exit 1 }
Write-Host "  Migration OK." -ForegroundColor Green

# ── [5/6] Démarrer le nouveau slot ───────────────────────────────
Write-Host ""
Write-Host "=== [5/6] Demarrage du slot app-$newSlot ===" -ForegroundColor Yellow
docker compose up -d --no-deps "app-$newSlot"
if ($LASTEXITCODE -ne 0) { Write-Error "Demarrage de app-$newSlot echoue"; exit 1 }

$maxWait = 30; $waited = 0
while ($waited -lt $maxWait) {
    $state = docker inspect --format="{{.State.Running}}" "cesizen-app-$newSlot" 2>$null
    if ($state -eq "true") {
        Write-Host "  Slot app-$newSlot demarre (${waited}s)." -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 2
    $waited += 2
}
if ($waited -ge $maxWait) { Write-Error "app-$newSlot n'a pas demarre apres ${maxWait}s"; exit 1 }

# ── [6/6] Bascule Traefik (rechargement automatique dynamic.yml) ─
Write-Host ""
Write-Host "=== [6/6] Bascule Traefik : $currentSlot -> $newSlot ===" -ForegroundColor Yellow
Switch-TraefikToSlot -Slot $newSlot
Set-Content $StateFile $newSlot

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Deploiement blue/green termine avec succes !"        -ForegroundColor Green
Write-Host " Slot precedent : $currentSlot (disponible pour rollback)" -ForegroundColor Green
Write-Host " Slot actif     : $newSlot"                           -ForegroundColor Green
Write-Host " Application    : http://localhost"                    -ForegroundColor Green
Write-Host " Dashboard      : http://localhost:8080/dashboard/"   -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Rollback : .\deploy-blue-green.ps1 -Rollback"        -ForegroundColor DarkYellow
