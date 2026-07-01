-- =============================================================
-- CESIZen — Migration V1 : schéma initial
-- Généré en artefact CI appliqué en CD
--
-- IDEMPOTENCE : chaque instruction est rejouable sans erreur
--   • CREATE TABLE  → IF NOT EXISTS (jamais de doublon)
--   • Pas de DROP, pas de TRUNCATE, pas de perte de données
--   • Exécutable sur une base fraîche ou une base existante
--
-- EXÉCUTION : mysql -u cesizen -p<DB_PASS> cesizen < V1__initial_schema.sql
-- =============================================================

-- -------------------------------------------------------------
-- Table : teams
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
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    nom           VARCHAR(100)     NOT NULL,
    prenom        VARCHAR(100)     NOT NULL,
    email         VARCHAR(255)     NOT NULL,
    mot_de_passe  VARCHAR(255)     NOT NULL,
    role          ENUM('collaborateur','manager','rh','admin') NOT NULL DEFAULT 'collaborateur',
    team_id       INT UNSIGNED     NULL,
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
-- Table : moods  (Modèle Circomplexe de Russell v3)
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
-- Table : alerts  (alertes burn-out automatiques)
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
-- Table : articles  (ressources bien-être)
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
