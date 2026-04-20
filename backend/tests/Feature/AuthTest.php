<?php
declare(strict_types=1);

use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * Tests du module Auth — contrôle d'accès par rôle et session.
 *
 * Le hook Auth::enableThrowOnAbort() est utilisé pour que abort()
 * lève une RuntimeException au lieu d'appeler exit(), permettant
 * de tester les cas de refus sans tuer le processus PHPUnit.
 */
class AuthTest extends TestCase
{
    protected function setUp(): void
    {
        Auth::enableThrowOnAbort();

        // Démarrer la session EN PREMIER pour que $_SESSION persiste
        // quand Auth::requireAuth() appellera session_start() (idempotent si déjà active).
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $_SESSION = []; // Tableau vide = utilisateur non connecté
    }

    protected function tearDown(): void
    {
        Auth::disableThrowOnAbort();
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }

    // ── userId() ────────────────────────────────────────────────────

    #[Test]
    public function userIdReturnsZeroWhenNoSession(): void
    {
        $this->assertEquals(0, Auth::userId());
    }

    #[Test]
    public function userIdReturnsCorrectIdFromSession(): void
    {
        $_SESSION['user_id'] = 42;
        $this->assertEquals(42, Auth::userId());
    }

    // ── requireAuth() ───────────────────────────────────────────────

    #[Test]
    public function requireAuthThrows401WhenNoSessionUserId(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(401);
        Auth::requireAuth();
    }

    #[Test]
    public function requireAuthPassesWhenSessionHasUserId(): void
    {
        $_SESSION['user_id'] = 1;

        // Ne doit pas lever d'exception
        Auth::requireAuth();
        $this->assertTrue(true); // Si on arrive ici, le test passe
    }

    // ── requireRole() ───────────────────────────────────────────────

    #[Test]
    public function requireRoleThrows403WhenRoleInsufficient(): void
    {
        $_SESSION['user_id'] = 1;
        $_SESSION['role']    = 'collaborateur';

        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(403);
        Auth::requireRole('admin');
    }

    #[Test]
    public function requireRolePassesWhenRoleMatches(): void
    {
        $_SESSION['user_id'] = 1;
        $_SESSION['role']    = 'admin';

        Auth::requireRole('admin');
        $this->assertTrue(true);
    }

    #[Test]
    public function requireRoleAcceptsMultipleAllowedRoles(): void
    {
        $_SESSION['user_id'] = 1;
        $_SESSION['role']    = 'rh';

        // Le rôle 'rh' doit passer quand les deux sont autorisés
        Auth::requireRole('admin', 'rh');
        $this->assertTrue(true);
    }

    #[Test]
    public function requireRoleThrows403ForRhTryingToAccessManagerRoute(): void
    {
        $_SESSION['user_id'] = 1;
        $_SESSION['role']    = 'rh';

        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(403);
        Auth::requireRole('manager'); // rh ne peut pas accéder aux routes manager
    }
}
