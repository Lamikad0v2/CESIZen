<?php
declare(strict_types=1);

require_once __DIR__ . '/../Models/User.php';

/**
 * Controller AuthController — Gère l'inscription et l'authentification.
 *
 * Chaque méthode publique correspond à un endpoint REST :
 *   POST /api/register  → AuthController::register()
 *   POST /api/login     → AuthController::login()
 *
 * Les réponses JSON suivent le format standardisé du projet :
 *   { "status": "success|error", "data": {...}|null, "message": "..." }
 */
class AuthController
{
    // ----------------------------------------------------------------
    // Regex de validation (miroir exact des règles frontend)
    // ----------------------------------------------------------------

    /** Lettres Unicode, tirets et espaces, 2 caractères minimum. */
    private const REGEX_NAME = '/^[\p{L}\s\-]{2,}$/u';

    /** RFC 5321 simplifié — couvre la quasi-totalité des adresses valides. */
    private const REGEX_EMAIL = '/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/';

    /** Au moins : 8 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial. */
    private const REGEX_PASSWORD_UPPER   = '/[A-Z]/'; // NOSONAR
    private const REGEX_PASSWORD_DIGIT   = '/[0-9]/'; // NOSONAR
    private const REGEX_PASSWORD_SPECIAL = '/[\W_]/'; // NOSONAR

    private User $userModel;

    /**
     * Instancie le modèle User nécessaire aux deux actions.
     */
    public function __construct()
    {
        $this->userModel = new User();
    }

    // ----------------------------------------------------------------
    // POST /api/register
    // ----------------------------------------------------------------

    /**
     * Inscrit un nouvel utilisateur après validation stricte des données.
     *
     * Corps JSON attendu :
     *   { "nom": "...", "prenom": "...", "email": "...", "mot_de_passe": "..." }
     *
     * Validations :
     *   - Champs requis non vides.
     *   - Nom / prénom : lettres, tirets, espaces (≥ 2 caractères).
     *   - Email : format RFC 5321 simplifié.
     *   - Mot de passe : ≥ 8 caractères, ≥ 1 majuscule, ≥ 1 chiffre, ≥ 1 caractère spécial.
     *   - Email non déjà utilisé.
     *
     * @return void  Émet directement la réponse JSON et termine l'exécution.
     */
    public function register(): void
    {
        $body = $this->getJsonBody();

        $nom      = trim($body['nom']     ?? '');
        $prenom   = trim($body['prenom']  ?? '');
        $email    = trim($body['email']   ?? '');
        $password = $body['mot_de_passe'] ?? '';

        // --- 1. Présence des champs ---
        if ($nom === '' || $prenom === '' || $email === '' || $password === '') {
            $this->respond(400, 'error', null, 'All fields are required.');
        }

        // --- 2. Validation du nom ---
        if (preg_match(self::REGEX_NAME, $nom) !== 1) {
            $this->respond(
                400,
                'error',
                null,
                'Last name must be at least 2 characters and contain only letters, hyphens or spaces.'
            );
        }

        // --- 3. Validation du prénom ---
        if (preg_match(self::REGEX_NAME, $prenom) !== 1) {
            $this->respond(
                400,
                'error',
                null,
                'First name must be at least 2 characters and contain only letters, hyphens or spaces.'
            );
        }

        // --- 4. Validation de l'email ---
        if (preg_match(self::REGEX_EMAIL, $email) !== 1) {
            $this->respond(400, 'error', null, 'Invalid email address format.');
        }

        // --- 5. Validation du mot de passe ---
        $this->validatePassword($password);

        // --- 6. Unicité de l'email ---
        if ($this->userModel->findByEmail($email) !== null) {
            $this->respond(409, 'error', null, 'This email address is already in use.');
        }

        // --- 7. Création ---
        try {
            $userId = $this->userModel->create($nom, $prenom, $email, $password);
        } catch (RuntimeException $e) {
            $this->respond(500, 'error', null, 'Registration failed. Please try again.');
        }

        $this->respond(201, 'success', ['id' => $userId], 'Account created successfully.');
    }

    // ----------------------------------------------------------------
    // POST /api/login
    // ----------------------------------------------------------------

    /**
     * Authentifie un utilisateur et ouvre une session PHP sécurisée.
     *
     * Corps JSON attendu :
     *   { "email": "...", "mot_de_passe": "..." }
     *
     * @return void  Émet directement la réponse JSON et termine l'exécution.
     */
    public function login(): void
    {
        $body = $this->getJsonBody();

        $email    = trim($body['email']   ?? '');
        $password = $body['mot_de_passe'] ?? '';

        if ($email === '' || $password === '') {
            $this->respond(400, 'error', null, 'Email and password are required.');
        }

        // Protection timing-attack : password_verify tourne même si l'email est inconnu.
        $user = $this->userModel->findByEmail($email);

        $dummyHash    = '$argon2id$v=19$m=65536,t=4,p=1$fakesaltfakesalt$fakehashfakehashfakehashfakehash';
        $hashToVerify = $user['mot_de_passe'] ?? $dummyHash;

        if ($user === null || !password_verify($password, $hashToVerify)) {
            $this->respond(401, 'error', null, 'Invalid credentials.');
        }

        // --- Session sécurisée ---
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'secure'   => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        session_start();
        session_regenerate_id(true);

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['role']    = $user['role'];

        $this->respond(200, 'success', [
            'id'     => $user['id'],
            'nom'    => $user['nom'],
            'prenom' => $user['prenom'],
            'email'  => $user['email'],
            'role'   => $user['role'],
        ], 'Login successful.');
    }

    // ----------------------------------------------------------------
    // Helpers privés
    // ----------------------------------------------------------------

    /**
     * Valide la complexité du mot de passe et répond immédiatement en cas d'échec.
     * Les règles sont le miroir exact des critères visuels affichés côté frontend.
     *
     * @param string $password  Mot de passe en clair à valider.
     *
     * @return void
     */
    private function validatePassword(string $password): void
    {
        if (strlen($password) < 8) {
            $this->respond(400, 'error', null, 'Password must be at least 8 characters long.');
        }

        if (preg_match(self::REGEX_PASSWORD_UPPER, $password) !== 1) {
            $this->respond(400, 'error', null, 'Password must contain at least one uppercase letter.');
        }

        if (preg_match(self::REGEX_PASSWORD_DIGIT, $password) !== 1) {
            $this->respond(400, 'error', null, 'Password must contain at least one digit.');
        }

        if (preg_match(self::REGEX_PASSWORD_SPECIAL, $password) !== 1) {
            $this->respond(400, 'error', null, 'Password must contain at least one special character.');
        }
    }

    /**
     * Décode le corps de la requête JSON entrante.
     *
     * @return array<string, mixed>
     */
    private function getJsonBody(): array
    {
        $raw  = file_get_contents('php://input');
        $data = json_decode($raw ?: '', true);

        return is_array($data) ? $data : [];
    }

    /**
     * Émet une réponse JSON standardisée et termine l'exécution du script.
     *
     * @param int                      $httpCode
     * @param string                   $status    'success' ou 'error'
     * @param array<string,mixed>|null $data
     * @param string                   $message
     *
     * @return never
     */
    private function respond(
        int $httpCode,
        string $status,
        ?array $data,
        string $message
    ): never {
        http_response_code($httpCode);
        echo json_encode([
            'status'  => $status,
            'data'    => $data,
            'message' => $message,
        ]);
        exit;
    }
}
