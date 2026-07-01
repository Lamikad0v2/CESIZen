# =============================================================
# deploy-blue-green.ps1 -- Deploiement Blue/Green (TP5)
# Compatible PowerShell 5.1 (pas de ??, pas de &&, pas de here-string)
#
# Usage normal   : & .\deploy-blue-green.ps1 [-ImageTag <tag>]
# Rollback rapide: & .\deploy-blue-green.ps1 -Rollback
# =============================================================

param(
    [string]$ImageTag = "",
    [switch]$Rollback
)

$ErrorActionPreference = "Stop"

# Compatibilite PS 5.1 : pas d'operateur ??
if (-not $ImageTag) {
    if ($env:DEPLOY_TAG) {
        $ImageTag = $env:DEPLOY_TAG
    } else {
        $ImageTag = "latest"
    }
}

# ── Chemins ─────────────────────────────────────────────────────
$ProjectDir    = "C:\laragon\www\emotionalTracker"
$StateDir      = "C:\cesizen-state"
$StateFile     = Join-Path $StateDir "active_slot.txt"
$DynamicConf   = Join-Path $ProjectDir "docker\traefik\dynamic.yml"
$MigrationFile = Join-Path $ProjectDir "database\migrations\V1__initial_schema.sql"

Set-Location $ProjectDir

# ── Validation prealable ─────────────────────────────────────────
if (-not (Test-Path $MigrationFile)) {
    Write-Error "Migration introuvable : $MigrationFile"
    exit 1
}
if (-not (Test-Path ".env")) {
    Write-Error ".env introuvable dans $ProjectDir"
    exit 1
}

# ── Lecture des secrets depuis .env ─────────────────────────────
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

# ── Determiner les slots ──────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
if (-not (Test-Path $StateFile)) {
    Set-Content $StateFile "blue"
}

$currentSlot = (Get-Content $StateFile).Trim()
if ($currentSlot -eq "blue") {
    $newSlot = "green"
} else {
    $newSlot = "blue"
}

# ── Ecrire dynamic.yml pour Traefik ──────────────────────────────
# Construit le YAML sans here-string pour eviter les problemes PS 5.1
# Le backtick ([char]96) est requis par la syntaxe de regle Traefik
function Write-TraefikConfig {
    param(
        [string]$Slot,
        [string]$ConfPath
    )
    $bt  = [char]96
    $q   = [char]34
    $rule = "PathPrefix(" + $bt + "/" + $bt + ")"
    $url  = "http://app-" + $Slot + ":8080"

    $yaml  = "# dynamic.yml -- gere par deploy-blue-green.ps1" + [Environment]::NewLine
    $yaml += "# Slot actif : " + $Slot + [Environment]::NewLine
    $yaml += "" + [Environment]::NewLine
    $yaml += "http:" + [Environment]::NewLine
    $yaml += "  routers:" + [Environment]::NewLine
    $yaml += "    cesizen:" + [Environment]::NewLine
    $yaml += "      entryPoints:" + [Environment]::NewLine
    $yaml += "        - web" + [Environment]::NewLine
    $yaml += "      rule: " + $q + $rule + $q + [Environment]::NewLine
    $yaml += "      service: cesizen-active" + [Environment]::NewLine
    $yaml += "" + [Environment]::NewLine
    $yaml += "  services:" + [Environment]::NewLine
    $yaml += "    cesizen-active:" + [Environment]::NewLine
    $yaml += "      loadBalancer:" + [Environment]::NewLine
    $yaml += "        servers:" + [Environment]::NewLine
    $yaml += "          - url: " + $q + $url + $q + [Environment]::NewLine

    Set-Content -Path $ConfPath -Value $yaml -Encoding UTF8
    Write-Host ("  dynamic.yml -> slot " + $Slot) -ForegroundColor Green

    # Sur Windows Docker Desktop, inotify ne propage pas les changements
    # de fichiers NTFS vers les conteneurs Linux. On force le rechargement
    # en redemarrant Traefik (demarrage < 1s, coupure negligeable).
    Write-Host "  Redemarrage Traefik pour prise en compte du nouveau slot..." -ForegroundColor Green
    docker restart cesizen-proxy | Out-Null
    Start-Sleep -Seconds 3
    Write-Host "  Traefik actif sur le slot : $Slot" -ForegroundColor Green
}

# ── Verifier qu'un conteneur tourne ──────────────────────────────
function Test-ContainerRunning {
    param([string]$Name)
    $state = docker inspect --format '{{.State.Running}}' $Name 2>$null
    return ($state -eq "true")
}

