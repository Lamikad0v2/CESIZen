#!/usr/bin/env php
<?php
declare(strict_types=1);

require_once __DIR__ . '/Database.php';

const PLAIN_PASSWORD = 'Cesizen1!'; // NOSONAR — seeder fixture, not a production credential
const MOOD_DAYS = 30;

$TEAMS = ['Developpement', 'Marketing', 'Support Client'];

$SPECIAL_ACCOUNTS = [
    [
        'nom' => 'Admin',
        'prenom' => 'Super',
        'email' => 'admin@cesizen.fr',
        'role' => 'admin',
        'team_idx' => null,
    ],
    [
        'nom' => 'Moreau',
        'prenom' => 'Julie',
        'email' => 'rh@cesizen.fr',
        'role' => 'rh',
        'team_idx' => null,
    ],
];

$MANAGERS = [
    ['nom' => 'Bernard', 'prenom' => 'Thomas', 'email' => 'manager.dev@cesizen.fr', 'team_idx' => 0],
    ['nom' => 'Laurent', 'prenom' => 'Sophie', 'email' => 'manager.mkt@cesizen.fr', 'team_idx' => 1],
    ['nom' => 'Petit', 'prenom' => 'Marc', 'email' => 'manager.sup@cesizen.fr', 'team_idx' => 2],
];

$ARTICLES = [
    [
        'title' => 'Bien demarrer sa semaine sans surcharge',
        'content' => "Quelques reflexes simples pour garder un bon rythme: prioriser trois taches, couper les notifications inutiles et prendre une vraie pause dejeuner.",
        'author_email' => 'rh@cesizen.fr',
    ],
    [
        'title' => 'Signaux faibles de fatigue a surveiller',
        'content' => "Une baisse d'energie, une humeur plus irritable ou une difficulte a se concentrer sont des indices utiles pour agir avant la saturation.",
        'author_email' => 'admin@cesizen.fr',
    ],
    [
        'title' => 'Conduite a tenir en cas de surcharge equipe',
        'content' => "Repartir la charge, clarifier les priorites et faire remonter les blocages rapidement permet de limiter les tensions sur l'equipe.",
        'author_email' => 'manager.dev@cesizen.fr',
    ],
];

$COLLABORATEURS = [
    ['nom' => 'Dupont', 'prenom' => 'Alice', 'email' => 'alice.dupont@cesizen.fr', 'team_idx' => 0, 'at_risk' => true],
    ['nom' => 'Martin', 'prenom' => 'Luc', 'email' => 'luc.martin@cesizen.fr', 'team_idx' => 0, 'at_risk' => false],
    ['nom' => 'Leroy', 'prenom' => 'Emma', 'email' => 'emma.leroy@cesizen.fr', 'team_idx' => 0, 'at_risk' => false],
    ['nom' => 'Morel', 'prenom' => 'Paul', 'email' => 'paul.morel@cesizen.fr', 'team_idx' => 0, 'at_risk' => false],
    ['nom' => 'Simon', 'prenom' => 'Chloe', 'email' => 'chloe.simon@cesizen.fr', 'team_idx' => 0, 'at_risk' => false],
    ['nom' => 'Fontaine', 'prenom' => 'Camille', 'email' => 'camille.fontaine@cesizen.fr', 'team_idx' => 1, 'at_risk' => true],
    ['nom' => 'Richard', 'prenom' => 'Nathan', 'email' => 'nathan.richard@cesizen.fr', 'team_idx' => 1, 'at_risk' => false],
    ['nom' => 'Dubois', 'prenom' => 'Lea', 'email' => 'lea.dubois@cesizen.fr', 'team_idx' => 1, 'at_risk' => false],
    ['nom' => 'Girard', 'prenom' => 'Antoine', 'email' => 'antoine.girard@cesizen.fr', 'team_idx' => 1, 'at_risk' => false],
    ['nom' => 'Lambert', 'prenom' => 'Manon', 'email' => 'manon.lambert@cesizen.fr', 'team_idx' => 1, 'at_risk' => false],
    ['nom' => 'Rousseau', 'prenom' => 'Hugo', 'email' => 'hugo.rousseau@cesizen.fr', 'team_idx' => 2, 'at_risk' => true],
    ['nom' => 'Dumont', 'prenom' => 'Clara', 'email' => 'clara.dumont@cesizen.fr', 'team_idx' => 2, 'at_risk' => false],
    ['nom' => 'Blanc', 'prenom' => 'Theo', 'email' => 'theo.blanc@cesizen.fr', 'team_idx' => 2, 'at_risk' => false],
    ['nom' => 'Garnier', 'prenom' => 'Ines', 'email' => 'ines.garnier@cesizen.fr', 'team_idx' => 2, 'at_risk' => false],
    ['nom' => 'Colin', 'prenom' => 'Romain', 'email' => 'romain.colin@cesizen.fr', 'team_idx' => 2, 'at_risk' => false],
];

