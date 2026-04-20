import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminDashboard from '../pages/AdminDashboard'

// ── Mocks ─────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, className }) => <a href={to} className={className}>{children}</a>,
}))

vi.mock('../api/axios', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    put:    vi.fn(),
    delete: vi.fn(),
  },
}))

// lucide-react : retourne des spans avec data-testid pour les icônes nécessaires
vi.mock('lucide-react', () => ({
  LogOut:        () => <span data-testid="icon-logout" />,
  Plus:          () => <span data-testid="icon-plus" />,
  Pencil:        () => <span data-testid="icon-pencil" />,
  Trash2:        () => <span data-testid="icon-trash" />,
  X:             () => <span data-testid="icon-x" />,
  Users:         () => <span data-testid="icon-users" />,
  Building2:     () => <span data-testid="icon-building" />,
  ShieldCheck:   () => <span data-testid="icon-shield" />,
  AlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  Bell:          () => <span data-testid="icon-bell" />,
  CheckCheck:    () => <span data-testid="icon-checkcheck" />,
  BookOpen:      () => <span data-testid="icon-book" />,
}))

import api from '../api/axios'

// ── Fixtures ──────────────────────────────────────────────────────

const TEAMS = [
  { id: 1, nom_equipe: 'Développement', nombre_membres: 3 },
]

const ADMIN_USER   = { id: 1, nom: 'Martin', prenom: 'Super', email: 'admin@test.fr', role: 'admin', nom_equipe: null, team_id: null }
const COLLAB_USER  = { id: 2, nom: 'Dupont', prenom: 'Alice', email: 'alice@test.fr', role: 'collaborateur', nom_equipe: 'Développement', team_id: 1 }

const USERS = [ADMIN_USER, COLLAB_USER]

const ALERTS = [
  { id: 1, prenom: 'Alice', nom: 'Dupont', email: 'alice@test.fr', nom_equipe: 'Développement', message: "Alerte burn-out : niveau d'énergie < 30 pendant 3 jours consécutifs.", is_read: 0, created_at: '2026-04-05T10:00:00' },
  { id: 2, prenom: 'Bob',   nom: 'Leroy',  email: 'bob@test.fr',   nom_equipe: null,             message: 'Alerte répétée',                                                         is_read: 1, created_at: '2026-04-04T10:00:00' },
]

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Stocke un utilisateur dans localStorage.
 * id=99 ≠ tous les USERS ci-dessus → pas de "(vous)" sur les lignes de la table.
 */
function setUser(role = 'admin') {
  localStorage.setItem(
    'cesizen_user',
    JSON.stringify({ id: 99, nom: 'Admin', prenom: 'Test', role, email: 'test@admin.fr' })
  )
}

function mockApiSuccess() {
  api.get.mockImplementation((url) => {
    if (url === '/api/teams')        return Promise.resolve({ data: { data: TEAMS } })
    if (url === '/api/admin/users')  return Promise.resolve({ data: { data: USERS } })
    if (url === '/api/admin/alerts') return Promise.resolve({ data: { data: ALERTS } })
    if (url === '/api/articles')     return Promise.resolve({ data: { data: [] } })
    return Promise.resolve({ data: { data: [] } })
  })
}

function renderAdmin() {
  return render(<AdminDashboard />)
}

// ── Tests ─────────────────────────────────────────────────────────

describe('AdminDashboard — Accès et sécurité', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('redirige vers /login si aucun utilisateur en localStorage', () => {
    api.get.mockResolvedValue({ data: { data: [] } })
    renderAdmin()
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('redirige vers /dashboard si l\'utilisateur est collaborateur', () => {
    setUser('collaborateur')
    api.get.mockResolvedValue({ data: { data: [] } })
    renderAdmin()
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  it('redirige vers /dashboard si l\'utilisateur est manager', () => {
    setUser('manager')
    api.get.mockResolvedValue({ data: { data: [] } })
    renderAdmin()
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  it('affiche le panel pour un admin', async () => {
    setUser('admin')
    mockApiSuccess()
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('Gestion RH')).toBeInTheDocument()
    })
  })

  it('affiche le panel pour un rh', async () => {
    setUser('rh')
    mockApiSuccess()
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('Gestion RH')).toBeInTheDocument()
    })
  })
})