# ═══════════════════════════════════════════════════════════════
# MODE ROLLBACK
# ═══════════════════════════════════════════════════════════════
if ($Rollback) {
    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Red
    Write-Host (" ROLLBACK : " + $currentSlot + " -> " + $newSlot) -ForegroundColor Red
    Write-Host " (mise a jour dynamic.yml uniquement, pas de migration)" -ForegroundColor Red
    Write-Host "=====================================================" -ForegroundColor Red

    if (-not (Test-ContainerRunning -Name ("cesizen-app-" + $newSlot))) {
        Write-Error ("Slot " + $newSlot + " non demarre -- rollback impossible.")
        exit 1
    }

    Write-TraefikConfig -Slot $newSlot -ConfPath $DynamicConf
    Set-Content $StateFile $newSlot

    Write-Host ""
    Write-Host (" Rollback vers " + $newSlot + " effectue.") -ForegroundColor Green
    Write-Host " Application : http://localhost"              -ForegroundColor Green
    Write-Host " Dashboard   : http://localhost:8080/dashboard/" -ForegroundColor Green
    exit 0
}

# ═══════════════════════════════════════════════════════════════
# DEPLOIEMENT NORMAL
# ═══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host (" Blue/Green Deploy : " + $currentSlot + " -> " + $newSlot) -ForegroundColor Cyan
Write-Host (" Image tag : " + $ImageTag) -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# ── [1/6] Pull de l'image sur le nouveau slot ────────────────────
Write-Host ""
Write-Host ("=== [1/6] Pull de l'image pour app-" + $newSlot + " ===") -ForegroundColor Yellow
if ($newSlot -eq "blue") {
    $env:BLUE_TAG  = $ImageTag
    $env:GREEN_TAG = "latest"
} else {
    $env:GREEN_TAG = $ImageTag
    $env:BLUE_TAG  = "latest"
}
docker compose pull ("app-" + $newSlot)
if ($LASTEXITCODE -ne 0) {
    Write-Error "docker compose pull a echoue"
    exit 1
}

# ── [2/6] S'assurer que la DB est active ─────────────────────────
Write-Host ""
Write-Host "=== [2/6] Demarrage de la base de donnees ===" -ForegroundColor Yellow
docker compose up -d db
if ($LASTEXITCODE -ne 0) {
    Write-Error "Impossible de demarrer db"
    exit 1
}

# ── [3/6] Attente du healthcheck MySQL ───────────────────────────
Write-Host ""
Write-Host "=== [3/6] Attente du healthcheck MySQL ===" -ForegroundColor Yellow
$maxWait = 60
$waited  = 0
$dbId    = ""
while ($waited -lt $maxWait) {
    $dbId = docker compose ps -q db 2>$null
    if ($dbId) {
        $health = docker inspect --format '{{.State.Health.Status}}' $dbId 2>$null
        if ($health -eq "healthy") {
            Write-Host ("  Base de donnees prete (" + $waited + "s).") -ForegroundColor Green
            break
        }
    }
    Write-Host ("  Attente... " + $waited + "s / " + $maxWait + "s")
    Start-Sleep -Seconds 2
    $waited += 2
}
if ($waited -ge $maxWait) {
    Write-Error ("Timeout : MySQL non disponible apres " + $maxWait + "s")
    exit 1
}

# ── [4/6] Migration expand (idempotente, retro-compatible) ───────
Write-Host ""
Write-Host "=== [4/6] Migration expand ===" -ForegroundColor Yellow
Write-Host ("  Fichier : " + $MigrationFile)
Get-Content $MigrationFile | docker exec -i $dbId mysql -u cesizen ("-p" + $DB_PASS) cesizen
if ($LASTEXITCODE -ne 0) {
    Write-Error "La migration a echoue"
    exit 1
}
Write-Host "  Migration OK." -ForegroundColor Green

# ── [5/6] Demarrer le nouveau slot ───────────────────────────────
Write-Host ""
Write-Host ("=== [5/6] Demarrage du slot app-" + $newSlot + " ===") -ForegroundColor Yellow
docker compose up -d --no-deps ("app-" + $newSlot)
if ($LASTEXITCODE -ne 0) {
    Write-Error ("Demarrage de app-" + $newSlot + " echoue")
    exit 1
}

$maxWait = 30
$waited  = 0
while ($waited -lt $maxWait) {
    if (Test-ContainerRunning -Name ("cesizen-app-" + $newSlot)) {
        Write-Host ("  Slot app-" + $newSlot + " demarre (" + $waited + "s).") -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 2
    $waited += 2
}
if ($waited -ge $maxWait) {
    Write-Error ("app-" + $newSlot + " n'a pas demarre apres " + $maxWait + "s")
    exit 1
}

# ── [6/6] Bascule Traefik (rechargement automatique) ─────────────
Write-Host ""
Write-Host ("=== [6/6] Bascule Traefik : " + $currentSlot + " -> " + $newSlot + " ===") -ForegroundColor Yellow
Write-TraefikConfig -Slot $newSlot -ConfPath $DynamicConf
Set-Content $StateFile $newSlot

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Deploiement blue/green termine avec succes !"        -ForegroundColor Green
Write-Host (" Slot precedent : " + $currentSlot + " (disponible pour rollback)") -ForegroundColor Green
Write-Host (" Slot actif     : " + $newSlot)                      -ForegroundColor Green
Write-Host " Application    : http://localhost"                    -ForegroundColor Green
Write-Host " Dashboard      : http://localhost:8080/dashboard/"   -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Rollback : .\deploy-blue-green.ps1 -Rollback"        -ForegroundColor DarkYellow
