import { test, expect } from '@playwright/test'

const MOCK_USER = { id: 1, nom: 'Dupont', prenom: 'Alice', email: 'alice@test.fr', role: 'collaborateur' }

// URL complète du backend — évite que **/api/** intercepte les modules Vite (src/api/axios.js)
const API = 'http://localhost/emotionalTracker/backend'

/**
 * Établit l'origine (localhost:5173) via /login PUIS injecte l'utilisateur dans
 * localStorage avec page.evaluate — garanti synchrone, pas de race condition.
 * addInitScript est intentionnellement évité : il se ré-exécute à chaque goto()
 * et interfère avec le test d'authentification.
 */
async function setupAuth(page, user) {
  await page.goto('/login')
  await page.evaluate(u => {
    localStorage.setItem('cesizen_user', JSON.stringify(u))
  }, user)
}

test.describe('Saisie d\'humeur (/track)', () => {

  test.beforeEach(async ({ page }) => {
    // URL complète backend : n'intercepte PAS les imports de modules Vite
    await page.route(`${API}/api/moods/history`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    )
    await page.route(`${API}/api/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    )

    await setupAuth(page, MOCK_USER)
    await page.goto('/track')
  })

  // ── Affichage ────────────────────────────────────────────────────

  test('affiche le titre de la page', async ({ page }) => {
    // h1 MoodEntry.jsx — visible dès le montage (hors bloc loading)
    await expect(page.getByRole('heading', { name: 'Comment allez-vous ?' })).toBeVisible()
  })

  test('affiche les deux sliders Russell', async ({ page }) => {
    // ariaLabel exact : prop ariaLabel de CircumplexSlider → aria-label sur <input type="range">
    await expect(page.getByRole('slider', { name: 'Valence' })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Activation' })).toBeVisible()
  })

  test('affiche les libellés des axes du modèle circomplexe', async ({ page }) => {
    // Texte exact MoodForm.jsx (prop label et leftLabel/rightLabel de CircumplexSlider)
    await expect(page.getByText('Comment vous sentez-vous ?')).toBeVisible()
    await expect(page.getByText("Quel est votre niveau d'énergie ?")).toBeVisible()
    // exact:true évite que "Agréable" matche "Désagréable" ou "Très agréable"
    await expect(page.getByText('Désagréable', { exact: true })).toBeVisible()
    await expect(page.getByText('Agréable',    { exact: true })).toBeVisible()
    await expect(page.getByText('Épuisé',      { exact: true })).toBeVisible()
    await expect(page.getByText('Survolté',    { exact: true })).toBeVisible()
  })

  test('affiche les tags de contexte', async ({ page }) => {
    // Libellés exacts de CONTEXT_TAGS dans MoodForm.jsx
    await expect(page.getByRole('button', { name: 'Charge de travail' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Réunion' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Isolement' })).toBeVisible()
  })

  // ── Interactions ─────────────────────────────────────────────────

  test('sélectionne et désélectionne un tag de contexte', async ({ page }) => {
    const tagBtn = page.getByRole('button', { name: 'Réunion' })

    await tagBtn.click()
    // Texte exact MoodForm.jsx ligne 209-211
    await expect(page.getByText('1 contexte sélectionné')).toBeVisible()

    await tagBtn.click()
    await expect(page.getByText(/contexte sélectionné/)).not.toBeVisible()
  })

  test('soumet le formulaire et affiche l\'état de succès', async ({ page }) => {
    // Attendre que le formulaire initial soit rendu (useEffect fetchToday terminé)
    // AVANT d'enregistrer les overrides — sinon le fetchToday initial intercepte route #4
    // et affiche SuccessState en cachant le bouton "Enregistrer".
    await page.getByRole('button', { name: 'Enregistrer' }).waitFor({ state: 'visible' })

    // Override LIFO : ces routes prennent le pas sur les mocks du beforeEach
    await page.route(`${API}/api/moods`, route =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ message: 'Humeur enregistrée.' }) })
    )
    await page.route(`${API}/api/moods/history`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            date: new Date().toISOString().split('T')[0],
            valence: 65,
            arousal: 60,
            context_tags: [],
          }],
        }),
      })
    )

    // Texte exact du bouton submit MoodForm.jsx : 'Enregistrer'
    await page.getByRole('button', { name: 'Enregistrer' }).click()

    // h2 exact SuccessState : "C'est noté !" (C&apos;est noté !)
    await expect(page.getByRole('heading', { name: "C'est noté !" })).toBeVisible({ timeout: 5000 })
  })

  // ── Sécurité ──────────────────────────────────────────────────────

  test('redirige vers /login si non authentifié', async ({ page }) => {
    // evaluate (pas addInitScript) → le retrait est permanent, ne se ré-injecte pas sur goto
    await page.evaluate(() => localStorage.removeItem('cesizen_user'))
    await page.goto('/track')
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
