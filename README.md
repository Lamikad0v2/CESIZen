# CESIZen

Application de suivi émotionnel — React + PHP.

---

## Statut CI/CD

| Pipeline | Qualité | Image Docker |
|---|---|---|
| [![CI Pipeline](https://github.com/Lamikad0v2/CESIZen/actions/workflows/ci.yml/badge.svg)](https://github.com/Lamikad0v2/CESIZen/actions/workflows/ci.yml) | [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Lamikad0v2_CESIZen&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Lamikad0v2_CESIZen) | `ghcr.io/lamikad0v2/cesizen:latest` |
| | [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Lamikad0v2_CESIZen&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Lamikad0v2_CESIZen) | [GitHub Container Registry](https://github.com/Lamikad0v2/CESIZen/pkgs/container/cesizen) |

---

## Stratégie Git (GitFlow simplifié)

Ce dépôt suit un **GitFlow simplifié** adapté à un projet académique :

```
main ──────────────────────────────────────────────────► production
  ↑ merge PR (CI verte + Quality Gate)
develop ──────────────────────────────────────────────► intégration
  ↑ merge PR
feature/<sujet> ──────────────────────────────────────► développement
```

### Branches

| Branche | Rôle | Protection |
|---|---|---|
| `main` | Version stable, déployable | Push direct interdit, CI + Quality Gate requis |
| `develop` | Intégration — toutes les features passent ici | Push direct interdit, PR requise |
| `feature/<sujet>` | Développement d'une fonctionnalité isolée | Aucune |
| `fix/<sujet>` | Correction ciblée depuis `develop` | Aucune |
| `hotfix/<sujet>` | Correction urgente depuis `main` | Aucune |

### Workflow type

1. Créer une branche `feature/ma-feature` depuis `develop`
2. Développer et committer (convention Conventional Commits)
3. Ouvrir une Pull Request vers `develop`
4. Le pipeline CI s'exécute automatiquement
5. Après validation : merge vers `develop`
6. Quand `develop` est stable : PR vers `main` (Quality Gate verte obligatoire)

---

## Convention de commits (Conventional Commits)

Format : `type(scope): message court`

| Type | Usage |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `chore` | Maintenance, dépendances |
| `docs` | Documentation uniquement |
| `ci` | Changements CI/CD |
| `test` | Tests uniquement |
| `refactor` | Refactorisation sans bug fix ni feature |

**Enforced par commitlint** (hook `commit-msg` via Husky).

---

## Pipeline CI/CD (GitHub Actions — runner local)

Le pipeline est composé de **deux stages distincts** qui s'enchaînent automatiquement.

### Stage 1 — CI : Build, Test & SonarCloud

S'exécute à chaque `push` et `pull_request` vers `main`.

```
1. Checkout (fetch-depth: 0 pour SonarCloud)
2. PHP 8.1 + Composer install
3. PHPUnit — tests backend
4. Node.js 20 + npm ci
5. ESLint — lint frontend
6. Vitest — tests unitaires + couverture (lcov)
7. Vite build — build production
8. SonarCloud Scan — analyse qualité
9. Docker build + push vers GHCR (push main uniquement)
```

### Stage 2 — CD : Deploy (migration + redémarrage)

S'exécute **uniquement sur `push` vers `main`**, après que le stage CI est passé (`needs: ci`).

```
1. Pull de la nouvelle image Docker depuis GHCR
2. Démarrage du conteneur base de données (si arrêté)
3. Attente du healthcheck MySQL (max 60 s)
4. Application de la migration V1 (idempotente)
5. Redémarrage de l'application (sans toucher au volume BDD)
```

**Condition d'activation :**

```yaml
if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

Le stage CD ne se déclenche **jamais** sur une pull request — uniquement quand un merge vers `main` est effectué.

### Déclencheurs résumés

| Déclencheur | CI | CD |
|---|---|---|
| `push` sur `main` | ✅ | ✅ |
| `pull_request` vers `main` | ✅ | ❌ |

---

## Migrations de base de données

Le fichier [`database/migrations/V1__initial_schema.sql`](database/migrations/V1__initial_schema.sql) est l'artefact de migration produit en TP2 et appliqué automatiquement par le pipeline CD en TP4.

### Garanties d'idempotence

- Chaque table utilise `CREATE TABLE IF NOT EXISTS` — aucune erreur si la table existe déjà.
- Pas de `DROP`, pas de `TRUNCATE`, pas de `CREATE DATABASE` : les données existantes ne sont jamais détruites.
- Le script peut être rejoué un nombre illimité de fois sans effet de bord.

### Ordre d'application (safe-deploy)

```
migration V1 → redémarrage app
```

La migration est toujours appliquée **avant** le redémarrage de l'application. Cela évite qu'une nouvelle version du code tourne sur un schéma obsolète.

### Déploiement local automatisé

Le script [`deploy.ps1`](deploy.ps1) (PowerShell) reproduit le comportement du pipeline CD en local :

```powershell
# Depuis la racine du dépôt
.\deploy.ps1
```

Pré-requis : Docker Desktop démarré, fichier `.env` présent avec `DB_PASS`.

---

## SonarCloud

- **Organisation** : `lamikad0v2`
- **Projet** : `Lamikad0v2_CESIZen`
- **URL** : https://sonarcloud.io/project/overview?id=Lamikad0v2_CESIZen
- Sources analysées : `frontend/src`, `backend/core`, `backend/Models`, `backend/Controllers`

---

## Lancer avec Docker Compose

> Pré-requis : Docker Desktop installé et démarré.

```bash
# 1. Cloner le dépôt
git clone https://github.com/Lamikad0v2/CESIZen.git
cd CESIZen

# 2. Créer le fichier de secrets (jamais commité)
cp .env.example .env
# Éditer .env et renseigner DB_PASS et MYSQL_ROOT_PASSWORD

# 3. Lancer l'application (build + démarrage en une commande)
docker compose up --build

# L'application est disponible sur http://localhost:8080
```

Pour arrêter :
```bash
docker compose down          # arrêter les conteneurs
docker compose down -v       # arrêter + supprimer les volumes (reset BDD)
```

Pour récupérer la dernière image depuis GHCR sans rebuild :
```bash
docker pull ghcr.io/lamikad0v2/cesizen:latest
```

---

## Conditions d'exécution du pipeline CI/CD

| Déclencheur | Stage CI | Stage CD |
|---|---|---|
| `push` sur `main` | Tests + SonarCloud + **Build Docker + Push GHCR** | **Migration + Redémarrage app** |
| `pull_request` vers `main` | Tests + SonarCloud + **Build Docker** (sans push) | — |

Le pipeline tourne sur un **runner self-hosted** (machine locale). Le stage CD est conditionnel : il ne s'exécute qu'après un merge effectif vers `main`.

---

## Installation locale (sans Docker)

```bash
# Backend
cd backend && composer install

# Frontend
cd frontend && npm install

# Tests
cd backend && ./vendor/bin/phpunit
cd frontend && npm run test
cd frontend && npm run test:coverage  # avec rapport lcov
```

---

## Stack technique

- **Frontend** : React 19, Vite, TailwindCSS, React Router
- **Backend** : PHP 8.1, architecture MVC
- **Tests** : Vitest (unit), PHPUnit 11, Playwright (e2e)
- **Qualité** : ESLint, Husky, commitlint, SonarCloud
- **CI/CD** : GitHub Actions (runner self-hosted)
