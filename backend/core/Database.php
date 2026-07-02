<?php
declare(strict_types=1);

require_once __DIR__ . '/AppException.php';

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
    // Valeurs par défaut pour le développement local (Laragon)
    // En production Docker, ces valeurs sont surchargées par les variables d'env
    private const DB_HOST_DEFAULT = 'localhost';
    private const DB_USER_DEFAULT = 'root';
    private const DB_PASS_DEFAULT = '';

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

        $host   = $_ENV['DB_HOST']          ?? getenv('DB_HOST')          ?: self::DB_HOST_DEFAULT;
        $user   = $_ENV['DB_USER']          ?? getenv('DB_USER')          ?: self::DB_USER_DEFAULT;
        $pass   = $_ENV['DB_PASS']          ?? getenv('DB_PASS')          ?: self::DB_PASS_DEFAULT;
        $dbName = $_ENV['CESIZEN_DB_NAME']  ?? getenv('CESIZEN_DB_NAME')  ?: 'cesizen';
        $dsn    = "mysql:host={$host};dbname={$dbName};charset=utf8mb4";

        try {
            $this->connection = new PDO($dsn, $user, $pass, $options);
        } catch (PDOException $e) {
            // On ne propage jamais le message brut au client
            throw new AppException('Database connection failed.', 500, $e);
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
