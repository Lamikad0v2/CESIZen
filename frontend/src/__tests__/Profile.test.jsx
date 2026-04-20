import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Profile from '../pages/Profile'

// ── Mocks ─────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}))

vi.mock('../api/axios', () => ({
  default: {
    put:    vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '../api/axios'

// ── Helpers ───────────────────────────────────────────────────────

function setUser(overrides = {}) {
  const user = {
    id: 1, nom: 'Dupont', prenom: 'Alice',
    role: 'collaborateur', email: 'alice@test.fr',
    ...overrides,
  }
  localStorage.setItem('cesizen_user', JSON.stringify(user))
  return user
}

function renderProfile() {
  return render(<Profile />)
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Profile — Rendu initial', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('redirige vers /login si pas d\'utilisateur en localStorage', () => {
    renderProfile()
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('affiche le nom et prénom de l\'utilisateur', () => {
    setUser()
    renderProfile()
    expect(screen.getByText('Alice Dupont')).toBeInTheDocument()
  })

  it('affiche l\'email de l\'utilisateur', () => {
    setUser()
    renderProfile()
    expect(screen.getByText('alice@test.fr')).toBeInTheDocument()
  })

  it('affiche le bouton RGPD de suppression de compte', () => {
    setUser()
    renderProfile()
    expect(
      screen.getByRole('button', { name: /supprimer mon compte/i })
    ).toBeInTheDocument()
  })

  it('pré-remplit le formulaire avec le prénom et le nom', () => {
    setUser()
    renderProfile()
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Dupont')).toBeInTheDocument()
  })

  it('affiche le label "Collaborateur" pour le rôle', () => {
    setUser({ role: 'collaborateur' })
    renderProfile()
    expect(screen.getByText('Collaborateur')).toBeInTheDocument()
  })
})

describe('Profile — Modification du profil', () => {
  beforeEach(() => {
    setUser()
  })

  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('appelle api.put avec les bonnes données', async () => {
    api.put.mockResolvedValue({
      data: { message: 'Profil mis à jour avec succès.', data: { prenom: 'Alice', nom: 'Dupont' } },
    })
    renderProfile()

    fireEvent.change(screen.getByDisplayValue('Alice'), {
      target: { name: 'prenom', value: 'Alicia' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/api/account/profile', expect.objectContaining({
        prenom: 'Alicia',
        nom:    'Dupont',
      }))
    })
  })

  it('affiche le message de succès après modification', async () => {
    api.put.mockResolvedValue({
      data: { message: 'Profil mis à jour avec succès.', data: { prenom: 'Alice', nom: 'Dupont' } },
    })
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Profil mis à jour avec succès.')).toBeInTheDocument()
    })
  })

  it('affiche l\'erreur API si la requête échoue', async () => {
    api.put.mockRejectedValue({
      response: { data: { message: 'Prénom invalide.' } },
    })
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Prénom invalide.')).toBeInTheDocument()
    })
  })
})

describe('Profile — Suppression RGPD', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('ouvre la modale de confirmation au clic sur Supprimer', () => {
    setUser()
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: /supprimer mon compte/i }))
    expect(screen.getByText('Supprimer définitivement')).toBeInTheDocument()
  })

  it('ferme la modale au clic sur Annuler', () => {
    setUser()
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: /supprimer mon compte/i }))
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }))
    expect(screen.queryByText('Supprimer définitivement')).not.toBeInTheDocument()
  })

  it('supprime le compte et redirige vers /login', async () => {
    setUser()
    api.delete.mockResolvedValue({ data: { message: 'OK' } })
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: /supprimer mon compte/i }))
    fireEvent.click(screen.getByRole('button', { name: /supprimer définitivement/i }))

    await waitFor(() => {
      expect(localStorage.getItem('cesizen_user')).toBeNull()
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    })
  })
})
