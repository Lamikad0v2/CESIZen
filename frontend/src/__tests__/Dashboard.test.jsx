import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Insights, { computeStreak, computeTagFrequency, getWeatherText } from '../pages/Insights'

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}))

vi.mock('../api/axios', () => ({
  default: {
    get:  vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('recharts', () => ({
  AreaChart:           ({ children }) => <div data-testid="chart">{children}</div>,
  Area:                () => null,
  XAxis:               () => null,
  YAxis:               () => null,
  Tooltip:             () => null,
  ReferenceLine:       () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  ScatterChart:        ({ children }) => <div data-testid="scatter-chart">{children}</div>,
  Scatter:             () => null,
  ReferenceArea:       () => null,
  Cell:                () => null,
}))

// Mock MoodForm (exporté depuis components/MoodForm)
vi.mock('../components/MoodForm', () => ({
  default:        () => null,
  getValenceMeta: (v) => {
    if (v >= 75) return { label: 'Très agréable',   textClass: 'text-cesizen-600', bgClass: 'bg-cesizen-50' }
    if (v >= 55) return { label: 'Agréable',         textClass: 'text-sky-600',     bgClass: 'bg-sky-50' }
    if (v >= 45) return { label: 'Neutre',            textClass: 'text-gray-500',    bgClass: 'bg-gray-50' }
    if (v >= 25) return { label: 'Désagréable',       textClass: 'text-orange-500',  bgClass: 'bg-orange-50' }
    return              { label: 'Très désagréable',  textClass: 'text-red-500',     bgClass: 'bg-red-50' }
  },
  getArousalMeta: (a) => {
    if (a >= 75) return { label: 'Survolté',  textClass: 'text-amber-500',   bgClass: 'bg-amber-50' }
    if (a >= 55) return { label: 'Actif',     textClass: 'text-emerald-600', bgClass: 'bg-emerald-50' }
    if (a >= 45) return { label: 'Modéré',   textClass: 'text-gray-500',    bgClass: 'bg-gray-50' }
    if (a >= 25) return { label: 'Fatigué',  textClass: 'text-indigo-400',  bgClass: 'bg-indigo-50' }
    return              { label: 'Épuisé',   textClass: 'text-slate-500',   bgClass: 'bg-slate-50' }
  },
}))

import api from '../api/axios'

// ── Fixtures v3 : valence + arousal ───────────────────────────────

const EMPTY_HISTORY = [
  { date: '2026-04-08', valence: null, arousal: null, context_tags: [], commentaire: null },
  { date: '2026-04-09', valence: null, arousal: null, context_tags: [], commentaire: null },
  { date: '2026-04-10', valence: null, arousal: null, context_tags: [], commentaire: null },
  { date: '2026-04-11', valence: null, arousal: null, context_tags: [], commentaire: null },
  { date: '2026-04-12', valence: null, arousal: null, context_tags: [], commentaire: null },
  { date: '2026-04-13', valence: null, arousal: null, context_tags: [], commentaire: null },
  { date: '2026-04-14', valence: null, arousal: null, context_tags: [], commentaire: null },
]

const HISTORY_WITH_DATA = [
  { date: '2026-04-08', valence: 60,   arousal: 70,   context_tags: ['Management'],        commentaire: null },
  { date: '2026-04-09', valence: 75,   arousal: 65,   context_tags: ['Charge de travail'], commentaire: null },
  { date: '2026-04-10', valence: 90,   arousal: 80,   context_tags: [],                    commentaire: null },
  { date: '2026-04-11', valence: null, arousal: null, context_tags: [],                    commentaire: null },
  { date: '2026-04-12', valence: null, arousal: null, context_tags: [],                    commentaire: null },
  { date: '2026-04-13', valence: null, arousal: null, context_tags: [],                    commentaire: null },
  { date: '2026-04-14', valence: null, arousal: null, context_tags: [],                    commentaire: null },
]

function setUser(role = 'collaborateur') {
  localStorage.setItem(
    'cesizen_user',
    JSON.stringify({ id: 1, nom: 'Dupont', prenom: 'Alice', role, email: 'a@test.fr' })
  )
}

function renderInsights() {
  return render(<Insights />)
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Insights — Accès et sécurité', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('ne rend rien si aucun utilisateur en localStorage', () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    const { container } = renderInsights()
    expect(container.firstChild).toBeNull()
  })

  it('affiche le titre "Tableau de bord" si connecté', async () => {
    setUser()
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByText('Tableau de bord')).toBeInTheDocument()
    })
  })
})

