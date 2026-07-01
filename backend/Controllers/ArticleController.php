<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/BaseController.php';
require_once __DIR__ . '/../Models/Article.php';

/**
 * Controller ArticleController — CRUD des articles/ressources bien-être.
 *
 * Endpoints REST :
 *   GET    /api/articles       → ArticleController::index()
 *   GET    /api/articles/{id}  → ArticleController::show(int $id)
 *   POST   /api/articles       → ArticleController::store()
 *   PUT    /api/articles/{id}  → ArticleController::update(int $id)
 *   DELETE /api/articles/{id}  → ArticleController::destroy(int $id)
 *
 * Politique d'accès :
 *   - GET   : tous les rôles authentifiés (collaborateur, manager, rh, admin).
 *   - POST, PUT, DELETE : rôles 'admin' et 'rh' uniquement.
 */
class ArticleController extends BaseController
{
    private const MSG_NOT_FOUND = self::MSG_NOT_FOUND;
    private Article $model;

    /**
     * Instancie le modèle Article.
     */
    public function __construct()
    {
        $this->model = new Article();
    }

    // ----------------------------------------------------------------
    // GET /api/articles
    // ----------------------------------------------------------------

    /**
     * Retourne la liste de tous les articles.
     * Accessible à tous les rôles authentifiés.
     *
     * @return void
     */
    public function index(): void
    {
        Auth::requireAuth();

        $articles = $this->model->findAll();

        $this->respond(200, 'success', $articles, 'Articles fetched successfully.');
    }

    // ----------------------------------------------------------------
    // GET /api/articles/{id}
    // ----------------------------------------------------------------

    /**
     * Retourne un article par son identifiant.
     * Accessible à tous les rôles authentifiés.
     *
     * @param int $id
     *
     * @return void
     */
    public function show(int $id): void
    {
        Auth::requireAuth();

        $article = $this->model->findById($id);

        if ($article === null) {
            $this->respond(404, 'error', null, self::MSG_NOT_FOUND);
        }

        $this->respond(200, 'success', $article, 'Article fetched successfully.');
    }

    // ----------------------------------------------------------------
    // POST /api/articles
    // ----------------------------------------------------------------

    /**
     * Crée un nouvel article.
     * Réservé aux rôles 'admin' et 'rh'.
     *
     * Corps JSON attendu :
     *   { "title": "...", "content": "..." }
     *
     * @return void
     */
    public function store(): void
    {
        Auth::requireRole('admin', 'rh');

        $body    = $this->getJsonBody();
        $title   = trim($body['title']   ?? '');
        $content = trim($body['content'] ?? '');

        if ($title === '' || $content === '') {
            $this->respond(400, 'error', null, 'Title and content are required.');
        }

        $authorId = Auth::userId();

        try {
            $id = $this->model->create($title, $content, $authorId);
        } catch (RuntimeException $e) {
            $this->respond(500, 'error', null, 'Article creation failed. Please try again.');
        }

        $this->respond(201, 'success', ['id' => $id], 'Article created successfully.');
    }

    // ----------------------------------------------------------------
    // PUT /api/articles/{id}
    // ----------------------------------------------------------------

    /**
     * Met à jour un article existant.
     * Réservé aux rôles 'admin' et 'rh'.
     *
     * Corps JSON attendu :
     *   { "title": "...", "content": "..." }
     *
     * @param int $id
     *
     * @return void
     */
    public function update(int $id): void
    {
        Auth::requireRole('admin', 'rh');

        $body    = $this->getJsonBody();
        $title   = trim($body['title']   ?? '');
        $content = trim($body['content'] ?? '');

        if ($title === '' || $content === '') {
            $this->respond(400, 'error', null, 'Title and content are required.');
        }

        if ($this->model->findById($id) === null) {
            $this->respond(404, 'error', null, self::MSG_NOT_FOUND);
        }

        $updated = $this->model->update($id, $title, $content);

        $this->respond(200, 'success', ['updated' => $updated], 'Article updated successfully.');
    }

    // ----------------------------------------------------------------
    // DELETE /api/articles/{id}
    // ----------------------------------------------------------------

    /**
     * Supprime un article par son identifiant.
     * Réservé aux rôles 'admin' et 'rh'.
     *
     * @param int $id
     *
     * @return void
     */
    public function destroy(int $id): void
    {
        Auth::requireRole('admin', 'rh');

        if ($this->model->findById($id) === null) {
            $this->respond(404, 'error', null, self::MSG_NOT_FOUND);
        }

        $deleted = $this->model->deleteById($id);

        $this->respond(200, 'success', ['deleted' => $deleted], 'Article deleted successfully.');
    }
}
