<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';

/**
 * Model Article — Gère les opérations SQL liées à la table `articles`.
 *
 * Respecte la séparation MVC : aucune logique HTTP ici, uniquement
 * des interactions avec la base de données via PDO (requêtes préparées).
 */
class Article
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
     * Retourne tous les articles triés du plus récent au plus ancien,
     * enrichis du prénom et nom de l'auteur (JOIN users).
     *
     * @return array<int, array<string, mixed>>
     */
    public function findAll(): array
    {
        $stmt = $this->pdo->prepare('
            SELECT  a.id,
                    a.title,
                    a.content,
                    a.author_id,
                    u.nom    AS author_nom,
                    u.prenom AS author_prenom,
                    a.created_at,
                    a.updated_at
            FROM    articles a
            JOIN    users    u ON u.id = a.author_id
            ORDER   BY a.created_at DESC, a.id DESC
        ');
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Recherche un article par son identifiant.
     * Retourne null si l'article n'existe pas.
     *
     * @param int $id
     *
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('
            SELECT  a.id,
                    a.title,
                    a.content,
                    a.author_id,
                    u.nom    AS author_nom,
                    u.prenom AS author_prenom,
                    a.created_at,
                    a.updated_at
            FROM    articles a
            JOIN    users    u ON u.id = a.author_id
            WHERE   a.id = :id
            LIMIT   1
        ');
        $stmt->execute([':id' => $id]);

        $result = $stmt->fetch();

        return $result !== false ? $result : null;
    }

    /**
     * Crée un nouvel article et retourne son identifiant.
     *
     * @param string $title
     * @param string $content
     * @param int    $authorId  Doit référencer un users.id valide.
     *
     * @return int  ID auto-incrémenté du nouvel article.
     *
     * @throws RuntimeException  Code 422 si l'auteur n'existe pas (violation FK).
     * @throws RuntimeException  Code 500 pour toute autre erreur SQL.
     */
    public function create(string $title, string $content, int $authorId): int
    {
        try {
            $stmt = $this->pdo->prepare('
                INSERT INTO articles (title, content, author_id)
                VALUES (:title, :content, :author_id)
            ');
            $stmt->execute([
                ':title'     => $title,
                ':content'   => $content,
                ':author_id' => $authorId,
            ]);

            return (int) $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                throw new RuntimeException('Invalid author ID: user does not exist.', 422, $e);
            }
            throw new RuntimeException('Article creation failed.', 500, $e);
        }
    }

    /**
     * Met à jour le titre et le contenu d'un article.
     *
     * @param int    $id
     * @param string $title
     * @param string $content
     *
     * @return bool  True si la ligne a été modifiée.
     */
    public function update(int $id, string $title, string $content): bool
    {
        $stmt = $this->pdo->prepare('
            UPDATE articles
            SET    title = :title, content = :content
            WHERE  id    = :id
        ');
        $stmt->execute([':title' => $title, ':content' => $content, ':id' => $id]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Supprime un article par son identifiant.
     *
     * @param int $id
     *
     * @return bool  True si la ligne a été supprimée.
     */
    public function deleteById(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM articles WHERE id = :id');
        $stmt->execute([':id' => $id]);

        return $stmt->rowCount() > 0;
    }
}
