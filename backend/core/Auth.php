<?php
declare(strict_types=1);

/**
 * Utilitaire Auth — Vérifications d'authentification et d'autorisation.
 *
 * Fournit des méthodes statiques réutilisables par tous les contrôleurs
 * sans nécessiter d'héritage. Conforme au principe OCP : les contrôleurs
 * existants ne sont pas modifiés pour bénéficier de ces fonctionnalités.
 *
 * Usage :
 *   Auth::requireRole('admin');           // 401 ou 403 sinon
 *   Auth::requireRole('admin', 'manager'); // accepte les deux rôles
 *   $id = Auth::userId();
 */
class Auth
{
    /**
     * En mode test, abort() lève une RuntimeException au lieu d'appeler exit().
     * Activer via Auth::enableThrowOnAbort() dans setUp() des tests,
     * désactiver via Auth::disableThrowOnAbort() dans tearDown().
     */
    private static bool $throwOnAbort = false;

    public static function enableThrowOnAbort(): void  { self::$throwOnAbort = true; }
    public static function disableThrowOnAbort(): void { self::$throwOnAbort = false; }

    /**
     * S'assure qu'une session PHP valide est active.
     * Termine avec HTTP 401 si aucun utilisateur n'est authentifié.
     *
     * @return void
     */
    public static function requireAuth(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        if (empty($_SESSION['user_id'])) {
            self::abort(401, 'Authentication required. Please log in.');
        }
    }

    /**
     * S'assure que l'utilisateur connecté possède l'un des rôles requis.
     * Appelle requireAuth() en premier.
     * Termine avec HTTP 403 si le rôle est insuffisant.
     *
     * @param string ...$roles  Rôles autorisés (ex: 'admin', 'manager').
     *
     * @return void
     */
    public static function requireRole(string ...$roles): void
    {
        self::requireAuth();

        $userRole = $_SESSION['role'] ?? '';

        if (!in_array($userRole, $roles, true)) {
            self::abort(403, 'Access forbidden. Insufficient permissions.');
        }
    }

    /**
     * Retourne l'ID de l'utilisateur connecté depuis la session.
     * Retourne 0 si aucune session n'est active.
     *
     * @return int
     */
    public static function userId(): int
    {
        return (int) ($_SESSION['user_id'] ?? 0);
    }

    // ----------------------------------------------------------------
    // Helpers privés
    // ----------------------------------------------------------------

    /**
     * Émet une réponse JSON d'erreur et termine l'exécution.
     *
     * @param int    $code
     * @param string $message
     *
     * @return never
     */
    private static function abort(int $code, string $message): never
    {
        http_response_code($code);
        echo json_encode(['status' => 'error', 'data' => null, 'message' => $message]);
        if (self::$throwOnAbort) {
            throw new RuntimeException("HTTP {$code}: {$message}", $code);
        }
        exit;
    }
}