function out(string $message): void
{
    echo $message . PHP_EOL;
}

function ok(string $message): void
{
    echo "  [OK] $message" . PHP_EOL;
}

function warn(string $message): void
{
    echo "  [WARN] $message" . PHP_EOL;
}

function title(string $message): void
{
    out('');
    out('=== ' . $message . ' ===');
}

function generateMood(bool $atRisk, int $daysAgo, array $recentMoods): array
{
    if ($atRisk && $daysAgo <= 3) {
        return match ($daysAgo) {
            3 => ['valence' => 24, 'arousal' => 22],
            2 => ['valence' => 18, 'arousal' => 17],
            default => ['valence' => 21, 'arousal' => 19],
        };
    }

    $pool = [
        ['valence' => 74, 'arousal' => 66],
        ['valence' => 68, 'arousal' => 72],
        ['valence' => 81, 'arousal' => 63],
        ['valence' => 59, 'arousal' => 57],
        ['valence' => 63, 'arousal' => 69],
        ['valence' => 77, 'arousal' => 75],
        ['valence' => 66, 'arousal' => 58],
    ];

    if (count($recentMoods) === 2) {
        $previousLow = $recentMoods[0]['valence'] < 30 && $recentMoods[0]['arousal'] < 30;
        $beforePreviousLow = $recentMoods[1]['valence'] < 30 && $recentMoods[1]['arousal'] < 30;
        if ($previousLow && $beforePreviousLow) {
            return ['valence' => 72, 'arousal' => 70];
        }
    }

    return $pool[array_rand($pool)];
}

function generateComment(array $mood): ?string
{
    $average = (int) round(($mood['valence'] + $mood['arousal']) / 2);

    if ($average >= 70) {
        $pool = ['Bonne journee, energie stable.', 'Equipe au top.', 'Objectifs atteints facilement.', null];
    } elseif ($average >= 45) {
        $pool = ['Journee normale.', 'Charge acceptable.', 'Rien de particulier a signaler.', null];
    } else {
        $pool = ['Journee difficile.', 'Charge de travail trop importante.', 'Fatigue accumulee.', null];
    }

    return $pool[array_rand($pool)];
}

out('CESIZen seed de presentation');
out('Mot de passe universel: ' . PLAIN_PASSWORD);

$pdo = Database::getInstance()->getConnection();
$passwordHash = password_hash(PLAIN_PASSWORD, PASSWORD_ARGON2ID);

