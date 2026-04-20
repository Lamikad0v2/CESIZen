<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/BaseController.php';
require_once __DIR__ . '/../Models/User.php';

/**
 * Controller AdminController — Gestion des utilisateurs (panel RH/Admin).
 *
 * Endpoints REST :
 *   GET    /api/admin/users       → AdminController::listUsers()
 *   PUT    /api/admin/users/{id}  → AdminController::updateUser(int $id)
 *   DELETE /api/admin/users/{id}  → AdminController::deleteUser(int $id)
 *
 * ACCÈS RESTREINT : toutes les méthodes exigent le rôle 'admin' ou 'rh'.
 * Protections métier supplémentaires :
 *   - Un admin/rh ne peut pas modifier son propre rôle.
 *   - Un admin/rh ne peut pas supprimer son propre compte.
 */
class AdminController extends BaseController
{
    private const ALLOWED_ROLES = ['collaborateur', 'manager', 'rh', 'admin'];

    private User $userModel;

    /**
     * Instancie le modèle User.
     */
    public function __construct()
    {
        $this->userModel = new User();
    }

    // ----------------------------------------------------------------
    // GET /api/admin/users
    // ----------------------------------------------------------------

    /**
     * Retourne la liste de tous les utilisateurs avec leur équipe.
     * Le mot de passe n'est jamais inclus dans la réponse.
     *
     * @return void
     */
    public function listUsers(): void
    {
        Auth::requireRole('admin', 'rh');

        $users = $this->userModel->findAll();

        $this->respond(200, 'success', $users, 'Users retrieved successfully.');
    }

    // ----------------------------------------------------------------
    // PUT /api/admin/users/{id}
    // ----------------------------------------------------------------

    /**
     * Met à jour le rôle et/ou l'équipe d'un utilisateur.
     *
     * Corps JSON attendu :
     *   { "role": "manager", "team_id": 3 }
     *   { "role": "collaborateur", "team_id": null }
     *
     * Règles de sécurité :
     *   - L'utilisateur connecté ne peut pas modifier son propre rôle.
     *   - role doit être une valeur ENUM valide.
     *   - team_id doit être présent dans le corps (null accepté = sans équipe).
     *
     * @param int $id  ID de l'utilisateur, extrait de l'URL par le routeur.
     *
     * @return void
     */
    public function updateUser(int $id): void
    {
        Auth::requireRole('admin', 'rh');

        $body = $this->getJsonBody();

        // --- Validation du rôle ---
        $role = $body['role'] ?? '';
        if (!in_array($role, self::ALLOWED_ROLES, true)) {
            $this->respond(
                400,
                'error',
                null,
                'Invalid role. Allowed values: ' . implode(', ', self::ALLOWED_ROLES) . '.'
            );
        }

        // --- Validation de team_id (le champ doit être présent, null est valide) ---
        if (!array_key_exists('team_id', $body)) {
            $this->respond(400, 'error', null, 'Field team_id is required (use null for no team).');
        }
        $teamId = $body['team_id'] !== null ? (int) $body['team_id'] : null;

        // --- Protection : impossibilité de changer son propre rôle ---
        if ($id === Auth::userId() && $role !== ($_SESSION['role'] ?? '')) {
            $this->respond(403, 'error', null, 'You cannot change your own role.');
        }

        // --- Vérification que l'utilisateur existe ---
        if ($this->userModel->findById($id) === null) {
            $this->respond(404, 'error', null, 'User not found.');
        }

        // --- Mise à jour ---
        try {
            $this->userModel->updateRoleAndTeam($id, $role, $teamId);
        } catch (RuntimeException $e) {
            if ($e->getCode() === 422) {
                $this->respond(422, 'error', null, 'Invalid team ID: team does not exist.');
            }
            $this->respond(500, 'error', null, 'Failed to update user. Please try again.');
        }

        $this->respond(200, 'success', null, 'User updated successfully.');
    }

    // ----------------------------------------------------------------
    // DELETE /api/admin/users/{id}
    // ----------------------------------------------------------------

    /**
     * Supprime un utilisateur.
     * La suppression en cascade (FK moods.user_id) efface également
     * toutes les entrées d'humeur associées.
     *
     * Protection : un utilisateur connecté ne peut pas supprimer son propre compte.
     *
     * @param int $id  ID de l'utilisateur, extrait de l'URL par le routeur.
     *
     * @return void
     */
    public function deleteUser(int $id): void
    {
        Auth::requireRole('admin', 'rh');

        if ($id === Auth::userId()) {
            $this->respond(403, 'error', null, 'You cannot delete your own account.');
        }

        $target = $this->userModel->findById($id);

        if ($target === null) {
            $this->respond(404, 'error', null, 'User not found.');
        }

        // Un utilisateur RH ne peut pas supprimer un compte Admin.
        if (($_SESSION['role'] ?? '') === 'rh' && $target['role'] === 'admin') {
            $this->respond(403, 'error', null, 'RH users cannot delete admin accounts.');
        }

        $this->userModel->deleteById($id);

        $this->respond(200, 'success', null, 'User deleted successfully.');
    }
}
