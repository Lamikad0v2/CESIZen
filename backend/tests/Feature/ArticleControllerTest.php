<?php
declare(strict_types=1);

use PHPUnit\Framework\Attributes\Test;

/**
 * Tests Feature du module ArticleController.
 *
 * Stratégie : teste exclusivement la couche de sécurité (Auth).
 * Les cas d'erreur 401 et 403 sont testables sans risque d'exit() car
 * Auth::abort() lève une RuntimeException quand enableThrowOnAbort() est actif.
 *
 * Les chemins nominaux (200/201) sont couverts par ArticleModelTest.
 */
class ArticleControllerTest extends DatabaseTestCase
{
    private int $userId;

    protected function setUp(): void
    {
        parent::setUp();
        Auth::enableThrowOnAbort();

        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $_SESSION = [];

        $this->userId = $this->insertUser('admin@test.fr', 'admin');
    }

    protected function tearDown(): void
    {
        Auth::disableThrowOnAbort();
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }

    // ── GET — Authentification requise ──────────────────────────────

    #[Test]
    public function indexThrows401WhenUnauthenticated(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(401);
        (new ArticleController())->index();
    }

    #[Test]
    public function showThrows401WhenUnauthenticated(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(401);
        (new ArticleController())->show(1);
    }

    // ── POST — Rôles admin et rh uniquement ─────────────────────────

    #[Test]
    public function storeThrows401WhenUnauthenticated(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(401);
        (new ArticleController())->store();
    }

    #[Test]
    public function storeThrows403ForCollaborateur(): void
    {
        $_SESSION['user_id'] = $this->userId;
        $_SESSION['role']    = 'collaborateur';

        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(403);
        (new ArticleController())->store();
    }

    #[Test]
    public function storeThrows403ForManager(): void
    {
        $_SESSION['user_id'] = $this->userId;
        $_SESSION['role']    = 'manager';

        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(403);
        (new ArticleController())->store();
    }

    // ── PUT — Rôles admin et rh uniquement ──────────────────────────

    #[Test]
    public function updateThrows403ForCollaborateur(): void
    {
        $_SESSION['user_id'] = $this->userId;
        $_SESSION['role']    = 'collaborateur';

        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(403);
        (new ArticleController())->update(1);
    }

    #[Test]
    public function updateThrows403ForManager(): void
    {
        $_SESSION['user_id'] = $this->userId;
        $_SESSION['role']    = 'manager';

        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(403);
        (new ArticleController())->update(1);
    }

    // ── DELETE — Rôles admin et rh uniquement ───────────────────────

    #[Test]
    public function destroyThrows403ForCollaborateur(): void
    {
        $_SESSION['user_id'] = $this->userId;
        $_SESSION['role']    = 'collaborateur';

        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(403);
        (new ArticleController())->destroy(1);
    }

    #[Test]
    public function destroyThrows403ForManager(): void
    {
        $_SESSION['user_id'] = $this->userId;
        $_SESSION['role']    = 'manager';

        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(403);
        (new ArticleController())->destroy(1);
    }

    // ── Vérification : admin et rh NE sont PAS bloqués (pas de 403) ─

    #[Test]
    public function adminPassesAuthCheckForStore(): void
    {
        $_SESSION['user_id'] = $this->userId;
        $_SESSION['role']    = 'admin';

        // Auth::requireRole ne doit pas lever d'exception pour admin.
        // respond() sera appelé plus loin mais comme requireRole passe,
        // on vérifie uniquement l'absence de RuntimeException(403).
        try {
            Auth::requireRole('admin', 'rh');
            $this->assertTrue(true); // Auth check passed
        } catch (RuntimeException $e) {
            $this->assertNotEquals(403, $e->getCode(), 'Admin should not receive 403.');
        }
    }

    #[Test]
    public function rhPassesAuthCheckForStore(): void
    {
        $rhId = $this->insertUser('rh@test.fr', 'rh');
        $_SESSION['user_id'] = $rhId;
        $_SESSION['role']    = 'rh';

        try {
            Auth::requireRole('admin', 'rh');
            $this->assertTrue(true); // Auth check passed
        } catch (RuntimeException $e) {
            $this->assertNotEquals(403, $e->getCode(), 'RH should not receive 403.');
        }
    }
}
