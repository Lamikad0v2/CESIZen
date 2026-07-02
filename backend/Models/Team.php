<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';

/**
 * Model Team — Gère les opérations SQL liées à la table `teams`.
 *
 * Respecte la séparation MVC : aucune logique HTTP ici, uniquement
 * des interactions avec la base de données via PDO (requêtes préparées).
 */
class Team
{
    private PDO $pdo;

    /**
     * Injecte la connexion PDO via le Singleton Database.
     */
    public function __construct()
    {
        $this->pdo = Database::getInstance()->getConnection();
    }

    /**
     * Retourne toutes les équipes avec leur nombre de membres.
     *
     * @return array<int, array<string, mixed>>
     */
    public function findAll(): array
    {
        $stmt = $this->pdo->prepare('
            SELECT   t.id,
                     t.nom_equipe,
                     t.created_at,
                     COUNT(u.id) AS nombre_membres
            FROM     teams t
            LEFT JOIN users u ON u.team_id = t.id
            GROUP BY t.id, t.nom_equipe, t.created_at
            ORDER BY t.nom_equipe ASC
        ');
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Recherche une équipe par son identifiant.
     *
     * @param int $id
     *
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM teams WHERE id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $id]);

        $result = $stmt->fetch();

        return $result !== false ? $result : null;
    }

    /**
     * Crée une nouvelle équipe.
     *
     * @param string $nomEquipe  Nom de l'équipe (doit être unique).
     *
     * @return int  ID de l'équipe créée.
     *
     * @throws RuntimeException Code 409 si le nom existe déjà.
     * @throws RuntimeException Code 500 pour toute autre erreur SQL.
     */
    public function create(string $nomEquipe): int
    {
        try {
            $stmt = $this->pdo->prepare(
                'INSERT INTO teams (nom_equipe) VALUES (:nom_equipe)'
            );
            $stmt->execute([':nom_equipe' => $nomEquipe]);

            return (int) $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                throw new AppException('Team name already exists.', 409, $e);
            }
            throw new AppException('Team creation failed.', 500, $e);
        }
    }

    /**
     * Met à jour le nom d'une équipe existante.
     *
     * @param int    $id
     * @param string $nomEquipe
     *
     * @return bool  True si une ligne a été modifiée.
     *
     * @throws RuntimeException Code 409 si le nom est déjà pris.
     * @throws RuntimeException Code 500 pour toute autre erreur SQL.
     */
    public function update(int $id, string $nomEquipe): bool
    {
        try {
            $stmt = $this->pdo->prepare(
                'UPDATE teams SET nom_equipe = :nom_equipe WHERE id = :id'
            );
            $stmt->execute([':nom_equipe' => $nomEquipe, ':id' => $id]);

            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                throw new AppException('Team name already exists.', 409, $e);
            }
            throw new AppException('Team update failed.', 500, $e);
        }
    }

    /**
     * Supprime une équipe.
     * Grâce à ON DELETE SET NULL sur users.team_id, les membres de
     * l'équipe ne sont pas supprimés : leur team_id est mis à NULL.
     *
     * @param int $id
     *
     * @return bool  True si une ligne a été supprimée.
     */
    public function delete(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM teams WHERE id = :id');
        $stmt->execute([':id' => $id]);

        return $stmt->rowCount() > 0;
    }
}