try {
    title('Nettoyage des tables');
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach (['alerts', 'moods', 'articles', 'users', 'teams'] as $table) {
        $pdo->exec("TRUNCATE TABLE `{$table}`");
        ok("Table {$table} videe");
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

    title('Insertion des equipes');
    $teamStmt = $pdo->prepare('INSERT INTO teams (nom_equipe) VALUES (:nom_equipe)');
    $teamIds = [];
    foreach ($TEAMS as $teamName) {
        $teamStmt->execute([':nom_equipe' => $teamName]);
        $teamIds[] = (int) $pdo->lastInsertId();
        ok($teamName);
    }

    title('Insertion des comptes');
    $userStmt = $pdo->prepare('
        INSERT INTO users (nom, prenom, email, mot_de_passe, role, team_id)
        VALUES (:nom, :prenom, :email, :mot_de_passe, :role, :team_id)
    ');

    $createdAccounts = [];
    $userIdsByEmail = [];

    foreach ($SPECIAL_ACCOUNTS as $account) {
        $userStmt->execute([
            ':nom' => $account['nom'],
            ':prenom' => $account['prenom'],
            ':email' => $account['email'],
            ':mot_de_passe' => $passwordHash,
            ':role' => $account['role'],
            ':team_id' => null,
        ]);

        $createdAccounts[] = [
            'role' => strtoupper($account['role']),
            'email' => $account['email'],
        ];
        $userIdsByEmail[$account['email']] = (int) $pdo->lastInsertId();
        ok($account['role'] . ' -> ' . $account['email']);
    }

    foreach ($MANAGERS as $manager) {
        $userStmt->execute([
            ':nom' => $manager['nom'],
            ':prenom' => $manager['prenom'],
            ':email' => $manager['email'],
            ':mot_de_passe' => $passwordHash,
            ':role' => 'manager',
            ':team_id' => $teamIds[$manager['team_idx']],
        ]);

        $createdAccounts[] = [
            'role' => 'MANAGER',
            'email' => $manager['email'],
        ];
        $userIdsByEmail[$manager['email']] = (int) $pdo->lastInsertId();
        ok('manager -> ' . $manager['email']);
    }

    title('Insertion des humeurs et alertes');
    $moodStmt = $pdo->prepare('
        INSERT INTO moods (user_id, valence, arousal, emotion_tags, context_tags, commentaire, date_humeur)
        VALUES (:user_id, :valence, :arousal, :emotion_tags, :context_tags, :commentaire, :date_humeur)
    ');
    $alertStmt = $pdo->prepare('
        INSERT INTO alerts (user_id_concerne, message, is_read, created_at)
        VALUES (:user_id_concerne, :message, :is_read, :created_at)
    ');

    foreach ($COLLABORATEURS as $collaborator) {
        $userStmt->execute([
            ':nom' => $collaborator['nom'],
            ':prenom' => $collaborator['prenom'],
            ':email' => $collaborator['email'],
            ':mot_de_passe' => $passwordHash,
            ':role' => 'collaborateur',
            ':team_id' => $teamIds[$collaborator['team_idx']],
        ]);

        $userId = (int) $pdo->lastInsertId();
        $recentMoods = [];

        for ($daysAgo = MOOD_DAYS; $daysAgo >= 1; $daysAgo--) {
            $date = date('Y-m-d', strtotime('-' . $daysAgo . ' days'));
            $mood = generateMood($collaborator['at_risk'], $daysAgo, $recentMoods);
            $comment = generateComment($mood);

            $contextTags = $mood['valence'] < 30
                ? ['Charge de travail', 'Fatigue', 'Pression']
                : ['Collaboration', 'Organisation', 'Equipe'];

            $moodStmt->execute([
                ':user_id' => $userId,
                ':valence' => $mood['valence'],
                ':arousal' => $mood['arousal'],
                ':emotion_tags' => null,
                ':context_tags' => json_encode($contextTags, JSON_UNESCAPED_UNICODE),
                ':commentaire' => $comment,
                ':date_humeur' => $date,
            ]);

            array_unshift($recentMoods, $mood);
            $recentMoods = array_slice($recentMoods, 0, 2);
        }

        if ($collaborator['at_risk']) {
            $alertStmt->execute([
                ':user_id_concerne' => $userId,
                ':message' => 'Alerte burn-out : valence et arousal inferieurs a 30 pendant 3 jours consecutifs.',
                ':is_read' => 0,
                ':created_at' => date('Y-m-d H:i:s', strtotime('-1 day')),
            ]);
            warn($collaborator['prenom'] . ' ' . $collaborator['nom'] . ' -> alerte burn-out pre-remplie');
        } else {
            ok($collaborator['prenom'] . ' ' . $collaborator['nom'] . ' -> ' . MOOD_DAYS . ' jours d\'humeurs');
        }
    }

    title('Insertion des articles');
    $articleStmt = $pdo->prepare('
        INSERT INTO articles (title, content, author_id)
        VALUES (:title, :content, :author_id)
    ');

    foreach ($ARTICLES as $article) {
        if (!isset($userIdsByEmail[$article['author_email']])) {
            throw new RuntimeException('Unknown article author: ' . $article['author_email']);
        }

        $articleStmt->execute([
            ':title' => $article['title'],
            ':content' => $article['content'],
            ':author_id' => $userIdsByEmail[$article['author_email']],
        ]);

        ok($article['title'] . ' -> ' . $article['author_email']);
    }

    out('');
    out('Insertion terminee avec succes.');
    out('');
    out('Comptes de presentation:');
    out('  ADMIN          admin@cesizen.fr / ' . PLAIN_PASSWORD);
    out('  RH             rh@cesizen.fr / ' . PLAIN_PASSWORD);
    out('  MANAGER DEV    manager.dev@cesizen.fr / ' . PLAIN_PASSWORD);
    out('  MANAGER MKT    manager.mkt@cesizen.fr / ' . PLAIN_PASSWORD);
    out('  MANAGER SUP    manager.sup@cesizen.fr / ' . PLAIN_PASSWORD);
    out('  COLLAB SIMPLE  alice.dupont@cesizen.fr / ' . PLAIN_PASSWORD);
    out('  COLLAB RISQUE  camille.fontaine@cesizen.fr / ' . PLAIN_PASSWORD);
    out('  COLLAB RISQUE  hugo.rousseau@cesizen.fr / ' . PLAIN_PASSWORD);
    out('');
    out('Articles de presentation:');
    out('  - Bien demarrer sa semaine sans surcharge');
    out('  - Signaux faibles de fatigue a surveiller');
    out('  - Conduite a tenir en cas de surcharge equipe');
    out('');
    out('Tous les comptes sont en Argon2id et les donnees d\'humeur couvrent 30 jours.');
} catch (Throwable $e) {
    error_log($e->getMessage());
    fwrite(STDERR, 'Seeder error: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