describe('AdminDashboard — Navigation par onglets', () => {
  beforeEach(() => {
    setUser('admin')
    mockApiSuccess()
  })

  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('affiche l\'onglet Équipes par défaut', async () => {
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('Liste des équipes')).toBeInTheDocument()
    })
  })

  it('affiche les données d\'équipe dans le tableau', async () => {
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('Développement')).toBeInTheDocument()
    })
  })

  it('bascule vers l\'onglet Utilisateurs', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByRole('button', { name: /utilisateurs/i })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /utilisateurs/i }))

    await waitFor(() => {
      expect(screen.getByText('Liste des utilisateurs')).toBeInTheDocument()
    })
  })

  it('affiche le badge du nombre d\'alertes non lues', async () => {
    renderAdmin()
    // ALERTS a 1 alerte non lue (is_read: 0)
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  it('bascule vers l\'onglet Alertes RH', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByRole('button', { name: /alertes/i })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /alertes/i }))

    await waitFor(() => {
      expect(screen.getByText('Alertes prévention burn-out')).toBeInTheDocument()
    })
  })

  it('affiche les alertes dans la table', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByRole('button', { name: /alertes/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /alertes/i }))

    await waitFor(() => {
      expect(screen.getByText(/niveau d'énergie < 30/i)).toBeInTheDocument()
    })
  })
})

describe('AdminDashboard — Contrôle d\'accès sur le bouton Supprimer', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('admin peut voir le bouton Supprimer sur la ligne d\'un autre admin', async () => {
    setUser('admin') // id: 99, role: admin
    mockApiSuccess() // USERS contient ADMIN_USER (id: 1, role: admin)
    renderAdmin()

    fireEvent.click(await screen.findByRole('button', { name: /utilisateurs/i }))

    // u.id(1) !== user.id(99) && !(admin && admin) → true → bouton affiché
    // Cherchons les boutons Supprimer : 2 utilisateurs, 2 boutons (les deux non-self)
    await waitFor(() => {
      expect(screen.getAllByTitle('Supprimer')).toHaveLength(2)
    })
  })

  it('rh NE PEUT PAS supprimer un admin (bouton caché)', async () => {
    setUser('rh') // id: 99, role: rh
    mockApiSuccess() // USERS: [admin(id:1), collab(id:2)]
    renderAdmin()

    fireEvent.click(await screen.findByRole('button', { name: /utilisateurs/i }))

    // Pour la ligne admin: !(rh && admin) = false → bouton masqué
    // Pour la ligne collab: !(rh && collaborateur) = true → bouton visible
    // → 1 seul bouton Supprimer au total
    await waitFor(() => {
      expect(screen.getAllByTitle('Supprimer')).toHaveLength(1)
    })
  })

  it('rh PEUT supprimer un collaborateur (bouton visible)', async () => {
    setUser('rh') // id: 99, role: rh
    mockApiSuccess()
    renderAdmin()

    fireEvent.click(await screen.findByRole('button', { name: /utilisateurs/i }))

    await waitFor(() => {
      // Le seul bouton visible doit être celui de la ligne collaborateur
      const deleteButtons = screen.getAllByTitle('Supprimer')
      expect(deleteButtons).toHaveLength(1)
    })
  })
})

describe('AdminDashboard — Modals', () => {
  beforeEach(() => {
    setUser('admin')
    mockApiSuccess()
  })

  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('ouvre la modal de création d\'équipe au clic sur "Créer une équipe"', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Créer une équipe')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /créer une équipe/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/équipe produit/i)).toBeInTheDocument()
    })
  })

  it('ferme la modal au clic sur Annuler', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Créer une équipe')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /créer une équipe/i }))

    await waitFor(() => expect(screen.getByPlaceholderText(/équipe produit/i)).toBeInTheDocument())

    // La modal s'ouvre — on clique sur le bouton X (icon-x) pour la fermer
    const xButtons = screen.getAllByTestId('icon-x')
    // Premier X = fermer la modal (le toast X n'est pas présent)
    fireEvent.click(xButtons[0].closest('button'))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/équipe produit/i)).not.toBeInTheDocument()
    })
  })

  it('affiche une modal de confirmation de suppression d\'équipe', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Développement')).toBeInTheDocument())

    // Bouton Supprimer de la ligne Développement
    const deleteBtn = screen.getByTitle('Supprimer')
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText('Confirmer la suppression')).toBeInTheDocument()
      expect(screen.getByText(/membres seront retirés/i)).toBeInTheDocument()
    })
  })
})

describe('AdminDashboard — Alertes RH : marquer comme lu', () => {
  beforeEach(() => {
    setUser('admin')
    mockApiSuccess()
  })

  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('appelle api.put sur /api/admin/alerts/:id/read au clic "Marquer lu"', async () => {
    api.put.mockResolvedValue({ data: { message: 'OK' } })
    renderAdmin()

    fireEvent.click(await screen.findByRole('button', { name: /alertes/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /lu/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /lu/i }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/api/admin/alerts/1/read')
    })
  })
})

describe('AdminDashboard — Erreur API', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('affiche un toast d\'erreur si le chargement échoue', async () => {
    setUser('admin')
    api.get.mockRejectedValue(new Error('Network error'))
    renderAdmin()

    await waitFor(() => {
      expect(screen.getByText(/erreur lors du chargement/i)).toBeInTheDocument()
    })
  })
})

// La déconnexion est désormais gérée dans Layout.jsx (testé dans Layout.test.jsx)
