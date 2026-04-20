<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/BaseController.php';
require_once __DIR__ . '/../Models/User.php';

/**
 * Controller AccountController — Gestion du compte de l'utilisateur connecté.
 *
 * Endpoint REST :
 *   DELETE /api/account → AccountController::deleteAccount()
 *
 * Conformité RGPD (art. 17 — Droit à l'effacement) :
 *   La suppression est en cascade : l'utilisateur, ses humeurs et ses alertes
 *   sont définitivement effacés grâce aux contraintes FK ON DELETE CASCADE.
 *   Le user_id est lu exclusivement depuis la session — il est impossible
 *   de supprimer le compte d'un autre utilisateur (protection IDOR).
 */
class AccountController extends BaseController
{
    private User $userModel;

    public function __construct()
    {
        $this->userModel = new User();
    }

    // ----------------------------------------------------------------
    // DELETE /api/account
    // ----------------------------------------------------------------

    /**
     * Supprime définitivement le compte de l'utilisateur connecté
     * ainsi que toutes ses données associées (humeurs, alertes).
     *
     * Sécurité :
     *   - Requiert une session active (401 sinon).
     *   - Le user_id est tiré de la session, jamais du corps de la requête.
     *   - La session est détruite après suppression (invalide les cookies).
     *
     * @return void
     */
    // ----------------------------------------------------------------
    // PUT /api/account/profile
    // ----------------------------------------------------------------

    /**
     * Met à jour le prénom, le nom et optionnellement le mot de passe
     * de l'utilisateur connecté.
     *
     * Sécurité :
     *   - user_id depuis la session uniquement (protection IDOR).
     *   - Validation regex côté serveur (miroir du frontend).
     *   - Hashage Argon2id si un nouveau mot de passe est fourni.
     */
    public function updateProfile(): never
    {
        Auth::requireAuth();
        $userId = Auth::userId();
        $body   = $this->getJsonBody();

        $prenom = trim($body['prenom'] ?? '');
        $nom    = trim($body['nom']    ?? '');
        $mdp    = $body['mot_de_passe'] ?? null;

        // Validation des noms
        if (!preg_match('/^[\p{L}\s\-]{2,}$/u', $prenom)) {
            $this->respond(422, 'error', null, 'Prénom invalide (lettres, espaces, tirets, min. 2 caractères).');
        }
        if (!preg_match('/^[\p{L}\s\-]{2,}$/u', $nom)) {
            $this->respond(422, 'error', null, 'Nom invalide (lettres, espaces, tirets, min. 2 caractères).');
        }

        // Hashage si nouveau mot de passe fourni
        $hashedPassword = null;
        if ($mdp !== null && $mdp !== '') {
            if (
                strlen($mdp) < 8 ||
                !preg_match('/[A-Z]/', $mdp) ||
                !preg_match('/[0-9]/', $mdp) ||
                !preg_match('/[\W_]/', $mdp)
            ) {
                $this->respond(422, 'error', null, 'Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 1 chiffre et 1 caractère spécial.');
            }
            $hashedPassword = password_hash($mdp, PASSWORD_ARGON2ID);
        }

        $this->userModel->updateProfile($userId, $nom, $prenom, $hashedPassword);

        $this->respond(200, 'success', ['prenom' => $prenom, 'nom' => $nom], 'Profil mis à jour avec succès.');
    }

    // ----------------------------------------------------------------
    // DELETE /api/account
    // ----------------------------------------------------------------

    public function deleteAccount(): void
    {
        Auth::requireAuth();

        $userId = Auth::userId();

        // Suppression en cascade via FK :
        // moods.user_id (ON DELETE CASCADE) + alerts.user_id_concerne (ON DELETE CASCADE)
        $this->userModel->deleteById($userId);

        // Invalider la session PHP pour que le cookie de session existant
        // ne puisse plus être réutilisé après la suppression du compte.
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }
        session_destroy();

        $this->respond(
            200,
            'success',
            null,
            'Your account and all associated data have been permanently deleted.'
        );
    }
}
