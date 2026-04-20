<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';

/**
 * Model Alert — Gère les alertes de prévention burn-out.
 *
 * Une alerte est créée automatiquement par MoodController lorsqu'un
 * collaborateur enregistre un score ≤ 2 pendant 3 jours consécutifs.
 * Elle est consultable et marquable comme lue par les rôles admin/rh.
 *
 * ON DELETE CASCADE sur fk_alerts_user : la suppression d'un utilisateur
 * supprime également ses alertes (pas d'orphelins).
 */
class Alert
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::getInstance()->getConnection();
    }

    /**
     * Insère une nouvelle alerte pour un utilisateur concerné.
     *
     * @param int    $userId   ID de l'utilisateur en difficulté.
     * @param string $message  Message descriptif de l'alerte.
     *
     * @return int  ID de l'alerte créée.
     */
    public function create(int $userId, string $message): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO alerts (user_id_concerne, message) VALUES (:user_id, :message)'
        );
        $stmt->execute([':user_id' => $userId, ':message' => $message]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Retourne toutes les alertes avec les informations de l'utilisateur concerné.
     *
     * Tri : non-lues en premier, puis par date décroissante.
     * Jointure LEFT avec teams pour afficher l'équipe si elle existe.
     *
     * @return array<int, array<string, mixed>>
     */
    public function findAll(): array
    {
        $stmt = $this->pdo->prepare('
            SELECT   a.id,
                     a.message,
                     a.is_read,
                     a.created_at,
                     u.nom,
                     u.prenom,
                     u.email,
                     t.nom_equipe
            FROM     alerts a
            INNER JOIN users u ON a.user_id_concerne = u.id
            LEFT  JOIN teams t ON u.team_id = t.id
            ORDER BY a.is_read ASC, a.created_at DESC
        ');
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Marque une alerte comme lue.
     *
     * @param int $id  ID de l'alerte.
     *
     * @return bool  True si une ligne a été modifiée.
     */
    public function markAsRead(int $id): bool
    {
        $stmt = $this->pdo->prepare(
            'UPDATE alerts SET is_read = 1 WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);

        return $stmt->rowCount() > 0;
    }
}
