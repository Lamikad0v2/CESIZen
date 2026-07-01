# PLAN — Stratégie de déploiement Blue/Green

> Document écrit **avant l'implémentation** conformément aux exigences du TP.

---

## 1. Organisation des fichiers Docker Compose

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | **Tout-en-un** : DB + proxy Nginx + slot blue + slot green |

Un seul fichier suffit car les services individuels sont gérés avec `--no-deps`
(Docker Compose ne relance que le service nommé, pas ses dépendances).

### Pourquoi ne pas utiliser plusieurs fichiers ?
- Un seul fichier simplifie la gestion réseau (`cesizen-net` est défini une seule fois).
- `docker compose up -d --no-deps app-green` redémarre UNIQUEMENT le slot cible.
- La DB et le proxy ne sont jamais touchés pendant un déploiement.

---

## 2. Logique de déploiement

### État initial (première installation)

```
docker compose up -d
```

- DB démarre en premier (healthcheck).
- `app-blue` et `app-green` démarrent (même image `:latest`).
- Nginx démarre et route vers **blue** (config initiale).
- Fichier d'état : `C:\cesizen-state\active_slot.txt` → `blue`.

### Cycle de déploiement normal

```
push vers main
    │
    ├─▶ [Job CI]  Tests · SonarCloud · docker build → push :latest + :sha sur GHCR
    │
    └─▶ [Job CD]  deploy-blue-green.ps1
                      │
                      ├─ [1] Lire slot actif   (ex: blue)  →  nouveau slot = green
                      ├─ [2] docker compose pull app-green  (récupère la nouvelle image)
                      ├─ [3] docker compose up -d db         (s'assurer que la DB tourne)
                      ├─ [4] Attendre healthcheck MySQL
                      ├─ [5] mysql < V1__initial_schema.sql  (migration expand)
                      ├─ [6] docker compose up -d --no-deps app-green
                      ├─ [7] Attendre que le conteneur soit running (15 s max)
                      ├─ [8] Écrire docker/nginx/upstream.conf → server app-green:8080
                      ├─ [9] docker exec cesizen-proxy nginx -s reload  (rechargement gracieux)
                      └─[10] Écrire C:\cesizen-state\active_slot.txt → green
```

### Au déploiement suivant
- Slot actif = green → nouveau slot = blue.
- On répète le cycle pour blue.
- Nginx recharge (gracieux, sans coupure).

---

## 3. Rôle du reverse proxy Nginx

```
Navigateur
    │  :80
    ▼
┌──────────────┐
│  Nginx proxy │  écoute :80
│  (cesizen-   │  upstream = cesizen_active
│   proxy)     │             │
└──────────────┘             │
        ┌────────────────────┤
        │  conf.d/upstream.conf
        │
        ├── server app-blue:8080   ← si slot actif = blue
        └── server app-green:8080  ← si slot actif = green
```

La bascule se fait par :
1. Réécriture de `docker/nginx/upstream.conf` sur l'hôte.
2. `docker exec cesizen-proxy nginx -s reload` — rechargement **gracieux** :
   - Les requêtes en cours vers l'ancien upstream sont **terminées**.
   - Les nouvelles requêtes partent vers le nouveau slot.
   - Aucune requête n'est perdue.

---

## 4. Stratégie de rollback immédiat

```powershell
# Rollback : basculer vers l'ancien slot sans redéployer
.\deploy-blue-green.ps1 -Rollback
```

Le script, avec `-Rollback` :
- Lit le slot actif (ex: green).
- Bascule nginx vers l'autre slot (blue) **sans pull ni migration**.
- Le conteneur blue tourne toujours (jamais arrêté pendant le déploiement green).
- Délai de rollback : < 5 secondes (juste un `nginx -s reload`).

---

## 5. Stratégie de mise à jour de la base de données

### Le problème du schéma partagé

Les deux slots (blue et green) **partagent la même base de données**.
Si une migration casse le schéma (rename de colonne, DROP…), le slot encore actif
(**blue**) plante, rendant le rollback impossible et pouvant entraîner une perte de données.

### Solution : pattern Expand / Contract

```
Phase EXPAND  (avant bascule)
├─ Ajouter une nouvelle colonne  →  ignorée par old-blue, utilisée par new-green ✓
├─ Ajouter une nouvelle table    →  idem ✓
└─ Jamais : DROP, RENAME, NOT NULL sans DEFAULT sur une colonne existante

Phase BASCULE  (nginx reload)
└─ Le trafic passe de blue vers green

Phase CONTRACT  (après stabilisation, déploiement suivant)
└─ Supprimer l'ancienne colonne / table devenue inutile
   (à ce stade, blue est arrêté ou a été mis à jour)
```

### Règles concrètes

| Action | Autorisée en expand ? | Risque rollback |
|---|---|---|
| `CREATE TABLE IF NOT EXISTS` | ✅ oui | aucun |
| `ALTER TABLE ADD COLUMN DEFAULT …` | ✅ oui | aucun |
| `ALTER TABLE DROP COLUMN` | ❌ non (phase contract uniquement) | perte de données |
| `ALTER TABLE RENAME COLUMN` | ❌ non | casse old-blue |
| `ALTER TABLE MODIFY … NOT NULL` | ❌ non | contrainte non respectée par old-blue |
| `DROP TABLE` | ❌ non (phase contract uniquement) | perte de données |

### Quand appliquer la migration ?

```
migration EXPAND → démarrage new slot → bascule proxy → (délai stabilisation) → migration CONTRACT
```

La migration expand est appliquée **avant** de démarrer le nouveau slot.
Le nouveau slot démarre sur un schéma déjà étendu.
L'ancien slot continue sur ce même schéma étendu (les nouvelles colonnes sont ignorées).

### Que se passe-t-il lors d'un rollback ?

- La migration expand a déjà ajouté des colonnes.
- Le rollback repointe nginx vers blue (old version).
- Blue ignore les nouvelles colonnes (elles existent mais ne sont pas utilisées).
- **Aucune perte de données** : les nouvelles colonnes sont vides ou ont un DEFAULT.
- La phase contract N'A PAS encore été exécutée → schéma parfaitement compatible.

---

## 6. Ce que fait le pipeline CI pour la bascule

```yaml
deploy:
  needs: ci
  if: push vers main seulement
  steps:
    - checkout   # récupère deploy-blue-green.ps1 depuis la nouvelle version
    - run: & "$env:GITHUB_WORKSPACE\deploy-blue-green.ps1" -ImageTag "${{ github.sha }}"
```

Le pipeline CI :
1. Construit et push l'image taguée `:sha` et `:latest` (job `ci`).
2. Appelle `deploy-blue-green.ps1` avec le SHA exact (pas `:latest` pour éviter les races).
3. Le script détermine le slot inactif, déploie dessus, bascule le proxy.
4. L'état persist dans `C:\cesizen-state\active_slot.txt` entre les runs.
