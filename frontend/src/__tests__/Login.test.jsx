import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Login from '../pages/Login'

// ── Mocks ─────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}))

vi.mock('../api/axios', () => ({
  default: {
    post: vi.fn(),
  },
}))

import api from '../api/axios'

// ── Helpers ───────────────────────────────────────────────────────

function renderLogin() {
  return render(<Login />)
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Login — Rendu initial', () => {
  it('affiche le champ email', () => {
    renderLogin()
    expect(screen.getByPlaceholderText(/jean\.dupont/i)).toBeInTheDocument()
  })

  it('affiche le champ mot de passe', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('affiche le bouton de connexion', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument()
  })

  it('affiche un lien vers la page d\'inscription', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: /s'inscrire/i })).toBeInTheDocument()
  })
})

describe('Login — Soumission réussie', () => {
  beforeEach(() => {
    api.post.mockResolvedValue({
      data: {
        message: 'Connexion réussie',
        data: { id: 1, nom: 'Dupont', prenom: 'Alice', email: 'a@test.fr', role: 'collaborateur' },
      },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockNavigate.mockReset()
  })

  it('appelle api.post avec les bonnes données', async () => {
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText(/jean\.dupont/i), {
      target: { value: 'alice@test.fr', name: 'email' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Password1!', name: 'mot_de_passe' },
    })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/login', {
        email: 'alice@test.fr',
        mot_de_passe: 'Password1!',
      })
    })
  })

  it('stocke les données utilisateur dans localStorage', async () => {
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText(/jean\.dupont/i), {
      target: { value: 'alice@test.fr', name: 'email' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Password1!', name: 'mot_de_passe' },
    })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('cesizen_user'))
      expect(stored.email).toBe('a@test.fr')
    })
  })

  it('redirige un collaborateur vers /dashboard', async () => {
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText(/jean\.dupont/i), {
      target: { value: 'alice@test.fr', name: 'email' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Password1!', name: 'mot_de_passe' },
    })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    // Attend la redirection (avec délai setTimeout)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    }, { timeout: 3000 })
  })

  it('redirige un admin vers /dashboard (redirection universelle)', async () => {
    api.post.mockResolvedValue({
      data: {
        message: 'OK',
        data: { id: 2, nom: 'Admin', prenom: 'Super', email: 'admin@test.fr', role: 'admin' },
      },
    })
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText(/jean\.dupont/i), {
      target: { value: 'admin@test.fr', name: 'email' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Password1!', name: 'mot_de_passe' },
    })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    }, { timeout: 3000 })
  })
})

describe('Login — Erreur API', () => {
  beforeEach(() => {
    api.post.mockRejectedValue({
      response: { data: { message: 'Identifiants invalides.' } },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('affiche le message d\'erreur retourné par l\'API', async () => {
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText(/jean\.dupont/i), {
      target: { value: 'wrong@test.fr', name: 'email' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'WrongPass1!', name: 'mot_de_passe' },
    })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(screen.getByText('Identifiants invalides.')).toBeInTheDocument()
    })
  })
})
