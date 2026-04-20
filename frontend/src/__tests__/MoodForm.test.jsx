import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MoodForm, { CONTEXT_TAGS, getValenceMeta, getArousalMeta } from '../components/MoodForm'

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock('../api/axios', () => ({
  default: {
    get:  vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('lucide-react', () => ({
  CheckCircle2: () => <span data-testid="icon-check" />,
  AlertCircle:  () => <span data-testid="icon-alert" />,
  Send:         () => <span data-testid="icon-send" />,
}))

import api from '../api/axios'

// ── Helpers ───────────────────────────────────────────────────────

function renderForm(onSuccess = vi.fn()) {
  return render(<MoodForm onSuccess={onSuccess} />)
}

// ── Tests : getValenceMeta ────────────────────────────────────────

describe('getValenceMeta — classification de la valence', () => {
  it('retourne "Très désagréable" pour valence 10', () => {
    expect(getValenceMeta(10).label).toBe('Très désagréable')
  })

  it('retourne "Désagréable" pour valence 30', () => {
    expect(getValenceMeta(30).label).toBe('Désagréable')
  })

  it('retourne "Neutre" pour valence 47', () => {
    expect(getValenceMeta(47).label).toBe('Neutre')
  })

  it('retourne "Agréable" pour valence 60', () => {
    expect(getValenceMeta(60).label).toBe('Agréable')
  })

  it('retourne "Très agréable" pour valence 80', () => {
    expect(getValenceMeta(80).label).toBe('Très agréable')
  })

  it('seuil burn-out : valence 29 est "Désagréable" (< 30)', () => {
    expect(getValenceMeta(29).label).toBe('Désagréable')
  })
})

// ── Tests : getArousalMeta ────────────────────────────────────────

describe('getArousalMeta — classification de l\'activation', () => {
  it('retourne "Épuisé" pour arousal 10', () => {
    expect(getArousalMeta(10).label).toBe('Épuisé')
  })

  it('retourne "Fatigué" pour arousal 30', () => {
    expect(getArousalMeta(30).label).toBe('Fatigué')
  })

  it('retourne "Modéré" pour arousal 47', () => {
    expect(getArousalMeta(47).label).toBe('Modéré')
  })

  it('retourne "Actif" pour arousal 60', () => {
    expect(getArousalMeta(60).label).toBe('Actif')
  })

  it('retourne "Survolté" pour arousal 80', () => {
    expect(getArousalMeta(80).label).toBe('Survolté')
  })

  it('seuil burn-out : arousal 29 est "Fatigué" (< 30)', () => {
    expect(getArousalMeta(29).label).toBe('Fatigué')
  })
})

// ── Tests : Sliders ───────────────────────────────────────────────

describe('MoodForm — Sliders circomplexes', () => {
  afterEach(() => vi.clearAllMocks())

  it('affiche deux sliders (valence et activation)', () => {
    renderForm()
    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(2)
  })

  it('le slider Valence a une valeur initiale de 50', () => {
    renderForm()
    const sliders = screen.getAllByRole('slider')
    const valenceSlider = sliders.find(s => s.getAttribute('aria-label') === 'Valence')
    expect(valenceSlider).toHaveAttribute('aria-valuenow', '50')
  })

  it('le slider Activation a une valeur initiale de 50', () => {
    renderForm()
    const sliders = screen.getAllByRole('slider')
    const arousalSlider = sliders.find(s => s.getAttribute('aria-label') === 'Activation')
    expect(arousalSlider).toHaveAttribute('aria-valuenow', '50')
  })

  it('affiche le label "Comment vous sentez-vous"', () => {
    renderForm()
    expect(screen.getByText(/comment vous sentez-vous/i)).toBeInTheDocument()
  })

  it('affiche le label "niveau d\'énergie"', () => {
    renderForm()
    expect(screen.getByText(/niveau d'énergie/i)).toBeInTheDocument()
  })

  it('affiche "Désagréable" et "Agréable" comme bornes du slider valence', () => {
    renderForm()
    expect(screen.getByText('Désagréable')).toBeInTheDocument()
    expect(screen.getByText('Agréable')).toBeInTheDocument()
  })

  it('affiche "Épuisé" et "Survolté" comme bornes du slider activation', () => {
    renderForm()
    expect(screen.getByText('Épuisé')).toBeInTheDocument()
    expect(screen.getByText('Survolté')).toBeInTheDocument()
  })

  it('met à jour l\'indicateur de valence quand le slider change', () => {
    renderForm()
    const sliders = screen.getAllByRole('slider')
    const valenceSlider = sliders.find(s => s.getAttribute('aria-label') === 'Valence')
    fireEvent.change(valenceSlider, { target: { value: '90' } })
    expect(screen.getByText('Très agréable')).toBeInTheDocument()
  })

  it('met à jour l\'indicateur d\'arousal quand le slider change', () => {
    renderForm()
    const sliders = screen.getAllByRole('slider')
    const arousalSlider = sliders.find(s => s.getAttribute('aria-label') === 'Activation')
    fireEvent.change(arousalSlider, { target: { value: '85' } })
    // "Survolté" apparaît 2× : borne droite du slider + indicateur dynamique
    expect(screen.getAllByText('Survolté')).toHaveLength(2)
  })
})

// ── Tests : Tags de contexte ──────────────────────────────────────

describe('MoodForm — Tags de contexte professionnel', () => {
  afterEach(() => vi.clearAllMocks())

  it('affiche tous les tags de contexte disponibles', () => {
    renderForm()
    CONTEXT_TAGS.forEach(tag => {
      expect(screen.getByText(tag.label)).toBeInTheDocument()
    })
  })

  it('sélectionne un tag au clic', () => {
    renderForm()
    fireEvent.click(screen.getByText('Réunion'))
    expect(screen.getByText(/1 contexte sélectionné/i)).toBeInTheDocument()
  })

  it('désélectionne un tag au second clic', () => {
    renderForm()
    fireEvent.click(screen.getByText('Réunion'))
    fireEvent.click(screen.getByText('Réunion'))
    expect(screen.queryByText(/sélectionné/i)).not.toBeInTheDocument()
  })

  it('permet de sélectionner plusieurs tags', () => {
    renderForm()
    fireEvent.click(screen.getByText('Réunion'))
    fireEvent.click(screen.getByText('Management'))
    expect(screen.getByText(/2 contextes sélectionnés/i)).toBeInTheDocument()
  })
})

// ── Tests : Soumission ────────────────────────────────────────────

describe('MoodForm — Soumission', () => {
  afterEach(() => vi.clearAllMocks())

  it('soumet le formulaire avec valence et arousal par défaut (50)', async () => {
    api.post.mockResolvedValue({ data: { message: 'Mood saved successfully.' } })

    renderForm()
    fireEvent.click(screen.getByText(/enregistrer/i))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/moods', expect.objectContaining({
        valence:      50,
        arousal:      50,
        context_tags: [],
      }))
    })
  })

  it('traduit les IDs de tags en libellés dans la requête', async () => {
    api.post.mockResolvedValue({ data: { message: 'OK' } })

    renderForm()
    fireEvent.click(screen.getByText('Management'))
    fireEvent.click(screen.getByText(/enregistrer/i))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/moods', expect.objectContaining({
        context_tags: ['Management'],
      }))
    })
  })

  it('appelle onSuccess après une soumission réussie', async () => {
    const onSuccess = vi.fn()
    api.post.mockResolvedValue({ data: { message: 'OK' } })

    render(<MoodForm onSuccess={onSuccess} />)
    fireEvent.click(screen.getByText(/enregistrer/i))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce()
    })
  })

  it('affiche un message d\'erreur si l\'API échoue', async () => {
    api.post.mockRejectedValue({
      response: { status: 500, data: { message: 'Erreur serveur.' } }
    })

    renderForm()
    fireEvent.click(screen.getByText(/enregistrer/i))

    await waitFor(() => {
      expect(screen.getByText('Erreur serveur.')).toBeInTheDocument()
    })
  })

  it('appelle onSuccess en cas d\'erreur 409 (déjà soumis)', async () => {
    const onSuccess = vi.fn()
    api.post.mockRejectedValue({
      response: { status: 409, data: { message: 'Already submitted.' } }
    })

    render(<MoodForm onSuccess={onSuccess} />)
    fireEvent.click(screen.getByText(/enregistrer/i))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce()
    })
  })

  it('soumet avec les valeurs correctes après modification des sliders', async () => {
    api.post.mockResolvedValue({ data: { message: 'OK' } })

    renderForm()
    const sliders = screen.getAllByRole('slider')
    const valenceSlider = sliders.find(s => s.getAttribute('aria-label') === 'Valence')
    const arousalSlider = sliders.find(s => s.getAttribute('aria-label') === 'Activation')

    fireEvent.change(valenceSlider, { target: { value: '72' } })
    fireEvent.change(arousalSlider, { target: { value: '43' } })
    fireEvent.click(screen.getByText(/enregistrer/i))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/moods', expect.objectContaining({
        valence: 72,
        arousal: 43,
      }))
    })
  })
})
