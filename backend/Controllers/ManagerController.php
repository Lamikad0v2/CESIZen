<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/BaseController.php';
require_once __DIR__ . '/../Models/Mood.php';
require_once __DIR__ . '/../Models/User.php';

/**
 * Controller ManagerController — Vue d'équipe anonymisée pour les managers.
 *
 * Endpoints REST :
 *   GET /api/manager/team-mood → ManagerController::teamMood()
 *
 * ACCÈS RESTREINT : rôle 'manager' uniquement.
 *
 * Anonymisation : seules des moyennes agrégées sont exposées.
 * Aucune donnée individuelle (score, commentaire) n'est transmise.
 * Le team_id est lu depuis le profil DB du manager connecté — aucun
 * paramètre client ne peut influer sur le périmètre des données.
 */
class ManagerController extends BaseController
{
    private Mood $moodModel;
    private User $userModel;

    public function __construct()
    {
        $this->moodModel = new Mood();
        $this->userModel = new User();
    }

    // ----------------------------------------------------------------
    // GET /api/manager/team-mood
    // ----------------------------------------------------------------

    /**
     * Retourne la moyenne d'humeur quotidienne anonymisée de l'équipe
     * du manager connecté sur les 7 derniers jours.
     *
     * Format de réponse : fenêtre normalisée de 7 entrées (J-6 → J).
     * Les jours sans aucune saisie ont avg_score = null et nb_saisies = 0.
     *
     * Codes d'erreur :
     *   401 — non authentifié.
     *   403 — rôle insuffisant.
     *   422 — le manager n'est affecté à aucune équipe.
     *
     * @return void
     */
    public function teamMood(): void
    {
        Auth::requireRole('manager');

        $managerId = Auth::userId();
        $manager   = $this->userModel->findById($managerId);

        // Vérifie que le manager appartient à une équipe
        if ($manager === null || $manager['team_id'] === null) {
            $this->respond(
                422,
                'error',
                null,
                'You are not assigned to any team. Contact an administrator.'
            );
        }

        $teamId  = (int) $manager['team_id'];
        $entries = $this->moodModel->findTeamAverageLastSevenDays($teamId);

        // Indexation par date pour lookup O(1)
        $indexed = [];
        foreach ($entries as $entry) {
            $indexed[$entry['date_humeur']] = [
                'avg_valence' => $entry['avg_valence'] !== null ? (float) $entry['avg_valence'] : null,
                'avg_arousal' => $entry['avg_arousal'] !== null ? (float) $entry['avg_arousal'] : null,
                'nb_saisies'  => (int) $entry['nb_saisies'],
            ];
        }

        // Normalisation : fenêtre 7 jours complète (J-6 → J)
        $history = [];
        for ($daysAgo = 6; $daysAgo >= 0; $daysAgo--) {
            $date      = date('Y-m-d', strtotime("-{$daysAgo} days"));
            $history[] = [
                'date'        => $date,
                'avg_valence' => $indexed[$date]['avg_valence'] ?? null,
                'avg_arousal' => $indexed[$date]['avg_arousal'] ?? null,
                'nb_saisies'  => $indexed[$date]['nb_saisies']  ?? 0,
            ];
        }

        $this->respond(200, 'success', $history, 'Team mood retrieved successfully.');
    }
}
