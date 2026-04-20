<?php
declare(strict_types=1);

use PHPUnit\Framework\Attributes\Test;

/**
 * Tests unitaires du modèle Alert.
 * Couvre : création, lecture, marquage comme lu, cascade de suppression.
 */
class AlertModelTest extends DatabaseTestCase
{
    private Alert $model;
    private int   $userId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->model  = new Alert();
        $this->userId = $this->insertUser();
    }

    // ── CREATE ──────────────────────────────────────────────────────

    #[Test]
    public function createReturnsPositiveId(): void
    {
        $id = $this->model->create($this->userId, 'Test alerte');
        $this->assertGreaterThan(0, $id);
    }

    #[Test]
    public function newAlertIsUnreadByDefault(): void
    {
        $this->model->create($this->userId, 'Test alerte');
        $alerts = $this->model->findAll();

        $this->assertEquals(0, (int) $alerts[0]['is_read']);
    }

    #[Test]
    public function createStoresCorrectMessage(): void
    {
        $msg = 'Alerte burn-out critique';
        $this->model->create($this->userId, $msg);
        $alerts = $this->model->findAll();

        $this->assertEquals($msg, $alerts[0]['message']);
    }

    // ── FIND ALL ────────────────────────────────────────────────────

    #[Test]
    public function findAllReturnsAllAlerts(): void
    {
        $uid2 = $this->insertUser('other@test.fr');
        $this->model->create($this->userId, 'Alerte 1');
        $this->model->create($uid2,         'Alerte 2');

        $this->assertCount(2, $this->model->findAll());
    }

    #[Test]
    public function findAllJoinsUserInformation(): void
    {
        $this->model->create($this->userId, 'Test');
        $alerts = $this->model->findAll();

        $this->assertArrayHasKey('nom',    $alerts[0]);
        $this->assertArrayHasKey('prenom', $alerts[0]);
        $this->assertArrayHasKey('email',  $alerts[0]);
    }

    #[Test]
    public function findAllJoinsTeamName(): void
    {
        $teamId = $this->insertTeam('Support');
        $uid    = $this->insertUser('team@test.fr', 'collaborateur', $teamId);
        $this->model->create($uid, 'Alerte équipe');

        $alerts = $this->model->findAll();
        $this->assertEquals('Support', $alerts[0]['nom_equipe']);
    }

    #[Test]
    public function findAllOrdersUnreadBeforeRead(): void
    {
        // Arrange — créer deux alertes puis marquer la première comme lue
        $id1 = $this->model->create($this->userId,                   'Alerte 1');
        $uid2 = $this->insertUser('other@test.fr');
        $id2 = $this->model->create($uid2, 'Alerte 2');
        $this->model->markAsRead($id1);

        // Act
        $alerts = $this->model->findAll();

        // Assert — la non-lue (id2) doit être en premier
        $this->assertEquals(0, (int) $alerts[0]['is_read']); // non-lue en premier
        $this->assertEquals(1, (int) $alerts[1]['is_read']); // lue en second
    }

    // ── MARK AS READ ────────────────────────────────────────────────

    #[Test]
    public function markAsReadUpdatesIsReadFlag(): void
    {
        $id = $this->model->create($this->userId, 'Test');
        $this->model->markAsRead($id);

        $alerts = $this->model->findAll();
        $this->assertEquals(1, (int) $alerts[0]['is_read']);
    }

    #[Test]
    public function markAsReadReturnsTrueOnSuccess(): void
    {
        $id = $this->model->create($this->userId, 'Test');
        $this->assertTrue($this->model->markAsRead($id));
    }

    #[Test]
    public function markAsReadReturnsFalseForUnknownId(): void
    {
        $this->assertFalse($this->model->markAsRead(9999));
    }

    // ── CASCADE SUPPRESSION ─────────────────────────────────────────

    #[Test]
    public function deletingUserCascadesToHisAlerts(): void
    {
        // Arrange
        $this->model->create($this->userId, 'Test alerte');
        $this->assertCount(1, $this->model->findAll());

        // Act — suppression de l'utilisateur
        $userModel = new User();
        $userModel->deleteById($this->userId);

        // Assert — l'alerte est supprimée en cascade
        $this->assertCount(0, $this->model->findAll());
    }
}
