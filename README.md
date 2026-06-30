# CESIZen

Application de suivi émotionnel — React + PHP.

---

## Statut CI/CD

| Pipeline | Qualité |
|---|---|
| [![CI Pipeline](https://github.com/Lamikad0v2/CESIZen/actions/workflows/ci.yml/badge.svg)](https://github.com/Lamikad0v2/CESIZen/actions/workflows/ci.yml) | [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Lamikad0v2_CESIZen&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Lamikad0v2_CESIZen) |
| | [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Lamikad0v2_CESIZen&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Lamikad0v2_CESIZen) |

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

## Installation locale

```bash
# Cloner le dépôt
git clone https://github.com/Lamikad0v2/CESIZen.git

# Backend
cd backend && composer install

# Frontend
cd frontend && npm install

# Lancer les tests
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
