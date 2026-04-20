<?php
declare(strict_types=1);

use PHPUnit\Framework\Attributes\Test;

/**
 * Tests unitaires du modèle Mood (v3 — Modèle Circomplexe de Russell).
 *
 * Couvre : soumission, historique, double soumission, détection burn-out
 *          bidimensionnelle (valence < 30 ET arousal < 30), tags contexte,
 *          calcul des moyennes d'équipe.
 */
class MoodModelTest extends DatabaseTestCase
{
    private Mood $model;
    private int  $userId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->model  = new Mood();
        $this->userId = $this->insertUser();
    }

    // ── CREATE ──────────────────────────────────────────────────────

    #[Test]
    public function createReturnsPositiveId(): void
    {
        $id = $this->model->create($this->userId, 60, 70, null, null);
        $this->assertGreaterThan(0, $id);
    }

    #[Test]
    public function createInsertsCorrectValence(): void
    {
        $this->model->create($this->userId, 75, 60, null, null);
        $today = $this->model->findTodayByUserId($this->userId);

        $this->assertEquals(75, (int) $today['valence']);
    }

    #[Test]
    public function createInsertsCorrectArousal(): void
    {
        $this->model->create($this->userId, 75, 60, null, null);
        $today = $this->model->findTodayByUserId($this->userId);

        $this->assertEquals(60, (int) $today['arousal']);
    }

    #[Test]
    public function createInsertsNullableComment(): void
    {
        $this->model->create($this->userId, 60, 55, null, null);
        $today = $this->model->findTodayByUserId($this->userId);

        $this->assertNull($today['commentaire']);
    }

    #[Test]
    public function createInsertsCommentWhenProvided(): void
    {
        $this->model->create($this->userId, 50, 45, null, 'Journée difficile');
        $today = $this->model->findTodayByUserId($this->userId);

        $this->assertEquals('Journée difficile', $today['commentaire']);
    }

    #[Test]
    public function createInsertsContextTags(): void
    {
        $tags = ['Charge de travail', 'Management'];
        $this->model->create($this->userId, 40, 35, $tags, null);
        $rows = $this->model->findAllByUserId($this->userId);

        $this->assertEquals($tags, $rows[0]['context_tags']);
    }

    #[Test]
    public function createStoresEmptyContextTagsAsEmptyArray(): void
    {
        $this->model->create($this->userId, 60, 55, [], null);
        $rows = $this->model->findAllByUserId($this->userId);

        $this->assertIsArray($rows[0]['context_tags']);
        $this->assertEmpty($rows[0]['context_tags']);
    }

    #[Test]
    public function createThrows409OnDuplicateSameDayMood(): void
    {
        $this->model->create($this->userId, 70, 65, null, null);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(409);
        $this->model->create($this->userId, 50, 45, null, null);
    }

    // ── FIND TODAY ──────────────────────────────────────────────────

    #[Test]
    public function findTodayReturnsNullWhenNoMoodSubmitted(): void
    {
        $this->assertNull($this->model->findTodayByUserId($this->userId));
    }

    #[Test]
    public function findTodayReturnsMoodAfterSubmission(): void
    {
        $this->model->create($this->userId, 55, 60, null, null);
        $this->assertNotNull($this->model->findTodayByUserId($this->userId));
    }

    #[Test]
    public function findTodayIsIsolatedPerUser(): void
    {
        $userId2 = $this->insertUser('other@test.fr');
        $this->model->create($this->userId, 70, 65, null, null);

        $this->assertNull($this->model->findTodayByUserId($userId2));
    }

    // ── FIND LAST 7 DAYS ────────────────────────────────────────────

    #[Test]
    public function findLastSevenDaysReturnsOnlyCurrentWindowEntries(): void
    {
        $this->insertMood($this->userId, 70, 60, 0);
        $this->insertMood($this->userId, 55, 50, 2);
        $this->insertMood($this->userId, 90, 75, 5);

        $results = $this->model->findLastSevenDaysByUserId($this->userId);
        $this->assertCount(3, $results);
    }

    #[Test]
    public function findLastSevenDaysExcludesOlderEntries(): void
    {
        $this->insertMood($this->userId, 20, 15, 8);

        $results = $this->model->findLastSevenDaysByUserId($this->userId);
        $this->assertCount(0, $results);
    }

    #[Test]
    public function findLastSevenDaysDecodesJsonContextTags(): void
    {
        $this->insertMood($this->userId, 75, 65, 0, ['Management']);
        $results = $this->model->findLastSevenDaysByUserId($this->userId);

        $this->assertIsArray($results[0]['context_tags']);
        $this->assertContains('Management', $results[0]['context_tags']);
    }

    // ── FIND PREVIOUS TWO DAYS ──────────────────────────────────────

    #[Test]
    public function findPreviousTwoDaysReturnsEmptyArrayWhenNoPreviousMoods(): void
    {
        $results = $this->model->findPreviousTwoDaysScoresByUserId($this->userId);
        $this->assertEmpty($results);
    }

    #[Test]
    public function findPreviousTwoDaysReturnsBothDaysWhenPresent(): void
    {
        $this->insertMood($this->userId, 25, 20, 1); // hier
        $this->insertMood($this->userId, 15, 18, 2); // avant-hier

        $results = $this->model->findPreviousTwoDaysScoresByUserId($this->userId);
        $this->assertCount(2, $results);
    }

    #[Test]
    public function findPreviousTwoDaysOrderedDescendingByDate(): void
    {
        $this->insertMood($this->userId, 20, 30, 1); // hier → doit être [0]
        $this->insertMood($this->userId, 10, 25, 2); // avant-hier → doit être [1]

        $results = $this->model->findPreviousTwoDaysScoresByUserId($this->userId);

        $this->assertEquals(20, (int) $results[0]['valence']); // hier
        $this->assertEquals(10, (int) $results[1]['valence']); // avant-hier
    }

    #[Test]
    public function findPreviousTwoDaysExcludesToday(): void
    {
        $this->insertMood($this->userId, 10, 15, 0); // aujourd'hui
        $this->insertMood($this->userId, 20, 25, 1); // hier

        $results = $this->model->findPreviousTwoDaysScoresByUserId($this->userId);
        $this->assertCount(1, $results);
        $this->assertEquals(20, (int) $results[0]['valence']); // uniquement hier
    }

    // ── TEAM AVERAGE ────────────────────────────────────────────────

    #[Test]
    public function findTeamAverageReturnsEmptyArrayForTeamWithNoMoods(): void
    {
        $teamId  = $this->insertTeam();
        $results = $this->model->findTeamAverageLastSevenDays($teamId);
        $this->assertEmpty($results);
    }

    #[Test]
    public function findTeamAverageCalculatesCorrectMeanForSingleUser(): void
    {
        $teamId = $this->insertTeam();
        $uid    = $this->insertUser('collab@test.fr', 'collaborateur', $teamId);
        $this->insertMood($uid, 80, 70, 0);

        $results = $this->model->findTeamAverageLastSevenDays($teamId);

        $this->assertCount(1, $results);
        $this->assertEquals(80.0, (float) $results[0]['avg_valence']);
        $this->assertEquals(70.0, (float) $results[0]['avg_arousal']);
    }

    #[Test]
    public function findTeamAverageAggregatesMultipleUsersForSameDay(): void
    {
        $teamId = $this->insertTeam();
        $uid1   = $this->insertUser('c1@test.fr', 'collaborateur', $teamId);
        $uid2   = $this->insertUser('c2@test.fr', 'collaborateur', $teamId);
        $this->insertMood($uid1, 60, 50, 0);
        $this->insertMood($uid2, 40, 70, 0); // avg_valence = 50, avg_arousal = 60

        $results = $this->model->findTeamAverageLastSevenDays($teamId);

        $this->assertCount(1, $results);
        $this->assertEquals(50.0, (float) $results[0]['avg_valence']);
        $this->assertEquals(60.0, (float) $results[0]['avg_arousal']);
        $this->assertEquals(2,    (int)   $results[0]['nb_saisies']);
    }

    #[Test]
    public function findTeamAverageIsIsolatedPerTeam(): void
    {
        $teamId1 = $this->insertTeam('Équipe 1');
        $teamId2 = $this->insertTeam('Équipe 2');
        $uid1    = $this->insertUser('c1@test.fr', 'collaborateur', $teamId1);
        $uid2    = $this->insertUser('c2@test.fr', 'collaborateur', $teamId2);
        $this->insertMood($uid1, 90, 70, 0);
        $this->insertMood($uid2, 10, 20, 0);

        $results = $this->model->findTeamAverageLastSevenDays($teamId1);

        $this->assertCount(1, $results);
        $this->assertEquals(90.0, (float) $results[0]['avg_valence']);
        $this->assertEquals(70.0, (float) $results[0]['avg_arousal']);
    }

    // ── TEST MÉTIER : détection burn-out (valence < 30 ET arousal < 30) ──

    #[Test]
    public function burnoutPatternDetectedWhenBothDimensionsLowForTwoDays(): void
    {
        // J-2 : valence=15, arousal=20 (les deux < 30)
        // J-1 : valence=20, arousal=25 (les deux < 30)
        $this->insertMood($this->userId, 15, 20, 2);
        $this->insertMood($this->userId, 20, 25, 1);

        $prevDays = $this->model->findPreviousTwoDaysScoresByUserId($this->userId);

        $allCritical = count($prevDays) === 2
            && (int) $prevDays[0]['valence'] < 30
            && (int) $prevDays[0]['arousal'] < 30
            && (int) $prevDays[1]['valence'] < 30
            && (int) $prevDays[1]['arousal'] < 30;

        $this->assertTrue($allCritical);
    }

    #[Test]
    public function burnoutPatternNotDetectedWhenValenceHighArousalLow(): void
    {
        // J-2 : valence=15, arousal=20 (critique)
        // J-1 : valence=70, arousal=20 (valence haute → séquence interrompue)
        $this->insertMood($this->userId, 15, 20, 2);
        $this->insertMood($this->userId, 70, 20, 1);

        $prevDays = $this->model->findPreviousTwoDaysScoresByUserId($this->userId);

        $allCritical = count($prevDays) === 2
            && (int) $prevDays[0]['valence'] < 30
            && (int) $prevDays[0]['arousal'] < 30
            && (int) $prevDays[1]['valence'] < 30
            && (int) $prevDays[1]['arousal'] < 30;

        $this->assertFalse($allCritical);
    }

    #[Test]
    public function burnoutPatternNotDetectedWhenValenceLowArousalHigh(): void
    {
        // J-2 : valence=15, arousal=80 (arousal élevé → pas burn-out)
        // J-1 : valence=15, arousal=75
        $this->insertMood($this->userId, 15, 80, 2);
        $this->insertMood($this->userId, 15, 75, 1);

        $prevDays = $this->model->findPreviousTwoDaysScoresByUserId($this->userId);

        $allCritical = count($prevDays) === 2
            && (int) $prevDays[0]['valence'] < 30
            && (int) $prevDays[0]['arousal'] < 30
            && (int) $prevDays[1]['valence'] < 30
            && (int) $prevDays[1]['arousal'] < 30;

        $this->assertFalse($allCritical);
    }

    #[Test]
    public function burnoutPatternNotDetectedWhenOnlyOneDayLow(): void
    {
        // Seulement hier (1 jour) — pas de donnée avant-hier
        $this->insertMood($this->userId, 20, 25, 1);

        $prevDays = $this->model->findPreviousTwoDaysScoresByUserId($this->userId);

        $this->assertCount(1, $prevDays);
        $this->assertFalse(count($prevDays) === 2); // La condition exige count === 2
    }

    #[Test]
    public function burnoutThresholdIs30ForBothDimensions(): void
    {
        // Valeur exacte 30 : doit être NON-critique (< 30, pas ≤ 30)
        $this->insertMood($this->userId, 30, 30, 2);
        $this->insertMood($this->userId, 30, 30, 1);

        $prevDays = $this->model->findPreviousTwoDaysScoresByUserId($this->userId);

        $allBelowThreshold = count($prevDays) === 2
            && (int) $prevDays[0]['valence'] < 30
            && (int) $prevDays[0]['arousal'] < 30
            && (int) $prevDays[1]['valence'] < 30
            && (int) $prevDays[1]['arousal'] < 30;

        $this->assertFalse($allBelowThreshold); // 30 n'est PAS < 30
    }
}
