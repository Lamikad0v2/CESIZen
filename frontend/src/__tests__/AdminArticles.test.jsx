import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminArticles from '../pages/AdminArticles'

// ── Mocks ─────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('../api/axios', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    put:    vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('lucide-react', () => ({
  Plus:     () => <span data-testid="icon-plus" />,
  Pencil:   () => <span data-testid="icon-pencil" />,
  Trash2:   () => <span data-testid="icon-trash" />,
  X:        () => <span data-testid="icon-x" />,
  BookOpen: () => <span data-testid="icon-book" />,
}))

import api from '../api/axios'

// ── Fixtures ──────────────────────────────────────────────────────

const ARTICLES = [
  {
    id: 1, title: 'Gérer le stress au travail', content: 'Contenu détaillé sur le stress...',
    author_id: 1, author_prenom: 'Admin', author_nom: 'Test',
    created_at: '2026-04-01T10:00:00', updated_at: '2026-04-01T10:00:00',
  },
  {
    id: 2, title: 'Les bienfaits de la pleine conscience', content: 'Contenu sur la méditation...',
    author_id: 1, author_prenom: 'Admin', author_nom: 'Test',
    created_at: '2026-04-02T10:00:00', updated_at: '2026-04-02T10:00:00',
  },
]

// ── Helpers ───────────────────────────────────────────────────────

function setUser(role = 'admin') {
  localStorage.setItem(
    'cesizen_user',
    JSON.stringify({ id: 1, nom: 'Test', prenom: 'Admin', role, email: 'admin@test.fr' }),
  )
}

function mockApiSuccess() {
  api.get.mockResolvedValue({ data: { data: ARTICLES } })
}

function renderPage() {
  return render(<AdminArticles />)
}

// ── Accès et sécurité ─────────────────────────────────────────────

describe('AdminArticles — Accès et sécurité', () => {
  afterEach(() => { localStorage.clear(); vi.clearAllMocks(); mockNavigate.mockReset() })

  it('redirige vers /login si aucun utilisateur en localStorage', () => {
    api.get.mockResolvedValue({ data: { data: [] } })
    renderPage()
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('redirige vers /dashboard si le rôle est collaborateur', () => {
    setUser('collaborateur')
    api.get.mockResolvedValue({ data: { data: [] } })
    renderPage()
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  it('redirige vers /dashboard si le rôle est manager', () => {
    setUser('manager')
    api.get.mockResolvedValue({ data: { data: [] } })
    renderPage()
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  it('affiche la page pour un admin', async () => {
    setUser('admin')
    mockApiSuccess()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Gestion des Articles')).toBeInTheDocument()
    })
  })

  it('affiche la page pour un rh', async () => {
    setUser('rh')
    mockApiSuccess()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Gestion des Articles')).toBeInTheDocument()
    })
  })
})

// ── Affichage de la liste ─────────────────────────────────────────

describe('AdminArticles — Liste des articles', () => {
  beforeEach(() => {
    setUser('admin')
    mockApiSuccess()
  })
  afterEach(() => { localStorage.clear(); vi.clearAllMocks() })

  it('affiche le bouton "Nouvel article"', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nouvel article/i })).toBeInTheDocument()
    })
  })

  it('affiche les titres des articles', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Gérer le stress au travail')).toBeInTheDocument()
      expect(screen.getByText('Les bienfaits de la pleine conscience')).toBeInTheDocument()
    })
  })

  it('affiche les boutons Modifier pour chaque article', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByTitle('Modifier')).toHaveLength(2)
    })
  })

  it('affiche les boutons Supprimer pour chaque article', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByTitle('Supprimer')).toHaveLength(2)
    })
  })
})

// ── Formulaire de création ────────────────────────────────────────

describe('AdminArticles — Formulaire de création', () => {
  beforeEach(() => {
    setUser('admin')
    api.get.mockResolvedValue({ data: { data: [] } })
  })
  afterEach(() => { localStorage.clear(); vi.clearAllMocks() })

  it('ouvre le formulaire au clic sur "Nouvel article"', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /nouvel article/i })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /nouvel article/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/titre de l'article/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/rédigez le contenu/i)).toBeInTheDocument()
    })
  })

  it('affiche le titre "Nouvel article" dans la modal', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /nouvel article/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /nouvel article/i }))

    await waitFor(() => {
      // Le titre de la modal (h3) + le bouton de la page ont le même texte — on cherche le h3
      expect(screen.getByRole('heading', { name: /nouvel article/i })).toBeInTheDocument()
    })
  })

  it('ferme le formulaire au clic sur Annuler', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /nouvel article/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /nouvel article/i }))

    await waitFor(() => expect(screen.getByPlaceholderText(/titre de l'article/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /annuler/i }))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/titre de l'article/i)).not.toBeInTheDocument()
    })
  })
})

// ── Formulaire d'édition ──────────────────────────────────────────

describe('AdminArticles — Formulaire d\'édition', () => {
  beforeEach(() => {
    setUser('admin')
    mockApiSuccess()
  })
  afterEach(() => { localStorage.clear(); vi.clearAllMocks() })

  it('pré-remplit le formulaire avec le titre de l\'article à éditer', async () => {
    renderPage()
    const editButtons = await screen.findAllByTitle('Modifier')
    fireEvent.click(editButtons[0])

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/titre de l'article/i)
      expect(input.value).toBe('Gérer le stress au travail')
    })
  })
})

// ── Modal de suppression ──────────────────────────────────────────

describe('AdminArticles — Confirmation de suppression', () => {
  beforeEach(() => {
    setUser('admin')
    mockApiSuccess()
  })
  afterEach(() => { localStorage.clear(); vi.clearAllMocks() })

  it('ouvre la modal de confirmation au clic Supprimer', async () => {
    renderPage()
    const deleteButtons = await screen.findAllByTitle('Supprimer')
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/supprimer définitivement/i)).toBeInTheDocument()
    })
  })
})
