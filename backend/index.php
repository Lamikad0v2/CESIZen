<?php
declare(strict_types=1);

// --- CORS ---
// En local : http://localhost:5173 (Vite dev server)
// En Docker : même origine, ou valeur de CORS_ORIGIN
$allowedOrigin = $_ENV['CORS_ORIGIN'] ?? getenv('CORS_ORIGIN') ?: 'http://localhost:5173';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin === $allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=UTF-8');

// Réponse aux requêtes preflight (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Routeur ---
require_once __DIR__ . '/Routes/router.php';