describe('Insights — Statistiques Bento', () => {
  beforeEach(() => { setUser() })
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('affiche la carte "Série active"', async () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByText('Série active')).toBeInTheDocument()
    })
  })

  it('affiche la carte "Valence moy. 7j"', async () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByText('Valence moy. 7j')).toBeInTheDocument()
    })
  })

  it('affiche la carte "Activation moy. 7j"', async () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByText('Activation moy. 7j')).toBeInTheDocument()
    })
  })

  it('affiche la carte "Saisies / 7j"', async () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByText('Saisies / 7j')).toBeInTheDocument()
    })
  })

  it('affiche la section "Récapitulatif de la semaine"', async () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByText('Récapitulatif de la semaine')).toBeInTheDocument()
    })
  })

  it('affiche "7/7" quand toutes les saisies sont présentes', async () => {
    const fullHistory = EMPTY_HISTORY.map((e, i) => ({
      ...e, valence: 40 + i * 8, arousal: 50 + i * 5,
    }))
    api.get.mockResolvedValue({ data: { data: fullHistory } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByText('7/7')).toBeInTheDocument()
    })
  })

  it('affiche "3/7" pour trois jours saisis', async () => {
    api.get.mockResolvedValue({ data: { data: HISTORY_WITH_DATA } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByText('3/7')).toBeInTheDocument()
    })
  })

  it('affiche le CTA "Saisir mon humeur du jour" si non soumis', async () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByText(/saisir mon humeur du jour/i)).toBeInTheDocument()
    })
  })

  it('masque le CTA si humeur déjà saisie aujourd\'hui', async () => {
    const today = new Date().toISOString().split('T')[0]
    const historyWithToday = EMPTY_HISTORY.map(e =>
      e.date === today ? { ...e, valence: 75, arousal: 65 } : e
    )
    api.get.mockResolvedValue({ data: { data: historyWithToday } })
    renderInsights()
    await waitFor(() => {
      expect(screen.queryByText(/saisir mon humeur du jour/i)).not.toBeInTheDocument()
    })
  })

  it('affiche les context_tags dans le récapitulatif hebdo', async () => {
    api.get.mockResolvedValue({ data: { data: HISTORY_WITH_DATA } })
    renderInsights()
    await waitFor(() => {
      // "Management" peut apparaître plusieurs fois (récap + Focus Contextuel)
      expect(screen.getAllByText('Management').length).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('Insights — Streak Ring', () => {
  beforeEach(() => { setUser() })
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('affiche le ring de série (data-testid)', async () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByTestId('streak-ring')).toBeInTheDocument()
    })
  })

  it('affiche "0" dans le ring quand aucune saisie', async () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByTestId('streak-ring')).toHaveTextContent('0')
    })
  })
})

describe('Insights — Météo Intérieure', () => {
  beforeEach(() => { setUser() })
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('affiche le titre "Météo Intérieure"', async () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByText('Météo Intérieure')).toBeInTheDocument()
    })
  })

  it('affiche un message d\'invitation si aucune donnée', async () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByTestId('weather-text')).toHaveTextContent(/commencez à saisir/i)
    })
  })

  it('affiche un texte de météo si données présentes', async () => {
    api.get.mockResolvedValue({ data: { data: HISTORY_WITH_DATA } })
    renderInsights()
    await waitFor(() => {
      const weatherEl = screen.getByTestId('weather-text')
      expect(weatherEl.textContent.length).toBeGreaterThan(10)
    })
  })
})

describe('Insights — Focus Contextuel', () => {
  beforeEach(() => { setUser() })
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('affiche le titre "Focus Contextuel"', async () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByText('Focus Contextuel')).toBeInTheDocument()
    })
  })

  it('affiche les barres de tags quand des contextes sont présents', async () => {
    api.get.mockResolvedValue({ data: { data: HISTORY_WITH_DATA } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByTestId('focus-tag-Management')).toBeInTheDocument()
    })
  })
})

describe('Insights — Carte émotionnelle Russell', () => {
  beforeEach(() => { setUser() })
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('affiche le titre "Carte émotionnelle"', async () => {
    api.get.mockResolvedValue({ data: { data: EMPTY_HISTORY } })
    renderInsights()
    await waitFor(() => {
      expect(screen.getByText(/carte émotionnelle/i)).toBeInTheDocument()
    })
  })
})

// ── Tests purs des helpers exportés ─────────────────────────────

describe('computeStreak — calcul de la série', () => {
  it('retourne 0 pour un historique vide', () => {
    expect(computeStreak([])).toBe(0)
  })

  it('retourne 0 si aucune saisie n\'a de valence', () => {
    expect(computeStreak(EMPTY_HISTORY)).toBe(0)
  })
})

describe('computeTagFrequency — fréquence des tags', () => {
  it('retourne un tableau vide si aucun tag', () => {
    expect(computeTagFrequency(EMPTY_HISTORY)).toEqual([])
  })

  it('compte correctement les tags', () => {
    const result = computeTagFrequency(HISTORY_WITH_DATA)
    expect(result[0].tag).toBe('Management')
    expect(result[0].count).toBe(1)
  })

  it('trie par fréquence décroissante', () => {
    const history = [
      { context_tags: ['A', 'B'] },
      { context_tags: ['A'] },
      { context_tags: ['B', 'C'] },
    ]
    const result = computeTagFrequency(history)
    expect(result[0].count).toBeGreaterThanOrEqual(result[1]?.count ?? 0)
  })

  it('limite à 5 tags maximum', () => {
    const manyTags = [{ context_tags: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }]
    expect(computeTagFrequency(manyTags)).toHaveLength(5)
  })
})

describe('getWeatherText — texte de météo', () => {
  it('retourne le message d\'invitation si avgValence est null', () => {
    expect(getWeatherText(null, null, null)).toMatch(/commencez à saisir/i)
  })

  it('retourne texte "dynamique" pour valence haute + arousal haut', () => {
    expect(getWeatherText(70, 70, null)).toMatch(/dynamique/i)
  })

  it('retourne texte "serein" pour valence haute + arousal bas', () => {
    expect(getWeatherText(70, 30, null)).toMatch(/serein/i)
  })

  it('retourne texte "tension" pour valence basse + arousal haut', () => {
    expect(getWeatherText(30, 70, null)).toMatch(/tension/i)
  })

  it('retourne texte "épuisante" pour valence basse + arousal bas (zone burn-out)', () => {
    expect(getWeatherText(25, 25, null)).toMatch(/épuisante/i)
  })

  it('mentionne le topTag dans le texte quand fourni', () => {
    expect(getWeatherText(70, 70, 'Management')).toContain('Management')
  })
})
