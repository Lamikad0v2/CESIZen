<?php
declare(strict_types=1);

require_once __DIR__ . '/../Controllers/AuthController.php';
require_once __DIR__ . '/../Controllers/MoodController.php';
require_once __DIR__ . '/../Controllers/TeamController.php';
require_once __DIR__ . '/../Controllers/AdminController.php';
require_once __DIR__ . '/../Controllers/AlertController.php';
require_once __DIR__ . '/../Controllers/ManagerController.php';
require_once __DIR__ . '/../Controllers/AccountController.php';
require_once __DIR__ . '/../Controllers/ArticleController.php';

/**
 * Routeur central de l'API CESIZen.
 *
 * Supporte deux types de routes :
 *   - Exactes    : '/api/teams'
 *   - Dynamiques : '/api/teams/{id}'  (segment {id} = entier positif)
 *
 * Résolution (ordre de priorité) :
 *   1. Match exact (O(1) sur le tableau associatif PHP)
 *   2. Match par regex pour les routes avec {id}
 *   3. 404 si aucune route ne correspond
 *   4. 405 si l'URI existe mais pas pour cette méthode HTTP
 */

$method = $_SERVER['REQUEST_METHOD'];

// Extrait l'URI relative en retirant le sous-dossier de déploiement.
// Ex : /emotionalTracker/backend/api/teams/3 → /api/teams/3
$basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$uri      = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri      = '/' . ltrim(substr($uri, strlen($basePath)), '/');
$uri      = rtrim($uri, '/') ?: '/';

// ----------------------------------------------------------------
// Table de routage
// ----------------------------------------------------------------
$routes = [
    'GET' => [
        '/api/moods/history'        => [MoodController::class,     'history'],
        '/api/moods'                => [MoodController::class,     'index'],
        '/api/teams'                => [TeamController::class,     'index'],
        '/api/admin/users'          => [AdminController::class,    'listUsers'],
        '/api/admin/alerts'         => [AlertController::class,    'index'],
        '/api/manager/team-mood'    => [ManagerController::class,  'teamMood'],
        '/api/articles'             => [ArticleController::class,  'index'],
        '/api/articles/{id}'        => [ArticleController::class,  'show'],
    ],
    'POST' => [
        '/api/register'             => [AuthController::class,     'register'],
        '/api/login'                => [AuthController::class,     'login'],
        '/api/moods'                => [MoodController::class,     'store'],
        '/api/teams'                => [TeamController::class,     'store'],
        '/api/articles'             => [ArticleController::class,  'store'],
    ],
    'PUT' => [
        '/api/teams/{id}'             => [TeamController::class,    'update'],
        '/api/admin/users/{id}'       => [AdminController::class,   'updateUser'],
        '/api/admin/alerts/{id}/read' => [AlertController::class,   'markRead'],
        '/api/account/profile'        => [AccountController::class, 'updateProfile'],
        '/api/articles/{id}'          => [ArticleController::class, 'update'],
    ],
    'DELETE' => [
        '/api/account'              => [AccountController::class,  'deleteAccount'],
        '/api/teams/{id}'           => [TeamController::class,     'destroy'],
        '/api/admin/users/{id}'     => [AdminController::class,    'deleteUser'],
        '/api/articles/{id}'        => [ArticleController::class,  'destroy'],
    ],
];

// ----------------------------------------------------------------
// Résolution de la route
// ----------------------------------------------------------------
$handler      = null;
$routeParams  = [];

// 1. Match exact
if (isset($routes[$method][$uri])) {
    $handler = $routes[$method][$uri];
}

// 2. Match dynamique (patterns contenant {id})
if ($handler === null) {
    foreach ($routes[$method] ?? [] as $pattern => $h) {
        if (!str_contains($pattern, '{')) {
            continue;
        }
        // Transforme {id} en groupe capturant un entier positif
        $regex = '#^' . preg_replace('/\{[a-zA-Z_]+\}/', '(\d+)', $pattern) . '$#';
        if (preg_match($regex, $uri, $matches)) {
            $handler     = $h;
            array_shift($matches);                          // Retire le match complet
            $routeParams = array_map('intval', $matches);   // Sécurise en entiers
            break;
        }
    }
}

// 3. Aucune route trouvée
if ($handler === null) {
    // Vérifie si l'URI existe pour une autre méthode HTTP → 405 au lieu de 404
    $uriMatchesOtherMethod = false;
    foreach ($routes as $otherMethod => $uris) {
        if ($otherMethod === $method) {
            continue;
        }
        // Vérifie correspondance exacte
        if (isset($uris[$uri])) {
            $uriMatchesOtherMethod = true;
            break;
        }
        // Vérifie correspondance dynamique
        foreach ($uris as $pattern => $h) {
            if (!str_contains($pattern, '{')) {
                continue;
            }
            $regex = '#^' . preg_replace('/\{[a-zA-Z_]+\}/', '(\d+)', $pattern) . '$#';
            if (preg_match($regex, $uri)) {
                $uriMatchesOtherMethod = true;
                break 2;
            }
        }
    }

    $httpCode = $uriMatchesOtherMethod ? 405 : 404;
    $message  = $uriMatchesOtherMethod ? 'Method Not Allowed.' : 'Route not found.';

    http_response_code($httpCode);
    echo json_encode(['status' => 'error', 'data' => null, 'message' => $message]);
    exit;
}

// ----------------------------------------------------------------
// Dispatch
// ----------------------------------------------------------------
[$controllerClass, $actionMethod] = $handler;
(new $controllerClass())->$actionMethod(...$routeParams);
