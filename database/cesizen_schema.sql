-- =============================================================
-- CESIZen - Schéma de base de données
-- Base : cesizen | Moteur : InnoDB | Encodage : utf8mb4
-- =============================================================
-- INSTALLATION FRAÎCHE : exécutez la totalité de ce fichier.
-- BASE EXISTANTE       : exécutez UNIQUEMENT la section
--                        "Scripts de migration" en bas de fichier.
-- =============================================================

CREATE DATABASE IF NOT EXISTS cesizen
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE cesizen;

-- -------------------------------------------------------------
-- Table : teams
-- Doit être créée AVANT users (users référence teams via FK).
-- nom_equipe est unique : une équipe ne peut pas exister en double.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    nom_equipe  VARCHAR(150)  NOT NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_teams     PRIMARY KEY (id),
    CONSTRAINT uq_teams_nom UNIQUE (nom_equipe)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- Table : users
-- team_id est nullable : un collaborateur peut n'appartenir
-- à aucune équipe. ON DELETE SET NULL garantit qu'une suppression
-- d'équipe ne supprime pas les utilisateurs mais libère leur
-- référence (pas d'orphelin).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    nom           VARCHAR(100)     NOT NULL,
    prenom        VARCHAR(100)     NOT NULL,
    email         VARCHAR(255)     NOT NULL,
    mot_de_passe  VARCHAR(255)     NOT NULL,          -- Hash Argon2id via password_hash()
    role          ENUM('collaborateur', 'manager', 'rh', 'admin') NOT NULL DEFAULT 'collaborateur',
    team_id       INT UNSIGNED     NULL,              -- Équipe affectée (NULL = sans équipe)
    created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_users       PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT fk_users_team  FOREIGN KEY (team_id)
        REFERENCES teams (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- Table : moods  (v3 — Modèle Circomplexe de Russell)
-- `valence` : dimension hédonique  (1 = très désagréable, 100 = très agréable).
-- `arousal`  : dimension d'activation (1 = épuisé/calme, 100 = survolté/actif).
-- `context_tags` : tableau JSON des contextes pro (ex: ["Charge de travail"]).
-- `emotion_tags` : conservée nullable pour compatibilité données historiques.
-- Contrainte UNIQUE (user_id, date_humeur) : une seule saisie par jour.
-- Règle burn-out : alerte si valence < 30 ET arousal < 30 pendant 3 jours.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moods (
    id             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    user_id        INT UNSIGNED     NOT NULL,
    valence        TINYINT UNSIGNED NOT NULL,
    arousal        TINYINT UNSIGNED NOT NULL,
    emotion_tags   JSON             NULL,
    context_tags   JSON             NULL,
    commentaire    TEXT             NULL,
    date_humeur    DATE             NOT NULL,
    date_creation  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_moods          PRIMARY KEY (id),
    CONSTRAINT uq_mood_per_day   UNIQUE      (user_id, date_humeur),
    CONSTRAINT fk_moods_user     FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_moods_valence CHECK (valence BETWEEN 1 AND 100),
    CONSTRAINT chk_moods_arousal CHECK (arousal BETWEEN 1 AND 100)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- Table : alerts
-- Stocke les alertes de prévention burn-out générées automatiquement
-- lorsqu'un collaborateur enregistre un score ≤ 2 pendant 3 jours
-- consécutifs. ON DELETE CASCADE : si l'utilisateur est supprimé,
-- ses alertes le sont aussi.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id_concerne INT UNSIGNED NOT NULL,
    message          VARCHAR(500) NOT NULL,
    is_read          TINYINT(1)   NOT NULL DEFAULT 0,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_alerts      PRIMARY KEY (id),
    CONSTRAINT fk_alerts_user FOREIGN KEY (user_id_concerne)
        REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- Table : articles
-- Stocke les ressources bien-être publiées par les admins/RH.
-- author_id référence l'auteur (users.id). ON DELETE CASCADE :
-- si l'auteur est supprimé, ses articles le sont également.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title      VARCHAR(255) NOT NULL,
    content    TEXT         NOT NULL,
    author_id  INT UNSIGNED NOT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_articles      PRIMARY KEY (id),
    CONSTRAINT fk_articles_user FOREIGN KEY (author_id)
        REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


-- =============================================================
-- Scripts de migration (BASE EXISTANTE uniquement)
-- =============================================================

-- Étape 1 : Créer la table teams si elle n'existe pas encore
-- CREATE TABLE IF NOT EXISTS teams (
--     id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
--     nom_equipe VARCHAR(150) NOT NULL,
--     created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT pk_teams     PRIMARY KEY (id),
--     CONSTRAINT uq_teams_nom UNIQUE (nom_equipe)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Étape 2 : Ajouter la colonne team_id à users
-- ALTER TABLE users
--     ADD COLUMN team_id INT UNSIGNED NULL AFTER role,
--     ADD CONSTRAINT fk_users_team FOREIGN KEY (team_id)
--         REFERENCES teams (id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Étape 3 : Ajouter le rôle 'rh' à l'ENUM des rôles utilisateurs
-- ALTER TABLE users
--     MODIFY COLUMN role ENUM('collaborateur', 'manager', 'rh', 'admin')
--         NOT NULL DEFAULT 'collaborateur';

-- Étape 4 : Créer la table alerts (système d'alerte burn-out)
-- CREATE TABLE IF NOT EXISTS alerts (
--     id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
--     user_id_concerne INT UNSIGNED NOT NULL,
--     message          VARCHAR(500) NOT NULL,
--     is_read          TINYINT(1)   NOT NULL DEFAULT 0,
--     created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT pk_alerts      PRIMARY KEY (id),
--     CONSTRAINT fk_alerts_user FOREIGN KEY (user_id_concerne)
--         REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Étape 5 : Migration moods v1 → v2 (score 1-5 → energy_level 1-100 + tags JSON)
-- ALTER TABLE moods
--     ADD COLUMN energy_level   TINYINT UNSIGNED NULL AFTER user_id,
--     ADD COLUMN emotion_tags   JSON NULL AFTER energy_level,
--     ADD COLUMN context_tags   JSON NULL AFTER emotion_tags,
--     ADD CONSTRAINT chk_moods_energy_level CHECK (energy_level BETWEEN 1 AND 100);
-- UPDATE moods SET energy_level = ROUND(score * 20) WHERE energy_level IS NULL;
-- ALTER TABLE moods
--     MODIFY COLUMN energy_level TINYINT UNSIGNED NOT NULL,
--     DROP CONSTRAINT chk_moods_score,
--     DROP COLUMN score;

-- Étape 6 : Migration moods v2 → v3 (energy_level → valence + arousal, Modèle Circomplexe)
-- ALTER TABLE moods
--     ADD COLUMN valence TINYINT UNSIGNED NULL AFTER user_id,
--     ADD COLUMN arousal TINYINT UNSIGNED NULL AFTER valence;
-- UPDATE moods SET valence = energy_level, arousal = energy_level WHERE valence IS NULL;
-- ALTER TABLE moods
--     MODIFY COLUMN valence TINYINT UNSIGNED NOT NULL,
--     MODIFY COLUMN arousal TINYINT UNSIGNED NOT NULL,
--     ADD CONSTRAINT chk_moods_valence CHECK (valence BETWEEN 1 AND 100),
--     ADD CONSTRAINT chk_moods_arousal CHECK (arousal BETWEEN 1 AND 100),
--     DROP CONSTRAINT chk_moods_energy_level,
--     DROP COLUMN energy_level;

-- Étape 7 : Créer la table articles (module ressources bien-être)
-- CREATE TABLE IF NOT EXISTS articles (
--     id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
--     title      VARCHAR(255) NOT NULL,
--     content    TEXT         NOT NULL,
--     author_id  INT UNSIGNED NOT NULL,
--     created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     CONSTRAINT pk_articles      PRIMARY KEY (id),
--     CONSTRAINT fk_articles_user FOREIGN KEY (author_id)
--         REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
