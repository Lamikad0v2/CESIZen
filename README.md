# CESIZen

Application de suivi émotionnel — React + PHP.

---

## Règles Git (GitFlow)

Ce dépôt suit une organisation **GitFlow** simplifiée :

| Branche | Rôle |
|---|---|
| `main` | Version stable, déployable en production |
| `develop` | Branche d'intégration — toutes les features passent ici avant main |
| `feature/<sujet>` | Développement d'une fonctionnalité isolée depuis `develop` |
| `fix/<sujet>` | Correction ciblée sur `develop` |
| `hotfix/<sujet>` | Correction urgente depuis `main` (réintégrée dans `main` et `develop`) |

### Workflow type

```
main ──────────────────────────────────────────► production
        ↑ merge PR                ↑ merge PR
develop ──── feature/xxx ─────────────────────► intégration
```

---

## Convention de commits

Ce projet utilise **Conventional Commits** enforced par [commitlint](https://commitlint.js.org/).

Format : `type(scope): message court`

| Type | Quand l'utiliser |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `chore` | Maintenance, dépendances, config |
| `docs` | Documentation uniquement |
| `style` | Formatage (pas de logique changée) |
| `refactor` | Refactorisation sans bug fix ni feature |
| `test` | Ajout ou correction de tests |
| `ci` | Changements CI/CD |

**Exemples valides :**
```
feat(auth): add JWT refresh token logic
fix(dashboard): correct streak calculation on timezone change
chore: upgrade husky to v9
docs: update README with gitflow rules
```

**Exemples rejetés :**
```
update stuff          ← pas de type
WIP                   ← pas de type
Fixed the bug         ← pas de type, majuscule
```

---

## Hooks Git actifs (Husky)

### `pre-commit` — Lint avant chaque commit

Avant chaque `git commit`, ESLint vérifie automatiquement tout le code frontend :

```bash
npm run lint   # exécute eslint . dans frontend/
```

Le commit est **bloqué** si des erreurs ESLint sont détectées.

### `commit-msg` — Validation du message de commit

Le message de commit est validé par commitlint selon la convention **Conventional Commits**.

```bash
npx commitlint --edit $1
```

Le commit est **bloqué** si le message ne respecte pas le format `type(scope): message`.

---

## Installation

```bash
# Cloner le dépôt
git clone <url>

# Installer les dépendances racine (Husky + commitlint)
npm install

# Installer les dépendances frontend
cd frontend && npm install
```

Les hooks Husky s'activent automatiquement via le script `prepare`.

---

## Stack technique

- **Frontend** : React 19, Vite, TailwindCSS, React Router
- **Backend** : PHP (Laragon), architecture MVC
- **Tests** : Vitest (unit), Playwright (e2e)
- **Qualité** : ESLint, Husky, commitlint
