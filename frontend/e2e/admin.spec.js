import { test, expect } from '@playwright/test'

const COLLAB_USER = { id: 2, nom: 'Dupont', prenom: 'Alice', email: 'alice@test.fr', role: 'collaborateur' }
const ADMIN_USER  = { id: 1, nom: 'Martin', prenom: 'Super', email: 'admin@test.fr', role: 'admin' }
const RH_USER     = { id: 3, nom: 'Leclerc', prenom: 'Marie', email: 'rh@test.fr', role: 'rh' }

// URL complète du backend — évite que **/api/** intercepte les modules Vite (src/api/axios.js)
const API = 'http://localhost/emotionalTracker/backend'

// ── Helpers ────────────────────────────────────────────────────────

/** Intercepte toutes les API calls avec une réponse vide valide. */
async function mockAllApis(page) {
  await page.route(`${API}/api/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  )
}

/**
 * Établit l'origine (localhost:5173) via /login PUIS injecte l'utilisateur dans
 * localStorage avec page.evaluate — garanti synchrone, pas de race condition.
 * addInitScript est intentionnellement évité : il se ré-exécute à chaque goto()
 * et interfère avec les tests d'authentification.
 */
async function loginAs(page, user) {
  await page.goto('/login')
  await page.evaluate(u => {
    localStorage.setItem('cesizen_user', JSON.stringify(u))
  }, user)
}

/**
 * Retourne le locator du bon panneau de navigation selon le viewport :
 *
 * — Desktop (≥ 1024 px) : sidebar fixe → <aside>.nth(0)
 *   La sidebar est toujours dans le DOM (hidden lg:flex), visible sur desktop.
 *
 * — Mobile (< 1024 px) : drawer → <aside>.nth(1)
 *   La sidebar desktop est CSS-masquée (display:none via classe "hidden").
 *   On ouvre le hamburger (aria-label="Menu") pour que le drawer s'insère
 *   dans le DOM comme 2e aside, puis on le cible avec .nth(1).
 */
async function getNavAside(page) {
  const vp = page.viewportSize()
  if (vp && vp.width < 1024) {
    const burger = page.getByRole('button', { name: 'Menu' })
    if (await burger.isVisible()) {
      await burger.click()
      await page.locator('aside').nth(1).waitFor({ state: 'visible' })
    }
    return page.locator('aside').nth(1)
  }
  return page.locator('aside').nth(0)
}

// ── Suite 1 : Visibilité du menu Administration ────────────────────

test.describe('Visibilité du menu Administration', () => {

  test('le menu Administration N\'est PAS présent pour un collaborateur', async ({ page }) => {
    await mockAllApis(page)
    await loginAs(page, COLLAB_USER)
    await page.goto('/dashboard')

    // navSections filtre la section gestion (show: false pour collab) →
    // aucun <a href="/admin"> n'est rendu, ni sidebar ni bottom tab bar
    await expect(page.locator('a[href="/admin"]')).toHaveCount(0)
  })

  test('le menu Administration EST visible pour un admin', async ({ page }) => {
    await mockAllApis(page)
    await loginAs(page, ADMIN_USER)
    await page.goto('/dashboard')

    const nav = await getNavAside(page)
    // Texte exact NavItem label : 'Administration' (Layout.jsx)
    await expect(nav.getByRole('link', { name: 'Administration' })).toBeVisible()
  })

  test('le menu Administration EST visible pour un rh', async ({ page }) => {
    await mockAllApis(page)
    await loginAs(page, RH_USER)
    await page.goto('/dashboard')

    const nav = await getNavAside(page)
    await expect(nav.getByRole('link', { name: 'Administration' })).toBeVisible()
  })

  test('le menu Équipe N\'est PAS présent pour un collaborateur', async ({ page }) => {
    await mockAllApis(page)
    await loginAs(page, COLLAB_USER)
    await page.goto('/dashboard')

    // navSections filtre la section equipe (show: role === 'manager') → 0 liens
    await expect(page.locator('a[href="/manager"]')).toHaveCount(0)
  })
})

// ── Suite 2 : Navigation et contenu du panel Admin ─────────────────

test.describe('Navigation vers le panel Administration', () => {

  test.beforeEach(async ({ page }) => {
    // Routes et auth AVANT toute navigation cible
    await mockAllApis(page)
    await loginAs(page, ADMIN_USER)
  })

  test('navigue vers /admin via le lien Administration', async ({ page }) => {
    await page.goto('/dashboard')

    // Sur mobile : getNavAside ouvre le hamburger en premier
    const nav = await getNavAside(page)
    await nav.getByRole('link', { name: 'Administration' }).click()

    await expect(page).toHaveURL(/\/admin/)
  })

  test('affiche le titre "Gestion RH" sur le panel admin', async ({ page }) => {
    await page.goto('/admin')
    // h1 exact AdminDashboard.jsx
    await expect(page.getByRole('heading', { name: 'Gestion RH' })).toBeVisible({ timeout: 5000 })
  })

  test('affiche les quatre onglets avec leurs data-testid', async ({ page }) => {
    await page.goto('/admin')
    // data-testid sur les boutons d'onglets (AdminDashboard.jsx)
    await expect(page.getByTestId('tab-teams')).toBeVisible()
    await expect(page.getByTestId('tab-users')).toBeVisible()
    await expect(page.getByTestId('tab-alerts')).toBeVisible()
    await expect(page.getByTestId('tab-articles')).toBeVisible()
  })

  test('l\'onglet Équipes est actif par défaut', async ({ page }) => {
    await page.goto('/admin')
    // h2 exact liste des équipes (AdminDashboard.jsx)
    await expect(page.getByText('Liste des équipes')).toBeVisible({ timeout: 5000 })
  })

  test('bascule vers l\'onglet Utilisateurs', async ({ page }) => {
    await page.goto('/admin')
    await page.getByTestId('tab-users').click()
    await expect(page.getByText('Liste des utilisateurs')).toBeVisible()
  })

  test('bascule vers l\'onglet Alertes', async ({ page }) => {
    await page.goto('/admin')
    await page.getByTestId('tab-alerts').click()
    // h2 exact AdminDashboard.jsx
    await expect(page.getByText('Alertes prévention burn-out')).toBeVisible()
  })

  test('redirige un collaborateur vers /dashboard s\'il accède directement à /admin', async ({ page }) => {
    // loginAs(COLLAB_USER) écrase le ADMIN_USER du beforeEach
    await loginAs(page, COLLAB_USER)
    await page.goto('/admin')
    // useEffect AdminDashboard.jsx : navigate('/dashboard', { replace: true })
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 })
  })
})
