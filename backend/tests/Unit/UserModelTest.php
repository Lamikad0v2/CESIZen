<?php
declare(strict_types=1);

use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Tests unitaires du modèle User.
 * Couvre : création, lecture, mise à jour, suppression, contraintes.
 */
class UserModelTest extends DatabaseTestCase
{
    private User $model;

    protected function setUp(): void
    {
        parent::setUp();
        $this->model = new User();
    }

    // ── CREATE ──────────────────────────────────────────────────────

    #[Test]
    public function createReturnsPositiveIntegerId(): void
    {
        // Arrange / Act
        $id = $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');

        // Assert
        $this->assertIsInt($id);
        $this->assertGreaterThan(0, $id);
    }

    #[Test]
    public function createHashesPasswordWithArgon2id(): void
    {
        // Arrange
        $plain = 'Password1!';

        // Act
        $this->model->create('Dupont', 'Alice', 'alice@test.fr', $plain);
        $user = $this->model->findByEmail('alice@test.fr');

        // Assert — le hash Argon2id est différent du mot de passe en clair
        $this->assertNotEquals($plain, $user['mot_de_passe']);
        $this->assertTrue(password_verify($plain, $user['mot_de_passe']));
    }

    #[Test]
    public function createThrowsExceptionOnDuplicateEmail(): void
    {
        // Arrange
        $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');

        // Assert + Act
        $this->expectException(PDOException::class);
        $this->model->create('Martin', 'Bob', 'alice@test.fr', 'Password1!');
    }

    #[Test]
    public function createDefaultRoleIsCollaborateur(): void
    {
        // Act
        $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');
        $user = $this->model->findByEmail('alice@test.fr');

        // Assert
        $this->assertEquals('collaborateur', $user['role']);
    }

    // ── FIND BY EMAIL ───────────────────────────────────────────────

    #[Test]
    public function findByEmailReturnsCorrectUser(): void
    {
        // Arrange
        $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');

        // Act
        $user = $this->model->findByEmail('alice@test.fr');

        // Assert
        $this->assertEquals('Dupont', $user['nom']);
        $this->assertEquals('Alice',  $user['prenom']);
    }

    #[Test]
    public function findByEmailReturnsNullForUnknownEmail(): void
    {
        // Act + Assert
        $this->assertNull($this->model->findByEmail('nobody@test.fr'));
    }

    #[Test]
    public function findByEmailIncludesPasswordHashForAuth(): void
    {
        // Arrange
        $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');

        // Act
        $user = $this->model->findByEmail('alice@test.fr');

        // Assert — findByEmail retourne le hash (nécessaire pour login)
        $this->assertArrayHasKey('mot_de_passe', $user);
    }

    // ── FIND ALL ────────────────────────────────────────────────────

    #[Test]
    public function findAllReturnsAllUsers(): void
    {
        // Arrange
        $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');
        $this->model->create('Martin', 'Bob',   'bob@test.fr',   'Password1!');

        // Act
        $users = $this->model->findAll();

        // Assert
        $this->assertCount(2, $users);
    }

    #[Test]
    public function findAllDoesNotExposePasswordHash(): void
    {
        // Arrange
        $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');

        // Act
        $users = $this->model->findAll();

        // Assert — sécurité : le hash ne doit jamais être exposé dans la liste
        $this->assertArrayNotHasKey('mot_de_passe', $users[0]);
    }

    #[Test]
    public function findAllIncludesTeamName(): void
    {
        // Arrange
        $teamId = $this->insertTeam('Développement');
        $this->insertUser('collab@test.fr', 'collaborateur', $teamId);

        // Act
        $users = $this->model->findAll();

        // Assert
        $this->assertEquals('Développement', $users[0]['nom_equipe']);
    }

    // ── FIND BY ID ──────────────────────────────────────────────────

    #[Test]
    public function findByIdReturnsCorrectUser(): void
    {
        // Arrange
        $id = $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');

        // Act
        $user = $this->model->findById($id);

        // Assert
        $this->assertEquals($id,      $user['id']);
        $this->assertEquals('Dupont', $user['nom']);
    }

    #[Test]
    public function findByIdReturnsNullForUnknownId(): void
    {
        // Act + Assert
        $this->assertNull($this->model->findById(9999));
    }

    #[Test]
    public function findByIdDoesNotExposePasswordHash(): void
    {
        // Arrange
        $id = $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');

        // Act
        $user = $this->model->findById($id);

        // Assert
        $this->assertArrayNotHasKey('mot_de_passe', $user);
    }

    // ── UPDATE ROLE AND TEAM ────────────────────────────────────────

    #[Test]
    public function updateRoleAndTeamChangesRole(): void
    {
        // Arrange
        $id = $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');

        // Act
        $this->model->updateRoleAndTeam($id, 'manager', null);
        $user = $this->model->findById($id);

        // Assert
        $this->assertEquals('manager', $user['role']);
    }

    #[Test]
    public function updateRoleAndTeamSetsTeamIdToNull(): void
    {
        // Arrange
        $teamId = $this->insertTeam();
        $id     = $this->insertUser('alice@test.fr', 'collaborateur', $teamId);

        // Act
        $this->model->updateRoleAndTeam($id, 'collaborateur', null);
        $user = $this->model->findById($id);

        // Assert
        $this->assertNull($user['team_id']);
    }

    #[Test]
    public function updateRoleAndTeamThrows422ForInvalidTeamId(): void
    {
        // Arrange
        $id = $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');

        // Assert + Act
        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(422);
        $this->model->updateRoleAndTeam($id, 'collaborateur', 9999);
    }

    // ── DELETE ──────────────────────────────────────────────────────

    #[Test]
    public function deleteByIdRemovesUser(): void
    {
        // Arrange
        $id = $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');

        // Act
        $this->model->deleteById($id);

        // Assert
        $this->assertNull($this->model->findById($id));
    }

    #[Test]
    public function deleteByIdReturnsTrueOnSuccess(): void
    {
        // Arrange
        $id = $this->model->create('Dupont', 'Alice', 'alice@test.fr', 'Password1!');

        // Act + Assert
        $this->assertTrue($this->model->deleteById($id));
    }

    #[Test]
    public function deleteByIdReturnsFalseForUnknownId(): void
    {
        // Act + Assert
        $this->assertFalse($this->model->deleteById(9999));
    }
}
