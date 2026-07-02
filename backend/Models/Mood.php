<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';

/**
 * Model Mood — Gère les opérations SQL liées à la table `moods`.
 *
 * Respecte la séparation MVC : aucune logique HTTP ici, uniquement
 * des interactions avec la base de données via PDO (requêtes préparées).
 *
 * Couche de sécurité DB : la contrainte UNIQUE (user_id, date_humeur)
 * empêche toute double insertion même en cas de race condition.
 *
 * Champs v3 — Modèle Circomplexe de Russell :
 *   - valence      : entier 1-100 (dimension hédonique : désagréable → agréable)
 *   - arousal      : entier 1-100 (dimension activation : épuisé → survolté)
 *   - context_tags : JSON array de contextes professionnels (nullable)
 *
 * Règle burn-out : alerte si valence < 30 ET arousal < 30 pendant 3 jours consécutifs.
 */
class Mood
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::getInstance()->getConnection();
    }

    /**
     * Insère une nouvelle entrée d'humeur pour un utilisateur.
     *
     * @param int         $userId       ID de l'utilisateur connecté.
     * @param int         $valence      Valence (1-100) : dimension hédonique.
     * @param int         $arousal      Arousal (1-100) : dimension d'activation.
     * @param array|null  $contextTags  Contextes professionnels, ex: ["Charge de travail"].
     * @param string|null $commentaire  Commentaire libre, peut être null.
     *
     * @return int  L'ID auto-incrémenté de l'entrée créée.
     *
     * @throws RuntimeException Code 409 si une humeur existe déjà pour ce jour.
     * @throws RuntimeException Code 500 pour toute autre erreur SQL.
     */
    public function create(
        int     $userId,
        int     $valence,
        int     $arousal,
        ?array  $contextTags,
        ?string $commentaire
    ): int {
        $sql = '
            INSERT INTO moods (user_id, valence, arousal, context_tags, commentaire, date_humeur)
            VALUES (:user_id, :valence, :arousal, :context_tags, :commentaire, CURDATE())
        ';

        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':user_id'      => $userId,
                ':valence'      => $valence,
                ':arousal'      => $arousal,
                ':context_tags' => $contextTags !== null ? json_encode($contextTags, JSON_UNESCAPED_UNICODE) : null,
                ':commentaire'  => $commentaire,
            ]);

            return (int) $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                throw new AppException('Duplicate mood for today.', 409, $e);
            }
            throw new AppException('Mood insertion failed.', 500, $e);
        }
    }

    /**
     * Vérifie si l'utilisateur a déjà soumis une humeur pour le jour courant.
     *
     * @param int $userId  ID de l'utilisateur à vérifier.
     *
     * @return array<string, mixed>|null  L'entrée existante, ou null si aucune.
     */
    public function findTodayByUserId(int $userId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM moods WHERE user_id = :user_id AND date_humeur = CURDATE() LIMIT 1'
        );
        $stmt->execute([':user_id' => $userId]);

        $result = $stmt->fetch();

        return $result !== false ? $result : null;
    }

    /**
     * Retourne l'historique complet des humeurs d'un utilisateur,
     * trié du plus récent au plus ancien.
     *
     * @param int $userId
     *
     * @return array<int, array<string, mixed>>
     */
    public function findAllByUserId(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, valence, arousal, context_tags, commentaire, date_humeur
             FROM moods
             WHERE user_id = :user_id
             ORDER BY date_humeur DESC'
        );
        $stmt->execute([':user_id' => $userId]);

        return array_map([$this, 'decodeJsonColumns'], $stmt->fetchAll());
    }

    /**
     * Retourne les entrées d'humeur des 7 derniers jours pour un utilisateur.
     *
     * @param int $userId
     *
     * @return array<int, array<string, mixed>>
     */
    public function findLastSevenDaysByUserId(int $userId): array
    {
        $sql = '
            SELECT valence, arousal, context_tags, commentaire, date_humeur
            FROM   moods
            WHERE  user_id    = :user_id
              AND  date_humeur >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            ORDER BY date_humeur ASC
        ';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':user_id' => $userId]);

        return array_map([$this, 'decodeJsonColumns'], $stmt->fetchAll());
    }

    /**
     * Retourne les humeurs des 2 jours précédant aujourd'hui (valence ET arousal).
     *
     * Utilisé par la règle burn-out : si J-1 ET J-2 ont valence < 30 ET arousal < 30,
     * et qu'aujourd'hui l'utilisateur soumet à nouveau dans cette zone,
     * c'est le 3ème jour consécutif → alerte critique.
     *
     * @param int $userId
     *
     * @return array<int, array<string, mixed>>  0 à 2 entrées, triées DESC.
     */
    public function findPreviousTwoDaysScoresByUserId(int $userId): array
    {
        $stmt = $this->pdo->prepare('
            SELECT valence, arousal, date_humeur
            FROM   moods
            WHERE  user_id     = :user_id
              AND  date_humeur IN (
                DATE_SUB(CURDATE(), INTERVAL 1 DAY),
                DATE_SUB(CURDATE(), INTERVAL 2 DAY)
              )
            ORDER BY date_humeur DESC
        ');
        $stmt->execute([':user_id' => $userId]);

        return $stmt->fetchAll();
    }

    /**
     * Calcule les moyennes de valence et d'arousal quotidiennes anonymisées
     * d'une équipe sur les 7 derniers jours (J-6 à J).
     *
     * @param int $teamId
     *
     * @return array<int, array<string, mixed>>
     */
    public function findTeamAverageLastSevenDays(int $teamId): array
    {
        $stmt = $this->pdo->prepare('
            SELECT   m.date_humeur,
                     ROUND(AVG(m.valence), 2) AS avg_valence,
                     ROUND(AVG(m.arousal), 2) AS avg_arousal,
                     COUNT(m.id)              AS nb_saisies
            FROM     moods m
            INNER JOIN users u ON m.user_id = u.id
            WHERE    u.team_id     = :team_id
              AND    m.date_humeur >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY m.date_humeur
            ORDER BY m.date_humeur ASC
        ');
        $stmt->execute([':team_id' => $teamId]);

        return $stmt->fetchAll();
    }

    // ----------------------------------------------------------------
    // Helper privé
    // ----------------------------------------------------------------

    /**
     * Décode la colonne JSON context_tags d'une ligne PDO en tableau PHP.
     *
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    private function decodeJsonColumns(array $row): array
    {
        $row['context_tags'] = isset($row['context_tags'])
            ? (json_decode((string) $row['context_tags'], true) ?? [])
            : [];

        return $row;
    }
}
