<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * Classe de base pour tous les tests nécessitant la base de données.
 *
 * Stratégie :
 *   - setUpBeforeClass() : crée la BDD cesizen_test et toutes les tables (une seule fois par classe).
 *   - setUp()            : truncate toutes les tables avant chaque test (isolation garantie).
 *   - tearDownAfterClass(): Rien — la BDD reste pour relance rapide des tests.
 *
 * La variable d'env CESIZEN_DB_NAME est forcée à 'cesizen_test'
 * pour que Database::getInstance() ne touche jamais la BDD de production.
 */
abstract class DatabaseTestCase extends TestCase
{
    // ─── Bootstrap de la BDD test ────────────────────────────────

    public static function setUpBeforeClass(): void
    {
        // Force la BDD de test AVANT toute instanciation du Singleton
        $_ENV['CESIZEN_DB_NAME'] = 'cesizen_test';
        putenv('CESIZEN_DB_NAME=cesizen_test');
        Database::resetInstance();

        // Connexion root sans dbname pour CREATE DATABASE
        $pdo = new PDO(
            'mysql:host=localhost;charset=utf8mb4',
            'root',
            '', // NOSONAR — Laragon test DB has no password by default
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $pdo->exec('CREATE DATABASE IF NOT EXISTS cesizen_test
                    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        $pdo->exec('USE cesizen_test');
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

        // Recréation propre des tables pour garantir l'alignement avec le schéma courant.
        // DROP + CREATE assure que toute migration de colonnes est appliquée.
        foreach (['alerts', 'moods', 'articles', 'users', 'teams'] as $t) {
            $pdo->exec("DROP TABLE IF EXISTS `{$t}`"); // NOSONAR — table names are from a hardcoded fixture array
        }

        // Création des tables (miroir du schéma de production)
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS teams (
                id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
                nom_equipe VARCHAR(150) NOT NULL,
                created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT pk_teams     PRIMARY KEY (id),
                CONSTRAINT uq_teams_nom UNIQUE (nom_equipe)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS users (
                id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
                nom          VARCHAR(100)     NOT NULL,
                prenom       VARCHAR(100)     NOT NULL,
                email        VARCHAR(255)     NOT NULL,
                mot_de_passe VARCHAR(255)     NOT NULL,
                role         ENUM('collaborateur','manager','rh','admin') NOT NULL DEFAULT 'collaborateur',
                team_id      INT UNSIGNED     NULL,
                created_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT pk_users       PRIMARY KEY (id),
                CONSTRAINT uq_users_email UNIQUE (email),
                CONSTRAINT fk_users_team  FOREIGN KEY (team_id)
                    REFERENCES teams (id) ON DELETE SET NULL ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS moods (
                id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
                user_id       INT UNSIGNED     NOT NULL,
                valence       TINYINT UNSIGNED NOT NULL,
                arousal       TINYINT UNSIGNED NOT NULL,
                emotion_tags  JSON             NULL,
                context_tags  JSON             NULL,
                commentaire   TEXT             NULL,
                date_humeur   DATE             NOT NULL,
                date_creation DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT pk_moods          PRIMARY KEY (id),
                CONSTRAINT uq_mood_per_day   UNIQUE (user_id, date_humeur),
                CONSTRAINT fk_moods_user     FOREIGN KEY (user_id)
                    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT chk_moods_valence CHECK (valence BETWEEN 1 AND 100),
                CONSTRAINT chk_moods_arousal CHECK (arousal BETWEEN 1 AND 100)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS alerts (
                id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id_concerne INT UNSIGNED NOT NULL,
                message          VARCHAR(500) NOT NULL,
                is_read          TINYINT(1)   NOT NULL DEFAULT 0,
                created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT pk_alerts      PRIMARY KEY (id),
                CONSTRAINT fk_alerts_user FOREIGN KEY (user_id_concerne)
                    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS articles (
                id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
                title      VARCHAR(255) NOT NULL,
                content    TEXT         NOT NULL,
                author_id  INT UNSIGNED NOT NULL,
                created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT pk_articles      PRIMARY KEY (id),
                CONSTRAINT fk_articles_user FOREIGN KEY (author_id)
                    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    }

    // ─── Isolation entre chaque test ─────────────────────────────

    protected function setUp(): void
    {
        $_ENV['CESIZEN_DB_NAME'] = 'cesizen_test';
        putenv('CESIZEN_DB_NAME=cesizen_test');
        Database::resetInstance();

        $pdo = Database::getInstance()->getConnection();
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        foreach (['alerts', 'moods', 'articles', 'users', 'teams'] as $table) {
            $pdo->exec("TRUNCATE TABLE `{$table}`");
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    }

    // ─── Helpers partagés ────────────────────────────────────────

    /**
     * Insère un utilisateur minimal et retourne son ID.
     */
    protected function insertUser(
        string $email  = 'test@example.com',
        string $role   = 'collaborateur',
        ?int   $teamId = null
    ): int {
        $pdo = Database::getInstance()->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO users (nom, prenom, email, mot_de_passe, role, team_id)
            VALUES (:nom, :prenom, :email, :pwd, :role, :team_id)
        ');
        $stmt->execute([
            ':nom'     => 'Doe',
            ':prenom'  => 'John',
            ':email'   => $email,
            ':pwd'     => password_hash('Password1!', PASSWORD_ARGON2ID),
            ':role'    => $role,
            ':team_id' => $teamId,
        ]);
        return (int) $pdo->lastInsertId();
    }

    /**
     * Insère une équipe et retourne son ID.
     */
    protected function insertTeam(string $name = 'Équipe Test'): int
    {
        $pdo = Database::getInstance()->getConnection();
        $pdo->prepare('INSERT INTO teams (nom_equipe) VALUES (:nom)')
            ->execute([':nom' => $name]);
        return (int) $pdo->lastInsertId();
    }

    /**
     * Insère une humeur pour un utilisateur à une date relative (daysAgo).
     *
     * @param int        $userId      ID de l'utilisateur.
     * @param int        $valence     Valence entre 1 et 100 (dimension hédonique).
     * @param int        $arousal     Arousal entre 1 et 100 (dimension d'activation).
     * @param int        $daysAgo     Décalage en jours (0 = aujourd'hui).
     * @param array|null $contextTags Tags de contexte professionnel (nullable).
     */
    protected function insertMood(
        int    $userId,
        int    $valence,
        int    $arousal,
        int    $daysAgo     = 0,
        ?array $contextTags = null
    ): void {
        $date = date('Y-m-d', strtotime("-{$daysAgo} days"));
        $pdo  = Database::getInstance()->getConnection();
        $pdo->prepare('
            INSERT INTO moods (user_id, valence, arousal, context_tags, commentaire, date_humeur)
            VALUES (?, ?, ?, ?, NULL, ?)
        ')->execute([
            $userId,
            $valence,
            $arousal,
            $contextTags !== null ? json_encode($contextTags, JSON_UNESCAPED_UNICODE) : null,
            $date,
        ]);
    }
}
