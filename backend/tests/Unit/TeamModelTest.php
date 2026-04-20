<?php
declare(strict_types=1);

use PHPUnit\Framework\Attributes\Test;

/**
 * Tests unitaires du modèle Team.
 * Couvre : CRUD complet, comptage des membres, contraintes d'unicité.
 */
class TeamModelTest extends DatabaseTestCase
{
    private Team $model;

    protected function setUp(): void
    {
        parent::setUp();
        $this->model = new Team();
    }

    // ── CREATE ──────────────────────────────────────────────────────

    #[Test]
    public function createReturnsPositiveId(): void
    {
        $id = $this->model->create('Développement');
        $this->assertGreaterThan(0, $id);
    }

    #[Test]
    public function createThrows409OnDuplicateName(): void
    {
        $this->model->create('Développement');
        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(409);
        $this->model->create('Développement');
    }

    // ── FIND ALL ────────────────────────────────────────────────────

    #[Test]
    public function findAllReturnsAllTeams(): void
    {
        $this->model->create('Développement');
        $this->model->create('Marketing');

        $teams = $this->model->findAll();
        $this->assertCount(2, $teams);
    }

    #[Test]
    public function findAllIncludesNombreMembresField(): void
    {
        $this->model->create('Développement');

        $teams = $this->model->findAll();
        $this->assertArrayHasKey('nombre_membres', $teams[0]);
    }

    #[Test]
    public function findAllMemberCountIsZeroForEmptyTeam(): void
    {
        $this->model->create('Développement');

        $teams = $this->model->findAll();
        $this->assertEquals(0, (int) $teams[0]['nombre_membres']);
    }

    #[Test]
    public function findAllMemberCountReflectsActualMembers(): void
    {
        // Arrange
        $teamId = $this->model->create('Développement');
        $this->insertUser('collab1@test.fr', 'collaborateur', $teamId);
        $this->insertUser('collab2@test.fr', 'collaborateur', $teamId);

        // Act
        $teams = $this->model->findAll();

        // Assert
        $this->assertEquals(2, (int) $teams[0]['nombre_membres']);
    }

    #[Test]
    public function findAllOrderedAlphabetically(): void
    {
        $this->model->create('Marketing');
        $this->model->create('Développement');

        $teams = $this->model->findAll();
        // Note : 'D' < 'M' en UTF8 unicode
        $this->assertEquals('Développement', $teams[0]['nom_equipe']);
    }

    // ── FIND BY ID ──────────────────────────────────────────────────

    #[Test]
    public function findByIdReturnsCorrectTeam(): void
    {
        $id = $this->model->create('Développement');

        $team = $this->model->findById($id);
        $this->assertEquals('Développement', $team['nom_equipe']);
    }

    #[Test]
    public function findByIdReturnsNullForUnknownId(): void
    {
        $this->assertNull($this->model->findById(9999));
    }

    // ── UPDATE ──────────────────────────────────────────────────────

    #[Test]
    public function updateChangesTeamName(): void
    {
        $id = $this->model->create('Ancien Nom');
        $this->model->update($id, 'Nouveau Nom');

        $team = $this->model->findById($id);
        $this->assertEquals('Nouveau Nom', $team['nom_equipe']);
    }

    #[Test]
    public function updateThrows409OnDuplicateName(): void
    {
        $id1 = $this->model->create('Équipe A');
        $this->model->create('Équipe B');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(409);
        $this->model->update($id1, 'Équipe B');
    }

    // ── DELETE ──────────────────────────────────────────────────────

    #[Test]
    public function deleteRemovesTeam(): void
    {
        $id = $this->model->create('À supprimer');
        $this->model->delete($id);

        $this->assertNull($this->model->findById($id));
    }

    #[Test]
    public function deleteReturnsTrueOnSuccess(): void
    {
        $id = $this->model->create('À supprimer');
        $this->assertTrue($this->model->delete($id));
    }

    #[Test]
    public function deleteSetsUserTeamIdToNull(): void
    {
        // Arrange — utilisateur affecté à l'équipe
        $teamId = $this->model->create('Équipe Test');
        $userId = $this->insertUser('collab@test.fr', 'collaborateur', $teamId);

        // Act — suppression de l'équipe
        $this->model->delete($teamId);

        // Assert — le collaborateur existe toujours mais sans équipe
        $userModel = new User();
        $user      = $userModel->findById($userId);
        $this->assertNotNull($user);
        $this->assertNull($user['team_id']);
    }
}
