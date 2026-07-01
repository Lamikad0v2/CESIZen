<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/BaseController.php';
require_once __DIR__ . '/../Models/Mood.php';
require_once __DIR__ . '/../Models/Alert.php';

/**
 * Controller MoodController — Gère la soumission et la lecture des humeurs.
 *
 * Endpoints REST :
 *   POST /api/moods          → MoodController::store()
 *   GET  /api/moods          → MoodController::index()
 *   GET  /api/moods/history  → MoodController::history()
 *
 * Règle métier burn-out (store) :
 *   Si valence < 30 ET arousal < 30 et que les 2 jours précédents ont aussi
 *   valence < 30 ET arousal < 30, une alerte critique est insérée dans alerts.
 *   (Modèle Circomplexe de Russell : quadrant dépression/burn-out = bas/bas)
 */
class MoodController extends BaseController
{
    private Mood  $moodModel;
    private Alert $alertModel;

    public function __construct()
    {
        $this->moodModel  = new Mood();
        $this->alertModel = new Alert();
    }

    // ----------------------------------------------------------------
    // POST /api/moods
    // ----------------------------------------------------------------

    /**
     * Enregistre une nouvelle humeur pour l'utilisateur authentifié.
     *
     * Corps JSON attendu :
     *   {
     *     "valence":      1-100,              (obligatoire) dimension hédonique
     *     "arousal":      1-100,              (obligatoire) dimension d'activation
     *     "context_tags": ["Charge de travail"], (optionnel)
     *     "commentaire":  "..."               (optionnel)
     *   }
     *
     * Validations :
     *   - valence et arousal : présents, entiers, entre 1 et 100.
     *   - context_tags : tableau de strings, max 15 éléments.
     *   - commentaire ≤ 500 caractères.
     *   - Pas de double soumission le même jour.
     *
     * Règle burn-out :
     *   Si valence < 30 ET arousal < 30, et que les 2 jours précédents avaient
     *   aussi valence < 30 ET arousal < 30, insère une alerte (3ème jour consécutif).
     */
    public function store(): void // NOSONAR — validation complexity is inherent to the mood spec
    {
        Auth::requireAuth();

        $body        = $this->getJsonBody();
        $userId      = Auth::userId();
        $rawValence  = $body['valence']      ?? null;
        $rawArousal  = $body['arousal']      ?? null;
        $contextTags = $body['context_tags'] ?? null;
        $commentaire = isset($body['commentaire']) ? trim((string) $body['commentaire']) : null;

        // --- 1. Présence de la valence ---
        if ($rawValence === null) {
            $this->respond(400, 'error', null, 'valence is required.');
        }

        // --- 2. Valence doit être un entier entre 1 et 100 ---
        if (!is_numeric($rawValence) || (int) $rawValence != $rawValence) {
            $this->respond(400, 'error', null, 'valence must be an integer.');
        }

        $valence = (int) $rawValence;

        if ($valence < 1 || $valence > 100) {
            $this->respond(400, 'error', null, 'valence must be between 1 and 100.');
        }

        // --- 3. Présence de l'arousal ---
        if ($rawArousal === null) {
            $this->respond(400, 'error', null, 'arousal is required.');
        }

        // --- 4. Arousal doit être un entier entre 1 et 100 ---
        if (!is_numeric($rawArousal) || (int) $rawArousal != $rawArousal) {
            $this->respond(400, 'error', null, 'arousal must be an integer.');
        }

        $arousal = (int) $rawArousal;

        if ($arousal < 1 || $arousal > 100) {
            $this->respond(400, 'error', null, 'arousal must be between 1 and 100.');
        }

        // --- 5. Validation context_tags ---
        if ($contextTags !== null) {
            if (!is_array($contextTags)) {
                $this->respond(400, 'error', null, 'context_tags must be an array.');
            }
            if (count($contextTags) > 15) {
                $this->respond(400, 'error', null, 'context_tags must not exceed 15 items.');
            }
            foreach ($contextTags as $tag) {
                if (!is_string($tag) || trim($tag) === '') {
                    $this->respond(400, 'error', null, 'context_tags items must be non-empty strings.');
                }
            }
        }

        // --- 6. Longueur du commentaire ---
        if ($commentaire !== null && mb_strlen($commentaire) > 500) {
            $this->respond(400, 'error', null, 'Comment must not exceed 500 characters.');
        }

        // --- 7. Vérification double soumission (garde applicative) ---
        if ($this->moodModel->findTodayByUserId($userId) !== null) {
            $this->respond(409, 'error', null, 'You have already submitted your mood for today.');
        }

        // --- 8. Insertion ---
        $moodId = 0;
        try {
            $moodId = $this->moodModel->create(
                $userId,
                $valence,
                $arousal,
                $contextTags ?: null,
                $commentaire ?: null
            );
        } catch (RuntimeException $e) {
            if ($e->getCode() === 409) {
                $this->respond(409, 'error', null, 'You have already submitted your mood for today.');
            }
            $this->respond(500, 'error', null, 'Failed to save mood. Please try again.');
        }

        // --- 9. Règle burn-out : détection 3 jours consécutifs en zone dépression ---
        if ($valence < 30 && $arousal < 30) {
            $this->checkAndCreateBurnoutAlert($userId);
        }

        $this->respond(201, 'success', ['id' => $moodId], 'Mood saved successfully.');
    }

