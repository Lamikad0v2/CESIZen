<?php
declare(strict_types=1);

/**
 * Classe Database — Connexion PDO via le pattern Singleton.
 *
 * Garantit qu'une seule instance PDO est créée pour toute la durée
 * de la requête, évitant les connexions multiples à la base de données.
 *
 * Usage :
 *   $pdo = Database::getInstance()->getConnection();
 */
class Database
{
    private const DB_HOST  = 'localhost';
    private const DB_USER  = 'root';
    private const DB_PASS  = '';

    /** @var Database|null Instance unique de la classe */
    private static ?Database $instance = null;

    /** @var PDO Connexion PDO active */
    private PDO $connection;

    /**
     * Constructeur privé : empêche l'instanciation directe (new Database()).
     * Initialise la connexion PDO avec les options de sécurité recommandées.
     *
     * @throws RuntimeException Si la connexion à la base de données échoue.
     */
    private function __construct()
    {
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        $dbName = $_ENV['CESIZEN_DB_NAME'] ?? getenv('CESIZEN_DB_NAME') ?: 'cesizen';
        $dsn    = 'mysql:host=' . self::DB_HOST . ';dbname=' . $dbName . ';charset=utf8mb4';

        try {
            $this->connection = new PDO($dsn, self::DB_USER, self::DB_PASS, $options);
        } catch (PDOException $e) {
            // On ne propage jamais le message brut au client
            throw new RuntimeException('Database connection failed.', 500, $e);
        }
    }

    /**
     * Retourne l'instance unique de Database (la crée si nécessaire).
     *
     * @return self
     */
    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    /**
     * Retourne l'objet PDO pour exécuter des requêtes.
     *
     * @return PDO
     */
    public function getConnection(): PDO
    {
        return $this->connection;
    }

    /**
     * Réinitialise le Singleton — réservé aux tests unitaires.
     * Permet de changer la base de données cible entre les tests.
     *
     * @internal Ne jamais appeler en production.
     */
    public static function resetInstance(): void
    {
        self::$instance = null;
    }

    /** Empêche le clonage de l'instance (pattern Singleton). */
    private function __clone() {}
}
