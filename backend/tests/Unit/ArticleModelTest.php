<?php
declare(strict_types=1);

use PHPUnit\Framework\Attributes\Test;

/**
 * Tests unitaires du modèle Article.
 * Couvre : création, lecture, mise à jour, suppression, cascade.
 */
class ArticleModelTest extends DatabaseTestCase
{
    private Article $model;
    private int     $userId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->model  = new Article();
        $this->userId = $this->insertUser();
    }

    // ── CREATE ──────────────────────────────────────────────────────

    #[Test]
    public function createReturnsPositiveId(): void
    {
        $id = $this->model->create('Test Article', 'Some content here.', $this->userId);
        $this->assertGreaterThan(0, $id);
    }

    #[Test]
    public function createStoresCorrectTitle(): void
    {
        $this->model->create('Mon Article', 'Contenu de test.', $this->userId);
        $articles = $this->model->findAll();
        $this->assertEquals('Mon Article', $articles[0]['title']);
    }

    #[Test]
    public function createStoresCorrectContent(): void
    {
        $content = 'Contenu détaillé de l\'article bien-être.';
        $this->model->create('Article', $content, $this->userId);
        $articles = $this->model->findAll();
        $this->assertEquals($content, $articles[0]['content']);
    }

    #[Test]
    public function createWithInvalidAuthorThrowsRuntimeException(): void
    {
        $this->expectException(RuntimeException::class);
        $this->model->create('Article', 'Content', 9999);
    }

    // ── FIND ALL ────────────────────────────────────────────────────

    #[Test]
    public function findAllReturnsAllArticles(): void
    {
        $uid2 = $this->insertUser('other@test.fr');
        $this->model->create('Article 1', 'Content 1', $this->userId);
        $this->model->create('Article 2', 'Content 2', $uid2);

        $this->assertCount(2, $this->model->findAll());
    }

    #[Test]
    public function findAllJoinsAuthorInformation(): void
    {
        $this->model->create('Article', 'Content', $this->userId);
        $articles = $this->model->findAll();

        $this->assertArrayHasKey('author_nom',    $articles[0]);
        $this->assertArrayHasKey('author_prenom', $articles[0]);
    }

    #[Test]
    public function findAllOrdersByMostRecentFirst(): void
    {
        $id1 = $this->model->create('Premier', 'Content', $this->userId);
        $id2 = $this->model->create('Second',  'Content', $this->userId);

        $articles = $this->model->findAll();
        // L'article créé en dernier (id2) doit apparaître en premier (DESC)
        $this->assertEquals($id2, (int) $articles[0]['id']);
    }

    // ── FIND BY ID ──────────────────────────────────────────────────

    #[Test]
    public function findByIdReturnsCorrectArticle(): void
    {
        $id      = $this->model->create('Ressource Burn-Out', 'Contenu.', $this->userId);
        $article = $this->model->findById($id);

        $this->assertNotNull($article);
        $this->assertEquals('Ressource Burn-Out', $article['title']);
    }

    #[Test]
    public function findByIdReturnsNullForUnknownId(): void
    {
        $this->assertNull($this->model->findById(9999));
    }

    // ── UPDATE ──────────────────────────────────────────────────────

    #[Test]
    public function updateChangesArticleTitleAndContent(): void
    {
        $id = $this->model->create('Ancien Titre', 'Ancien contenu.', $this->userId);
        $this->model->update($id, 'Nouveau Titre', 'Nouveau contenu.');

        $article = $this->model->findById($id);
        $this->assertEquals('Nouveau Titre',    $article['title']);
        $this->assertEquals('Nouveau contenu.', $article['content']);
    }

    #[Test]
    public function updateReturnsTrueOnSuccess(): void
    {
        $id = $this->model->create('Titre', 'Contenu.', $this->userId);
        $this->assertTrue($this->model->update($id, 'Titre modifié', 'Contenu modifié.'));
    }

    #[Test]
    public function updateReturnsFalseForUnknownId(): void
    {
        $this->assertFalse($this->model->update(9999, 'Titre', 'Contenu.'));
    }

    // ── DELETE ──────────────────────────────────────────────────────

    #[Test]
    public function deleteByIdRemovesArticle(): void
    {
        $id = $this->model->create('À supprimer', 'Contenu.', $this->userId);
        $this->model->deleteById($id);
        $this->assertNull($this->model->findById($id));
    }

    #[Test]
    public function deleteByIdReturnsTrueOnSuccess(): void
    {
        $id = $this->model->create('À supprimer', 'Contenu.', $this->userId);
        $this->assertTrue($this->model->deleteById($id));
    }

    #[Test]
    public function deleteByIdReturnsFalseForUnknownId(): void
    {
        $this->assertFalse($this->model->deleteById(9999));
    }

    // ── CASCADE ─────────────────────────────────────────────────────

    #[Test]
    public function deletingAuthorCascadesToHisArticles(): void
    {
        $this->model->create('Article de l\'utilisateur', 'Contenu.', $this->userId);
        $this->assertCount(1, $this->model->findAll());

        (new User())->deleteById($this->userId);

        // La suppression en cascade via FK doit supprimer l'article
        $this->assertCount(0, $this->model->findAll());
    }
}