    // ----------------------------------------------------------------
    // GET /api/moods
    // ----------------------------------------------------------------

    /**
     * Retourne l'historique complet des humeurs de l'utilisateur connecté.
     */
    public function index(): void
    {
        Auth::requireAuth();

        $userId = Auth::userId();
        $moods  = $this->moodModel->findAllByUserId($userId);

        $this->respond(200, 'success', $moods, 'Moods retrieved successfully.');
    }

    // ----------------------------------------------------------------
    // GET /api/moods/history
    // ----------------------------------------------------------------

    /**
     * Retourne une fenêtre normalisée de 7 jours pour le graphique d'évolution.
     *
     * Toujours 7 entrées (J-6 → J). Les jours sans humeur ont valence/arousal = null.
     */
    public function history(): void
    {
        Auth::requireAuth();

        $userId  = Auth::userId();
        $entries = $this->moodModel->findLastSevenDaysByUserId($userId);

        $indexed = [];
        foreach ($entries as $entry) {
            $indexed[$entry['date_humeur']] = [
                'valence'      => (int) $entry['valence'],
                'arousal'      => (int) $entry['arousal'],
                'context_tags' => $entry['context_tags'] ?? [],
                'commentaire'  => $entry['commentaire'],
            ];
        }

        $history = [];
        for ($daysAgo = 6; $daysAgo >= 0; $daysAgo--) {
            $date      = date('Y-m-d', strtotime("-{$daysAgo} days"));
            $history[] = [
                'date'         => $date,
                'valence'      => $indexed[$date]['valence']      ?? null,
                'arousal'      => $indexed[$date]['arousal']      ?? null,
                'context_tags' => $indexed[$date]['context_tags'] ?? [],
                'commentaire'  => $indexed[$date]['commentaire']  ?? null,
            ];
        }

        $this->respond(200, 'success', $history, 'History retrieved successfully.');
    }

    // ----------------------------------------------------------------
    // Helper privé — Détection burn-out (Modèle Circomplexe)
    // ----------------------------------------------------------------

    /**
     * Vérifie si les 2 jours précédents avaient aussi valence < 30 ET arousal < 30.
     * Si oui, insère une alerte critique dans la table `alerts`.
     *
     * La zone (valence < 30, arousal < 30) correspond au quadrant dépression/burn-out
     * du Modèle Circomplexe de Russell.
     *
     * @param int $userId
     */
    private function checkAndCreateBurnoutAlert(int $userId): void
    {
        $prevDays = $this->moodModel->findPreviousTwoDaysScoresByUserId($userId);

        if (
            count($prevDays) === 2
            && (int) $prevDays[0]['valence'] < 30
            && (int) $prevDays[0]['arousal'] < 30
            && (int) $prevDays[1]['valence'] < 30
            && (int) $prevDays[1]['arousal'] < 30
        ) {
            $this->alertModel->create(
                $userId,
                "Alerte burn-out : valence et activation inférieures à 30 enregistrées pendant 3 jours consécutifs."
            );
        }
    }
}
