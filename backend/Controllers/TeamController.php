<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/BaseController.php';
require_once __DIR__ . '/../Models/Team.php';

/**
 * Controller TeamController — CRUD complet sur la table `teams`.
 *
 * Endpoints REST :
 *   GET    /api/teams       → TeamController::index()
 *   POST   /api/teams       → TeamController::store()
 *   PUT    /api/teams/{id}  → TeamController::update(int $id)
 *   DELETE /api/teams/{id}  → TeamController::destroy(int $id)
 *
 * ACCÈS RESTREINT : toutes les méthodes exigent le rôle 'admin' ou 'rh'.
 * Toute tentative d'accès sans session valide ou avec un rôle
 * insuffisant retourne respectivement HTTP 401 ou 403.
 */
class TeamController extends BaseController
{
    private Team $teamModel;

    /**
     * Instancie le modèle Team.
     */
    public function __construct()
    {
        $this->teamModel = new Team();
    }

    // ----------------------------------------------------------------
    // GET /api/teams
    // ----------------------------------------------------------------

    /**
     * Retourne la liste de toutes les équipes avec leur nombre de membres.
     *
     * @return void
     */
    public function index(): void
    {
        Auth::requireRole('admin', 'rh');

        $teams = $this->teamModel->findAll();

        $this->respond(200, 'success', $teams, 'Teams retrieved successfully.');
    }

    // ----------------------------------------------------------------
    // POST /api/teams
    // ----------------------------------------------------------------

    /**
     * Crée une nouvelle équipe.
     *
     * Corps JSON attendu : { "nom_equipe": "..." }
     *
     * @return void
     */
    public function store(): void
    {
        Auth::requireRole('admin', 'rh');

        $body      = $this->getJsonBody();
        $nomEquipe = trim($body['nom_equipe'] ?? '');

        if ($nomEquipe === '') {
            $this->respond(400, 'error', null, 'Team name is required.');
        }

        if (mb_strlen($nomEquipe) > 150) {
            $this->respond(400, 'error', null, 'Team name must not exceed 150 characters.');
        }

        $teamId = 0;
        try {
            $teamId = $this->teamModel->create($nomEquipe);
        } catch (RuntimeException $e) {
            if ($e->getCode() === 409) {
                $this->respond(409, 'error', null, 'A team with this name already exists.');
            }
            $this->respond(500, 'error', null, 'Failed to create team. Please try again.');
        }

        $this->respond(201, 'success', ['id' => $teamId], 'Team created successfully.');
    }

    // ----------------------------------------------------------------
    // PUT /api/teams/{id}
    // ----------------------------------------------------------------

    /**
     * Met à jour le nom d'une équipe existante.
     *
     * Corps JSON attendu : { "nom_equipe": "..." }
     *
     * @param int $id  ID de l'équipe à modifier, extrait de l'URL par le routeur.
     *
     * @return void
     */
    public function update(int $id): void
    {
        Auth::requireRole('admin', 'rh');

        $body      = $this->getJsonBody();
        $nomEquipe = trim($body['nom_equipe'] ?? '');

        if ($nomEquipe === '') {
            $this->respond(400, 'error', null, 'Team name is required.');
        }

        if (mb_strlen($nomEquipe) > 150) {
            $this->respond(400, 'error', null, 'Team name must not exceed 150 characters.');
        }

        if ($this->teamModel->findById($id) === null) {
            $this->respond(404, 'error', null, 'Team not found.');
        }

        try {
            $this->teamModel->update($id, $nomEquipe);
        } catch (RuntimeException $e) {
            if ($e->getCode() === 409) {
                $this->respond(409, 'error', null, 'A team with this name already exists.');
            }
            $this->respond(500, 'error', null, 'Failed to update team. Please try again.');
        }

        $this->respond(200, 'success', null, 'Team updated successfully.');
    }

    // ----------------------------------------------------------------
    // DELETE /api/teams/{id}
    // ----------------------------------------------------------------

    /**
     * Supprime une équipe.
     * Les membres de l'équipe ne sont PAS supprimés : leur team_id
     * est mis à NULL grâce à la contrainte ON DELETE SET NULL.
     *
     * @param int $id  ID de l'équipe à supprimer, extrait de l'URL par le routeur.
     *
     * @return void
     */
    public function destroy(int $id): void
    {
        Auth::requireRole('admin', 'rh');

        if ($this->teamModel->findById($id) === null) {
            $this->respond(404, 'error', null, 'Team not found.');
        }

        $this->teamModel->delete($id);

        $this->respond(200, 'success', null, 'Team deleted successfully.');
    }
}
