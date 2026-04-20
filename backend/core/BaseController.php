<?php
declare(strict_types=1);

/**
 * BaseController — Classe de base pour tous les contrôleurs HTTP.
 *
 * Centralise les helpers de sérialisation JSON et de lecture du corps
 * de la requête, évitant toute duplication entre contrôleurs (DRY).
 *
 * Les contrôleurs héritent de cette classe mais ne sont pas obligés
 * d'appeler un constructeur parent : elle ne contient que des méthodes
 * utilitaires sans état. Conforme au principe SRP — les contrôleurs
 * délèguent la mécanique HTTP à la classe de base et ne gèrent que
 * leur logique métier propre.
 */
abstract class BaseController
{
    /**
     * Décode le corps JSON de la requête entrante.
     *
     * @return array<string, mixed>
     */
    protected function getJsonBody(): array
    {
        $raw  = file_get_contents('php://input');
        $data = json_decode($raw ?: '', true);

        return is_array($data) ? $data : [];
    }

    /**
     * Émet une réponse JSON standardisée et termine l'exécution.
     *
     * Format de réponse uniforme :
     *   { "status": "success"|"error", "data": ..., "message": "..." }
     *
     * @param int                                          $httpCode
     * @param string                                       $status    'success' ou 'error'
     * @param array<string,mixed>|array<int,mixed>|null   $data
     * @param string                                       $message
     *
     * @return never
     */
    protected function respond(
        int $httpCode,
        string $status,
        array|null $data,
        string $message
    ): never {
        http_response_code($httpCode);
        echo json_encode([
            'status'  => $status,
            'data'    => $data,
            'message' => $message,
        ]);
        exit;
    }
}
