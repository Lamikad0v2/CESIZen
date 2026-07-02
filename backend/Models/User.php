<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';

/**
 * Model User — Gère les opérations SQL liées à la table `users`.
 *
 * Respecte la séparation MVC : aucune logique HTTP ici, uniquement
 * des interactions avec la base de données via PDO (requêtes préparées).
 */
class User
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
     * Crée un nouvel utilisateur en base après hachage du mot de passe.
     *
     * Le mot de passe est haché avec Argon2id (algorithme recommandé PHP 8+).
     * L'email doit être unique (contrainte BDD) — une PDOException sera levée
     * si l'email existe déjà.
     *
     * @param string $nom
     * @param string $prenom
     * @param string $email
     * @param string $plainPassword  Mot de passe en clair (jamais persisté tel quel).
     * @param string $role           Valeur parmi : 'collaborateur', 'manager', 'admin'.
     *
     * @return int  L'ID auto-incrémenté du nouvel utilisateur.
     *
     * @throws RuntimeException  Si l'insertion échoue (ex : email dupliqué).
     */
    public function create(
        string $nom,
        string $prenom,
        string $email,
        string $plainPassword,
        string $role = 'collaborateur'
    ): int {
        $hashedPassword = password_hash($plainPassword, PASSWORD_ARGON2ID);

        $sql = '
            INSERT INTO users (nom, prenom, email, mot_de_passe, role)
            VALUES (:nom, :prenom, :email, :mot_de_passe, :role)
        ';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':nom'          => $nom,
            ':prenom'       => $prenom,
            ':email'        => $email,
            ':mot_de_passe' => $hashedPassword,
            ':role'         => $role,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Recherche un utilisateur par son adresse email.
     *
     * Retourne un tableau associatif avec toutes les colonnes de la table
     * `users` (y compris le hash du mot de passe, nécessaire pour la
     * vérification côté AuthController), ou null si aucun résultat.
     *
     * @param string $email
     *
     * @return array<string, mixed>|null  Données de l'utilisateur, ou null.
     */
    public function findByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM users WHERE email = :email LIMIT 1'
        );
        $stmt->execute([':email' => $email]);

        $result = $stmt->fetch();

        return $result !== false ? $result : null;
    }

    /**
     * Retourne tous les utilisateurs avec leur équipe (LEFT JOIN),
     * sans exposer le hash du mot de passe.
     *
     * @return array<int, array<string, mixed>>
     */
    public function findAll(): array
    {
        $stmt = $this->pdo->prepare('
            SELECT   u.id,
                     u.nom,
                     u.prenom,
                     u.email,
                     u.role,
                     u.team_id,
                     t.nom_equipe,
                     u.created_at
            FROM     users u
            LEFT JOIN teams t ON u.team_id = t.id
            ORDER BY u.nom ASC, u.prenom ASC
        ');
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Recherche un utilisateur par son identifiant.
     * Ne retourne pas le hash du mot de passe.
     *
     * @param int $id
     *
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, nom, prenom, email, role, team_id, created_at
             FROM users WHERE id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $id]);

        $result = $stmt->fetch();

        return $result !== false ? $result : null;
    }

    /**
     * Met à jour le rôle et l'équipe d'un utilisateur.
     *
     * @param int      $id
     * @param string   $role    Valeur ENUM : 'collaborateur', 'manager', 'admin'.
     * @param int|null $teamId  ID de l'équipe ou null (sans équipe).
     *
     * @return bool  True si la ligne a été modifiée.
     *
     * @throws RuntimeException Code 422 si team_id ne référence pas d'équipe valide.
     * @throws RuntimeException Code 500 pour toute autre erreur SQL.
     */
    public function updateRoleAndTeam(int $id, string $role, ?int $teamId): bool
    {
        try {
            $stmt = $this->pdo->prepare(
                'UPDATE users SET role = :role, team_id = :team_id WHERE id = :id'
            );
            $stmt->execute([':role' => $role, ':team_id' => $teamId, ':id' => $id]);

            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            // SQLSTATE 23000 = violation de contrainte FK (team_id inexistant)
            if ($e->getCode() === '23000') {
                throw new AppException('Invalid team ID: team does not exist.', 422, $e);
            }
            throw new AppException('User update failed.', 500, $e);
        }
    }

    /**
     * Supprime un utilisateur par son identifiant.
     * La suppression en cascade via FK efface également ses entrées dans `moods`.
     *
     * @param int $id
     *
     * @return bool  True si la ligne a été supprimée.
     */
    /**
     * Met à jour le prénom et le nom d'un utilisateur.
     * Si $hashedPassword est fourni, met également à jour le mot de passe.
     */
    public function updateProfile(int $id, string $nom, string $prenom, ?string $hashedPassword): bool
    {
        if ($hashedPassword !== null) {
            $stmt = self::db()->prepare(
                'UPDATE users SET nom = :nom, prenom = :prenom, mot_de_passe = :mdp WHERE id = :id'
            );
            return $stmt->execute([':nom' => $nom, ':prenom' => $prenom, ':mdp' => $hashedPassword, ':id' => $id]);
        }
        $stmt = self::db()->prepare(
            'UPDATE users SET nom = :nom, prenom = :prenom WHERE id = :id'
        );
        return $stmt->execute([':nom' => $nom, ':prenom' => $prenom, ':id' => $id]);
    }

    public function deleteById(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM users WHERE id = :id');
        $stmt->execute([':id' => $id]);

        return $stmt->rowCount() > 0;
    }
}
