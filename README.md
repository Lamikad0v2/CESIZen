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

## Pipeline CI (GitHub Actions — runner local)

Le pipeline s'exécute sur un **runner auto-hébergé** (self-hosted) à chaque `push` et `pull_request` vers `main`.

### Étapes

```
1. Checkout (fetch-depth: 0 pour SonarCloud)
2. PHP 8.1 + Composer install
3. PHPUnit — tests backend
4. Node.js 20 + npm ci
5. ESLint — lint frontend
6. Vitest — tests unitaires + couverture (lcov)
7. Vite build — build production
8. SonarCloud Scan — analyse qualité
```

### Déclencheurs

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

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

## Conditions d'exécution du pipeline CI

| Déclencheur | Étapes exécutées |
|---|---|
| `push` sur `main` | Tests PHP + Tests React + Lint + SonarCloud + **Build Docker + Push GHCR** |
| `pull_request` vers `main` | Tests PHP + Tests React + Lint + SonarCloud + **Build Docker** (sans push) |

Le pipeline tourne sur un **runner self-hosted** (machine locale). Le push Docker n'a lieu que sur `push` direct vers `main` (merge de PR).

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
