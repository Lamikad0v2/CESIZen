import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Layout from '../components/Layout'

// ── Mocks ─────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
let mockPathname   = '/dashboard'

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
  Link: ({ children, to, className, 'aria-label': al }) => (
    <a href={to} className={className} aria-label={al}>{children}</a>
  ),
}))

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ dark: false, toggle: vi.fn() }),
}))

// ── Helpers ───────────────────────────────────────────────────────

function setUser(role = 'collaborateur') {
  localStorage.setItem(
    'cesizen_user',
    JSON.stringify({ id: 1, nom: 'Dupont', prenom: 'Alice', role, email: 'a@test.fr' })
  )
}

function renderLayout(children = <span>Contenu</span>) {
  return render(<Layout>{children}</Layout>)
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Layout — Navigation conditionnelle', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockNavigate.mockReset()
    mockPathname = '/dashboard'
  })

  it('affiche le lien Accueil pour tout rôle', () => {
    setUser('collaborateur')
    renderLayout()
    // Le label a été renommé "Tableau de bord"
    const links = screen.getAllByRole('link', { name: /tableau de bord/i })
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it('affiche le lien Profil pour tout rôle', () => {
    setUser('collaborateur')
    renderLayout()
    const links = screen.getAllByRole('link', { name: /profil/i })
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it('affiche le lien Administration pour un admin', () => {
    setUser('admin')
    renderLayout()
    const links = screen.getAllByRole('link', { name: /administration/i })
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it('affiche le lien Administration pour un rh', () => {
    setUser('rh')
    renderLayout()
    const links = screen.getAllByRole('link', { name: /administration/i })
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it('n\'affiche PAS le lien Administration pour un collaborateur', () => {
    setUser('collaborateur')
    renderLayout()
    expect(screen.queryByRole('link', { name: /administration/i })).not.toBeInTheDocument()
  })

  it('affiche le lien Équipe pour un manager', () => {
    setUser('manager')
    renderLayout()
    const links = screen.getAllByRole('link', { name: /équipe/i })
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it('n\'affiche PAS le lien Équipe pour un collaborateur', () => {
    setUser('collaborateur')
    renderLayout()
    expect(screen.queryByRole('link', { name: /équipe/i })).not.toBeInTheDocument()
  })

  it('n\'affiche PAS le lien Équipe pour un admin', () => {
    setUser('admin')
    renderLayout()
    expect(screen.queryByRole('link', { name: /équipe/i })).not.toBeInTheDocument()
  })
})

describe('Layout — Header et contenu', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('affiche le bouton toggle dark/light mode', () => {
    setUser()
    renderLayout()
    expect(
      screen.getByRole('button', { name: /activer le mode sombre/i })
    ).toBeInTheDocument()
  })

  it('affiche le lien vers le profil dans le header', () => {
    setUser()
    renderLayout()
    expect(screen.getByRole('link', { name: /mon profil/i })).toBeInTheDocument()
  })

  it('affiche le prénom de l\'utilisateur dans le header', () => {
    setUser()
    renderLayout()
    // Le prénom est visible dans le header (sm:inline)
    const prenom = screen.getAllByText('Alice')
    expect(prenom.length).toBeGreaterThanOrEqual(1)
  })

  it('affiche le contenu enfant dans la zone principale', () => {
    setUser()
    renderLayout(<span>Mon contenu test</span>)
    expect(screen.getByText('Mon contenu test')).toBeInTheDocument()
  })
})

describe('Layout — Déconnexion', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('supprime localStorage et redirige vers /login', () => {
    setUser()
    renderLayout()
    const logoutBtn = screen.getByRole('button', { name: /déconnexion/i })
    fireEvent.click(logoutBtn)
    expect(localStorage.getItem('cesizen_user')).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })
})

describe('Layout — Sidebar collapse', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('affiche le bouton "Réduire la sidebar" par défaut (expanded)', () => {
    setUser()
    renderLayout()
    expect(screen.getByRole('button', { name: /réduire la sidebar/i })).toBeInTheDocument()
  })

  it('passe à "Développer la sidebar" après un clic', () => {
    setUser()
    renderLayout()
    const btn = screen.getByRole('button', { name: /réduire la sidebar/i })
    fireEvent.click(btn)
    expect(screen.getByRole('button', { name: /développer la sidebar/i })).toBeInTheDocument()
  })

  it('persiste l\'état collapsed dans localStorage', () => {
    setUser()
    renderLayout()
    const btn = screen.getByRole('button', { name: /réduire la sidebar/i })
    fireEvent.click(btn)
    expect(localStorage.getItem('cesizen_sidebar_collapsed')).toBe('true')
  })

  it('restaure l\'état collapsed depuis localStorage', () => {
    localStorage.setItem('cesizen_sidebar_collapsed', 'true')
    setUser()
    renderLayout()
    expect(screen.getByRole('button', { name: /développer la sidebar/i })).toBeInTheDocument()
  })

  it('affiche les catégories de navigation Personnel / Équipe / Gestion pour admin', () => {
    setUser('admin')
    renderLayout()
    expect(screen.getByText('Personnel')).toBeInTheDocument()
    expect(screen.getByText('Gestion')).toBeInTheDocument()
  })

  it('affiche la catégorie Équipe pour un manager', () => {
    setUser('manager')
    renderLayout()
    // "Équipe" apparaît comme header de section ET comme lien de navigation
    expect(screen.getAllByText('Équipe').length).toBeGreaterThanOrEqual(1)
  })

  it('n\'affiche PAS la catégorie Gestion pour un collaborateur', () => {
    setUser('collaborateur')
    renderLayout()
    expect(screen.queryByText('Gestion')).not.toBeInTheDocument()
  })
})
