import { test, expect } from '@playwright/test'

test.describe('Authentification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('affiche le formulaire de connexion', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="mot_de_passe"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible()
  })

  test('affiche le branding CESIZen', async ({ page }) => {
    await expect(page.getByText('CZ')).toBeVisible()
    await expect(page.getByText(/bon retour sur cesiZen/i)).toBeVisible()
  })

  test('affiche une erreur pour des identifiants invalides', async ({ page }) => {
    await page.route('**/api/login', route =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Identifiants incorrects.' }),
      })
    )

    await page.locator('input[name="email"]').fill('wrong@test.fr')
    await page.locator('input[name="mot_de_passe"]').fill('badpassword')
    await page.getByRole('button', { name: /se connecter/i }).click()

    await expect(page.getByText('Identifiants incorrects.')).toBeVisible()
  })

  test('redirige vers /dashboard après une connexion réussie', async ({ page }) => {
    await page.route('**/api/login', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Connexion réussie.',
          data: { id: 1, nom: 'Dupont', prenom: 'Alice', email: 'alice@test.fr', role: 'collaborateur' },
        }),
      })
    )
    // Mock the /dashboard API calls to avoid network errors after redirect
    await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }))

    await page.locator('input[name="email"]').fill('alice@test.fr')
    await page.locator('input[name="mot_de_passe"]').fill('password123')
    await page.getByRole('button', { name: /se connecter/i }).click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 })
  })

  test('contient un lien vers la page d\'inscription', async ({ page }) => {
    await expect(page.getByRole('link', { name: /s'inscrire/i })).toBeVisible()
  })
})
