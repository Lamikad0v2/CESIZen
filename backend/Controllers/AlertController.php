<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/BaseController.php';
require_once __DIR__ . '/../Models/Alert.php';

/**
 * Controller AlertController — Consultation et gestion des alertes burn-out.
 *
 * Endpoints REST :
 *   GET /api/admin/alerts            → AlertController::index()
 *   PUT /api/admin/alerts/{id}/read  → AlertController::markRead(int $id)
 *
 * ACCÈS RESTREINT : rôles 'admin' et 'rh' uniquement.
 */
class AlertController extends BaseController
{
    private Alert $alertModel;

    public function __construct()
    {
        $this->alertModel = new Alert();
    }

    // ----------------------------------------------------------------
    // GET /api/admin/alerts
    // ----------------------------------------------------------------

    /**
     * Retourne toutes les alertes burn-out avec les infos utilisateur.
     * Les non-lues apparaissent en premier.
     *
     * @return void
     */
    public function index(): void
    {
        Auth::requireRole('admin', 'rh');

        $alerts = $this->alertModel->findAll();

        $this->respond(200, 'success', $alerts, 'Alerts retrieved successfully.');
    }

    // ----------------------------------------------------------------
    // PUT /api/admin/alerts/{id}/read
    // ----------------------------------------------------------------

    /**
     * Marque une alerte comme lue.
     *
     * @param int $id  ID de l'alerte, extrait de l'URL par le routeur.
     *
     * @return void
     */
    public function markRead(int $id): void
    {
        Auth::requireRole('admin', 'rh');

        $updated = $this->alertModel->markAsRead($id);

        if (!$updated) {
            $this->respond(404, 'error', null, 'Alert not found.');
        }

        $this->respond(200, 'success', null, 'Alert marked as read.');
    }
}
