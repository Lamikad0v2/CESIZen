/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import PropTypes from 'prop-types'
import { CheckCircle2, AlertCircle, Send } from 'lucide-react'
import api from '../api/axios'

// ----------------------------------------------------------------
// Constantes — Tags de contexte professionnels (aucun emoji)
// ----------------------------------------------------------------
export const CONTEXT_TAGS = [
  { id: 'charge',       label: 'Charge de travail' },
  { id: 'reunion',      label: 'Réunion' },
  { id: 'isolement',    label: 'Isolement' },
  { id: 'management',   label: 'Management' },
  { id: 'equilibre',    label: 'Équilibre pro/perso' },
  { id: 'equipe',       label: "Relations d'équipe" },
  { id: 'objectifs',    label: 'Objectifs' },
  { id: 'formation',    label: 'Formation' },
  { id: 'teletravail',  label: 'Télétravail' },
  { id: 'presentation', label: 'Présentation' },
]

// ----------------------------------------------------------------
// Helpers — Métadonnées de valence et d'arousal (aucun emoji)
// ----------------------------------------------------------------

/**
 * Valence : dimension hédonique (désagréable → agréable).
 */
export function getValenceMeta(v) {
  if (v >= 75) return { label: 'Très agréable',    color: '#1b7a8a', textClass: 'text-cesizen-600 dark:text-cesizen-400', bgClass: 'bg-cesizen-50 dark:bg-cesizen-950/40' }
  if (v >= 55) return { label: 'Agréable',          color: '#2da6b5', textClass: 'text-sky-600    dark:text-sky-400',      bgClass: 'bg-sky-50    dark:bg-sky-950/40' }
  if (v >= 45) return { label: 'Neutre',             color: '#6b7280', textClass: 'text-gray-500   dark:text-gray-400',     bgClass: 'bg-gray-50   dark:bg-gray-900/40' }
  if (v >= 25) return { label: 'Désagréable',        color: '#f97316', textClass: 'text-orange-500 dark:text-orange-400',   bgClass: 'bg-orange-50 dark:bg-orange-950/40' }
  return              { label: 'Très désagréable',   color: '#ef4444', textClass: 'text-red-500    dark:text-red-400',      bgClass: 'bg-red-50    dark:bg-red-950/40' }
}

/**
 * Arousal : dimension d'activation (épuisé → survolté).
 */
export function getArousalMeta(a) {
  if (a >= 75) return { label: 'Survolté',   color: '#f59e0b', textClass: 'text-amber-500   dark:text-amber-400',   bgClass: 'bg-amber-50   dark:bg-amber-950/40' }
  if (a >= 55) return { label: 'Actif',      color: '#10b981', textClass: 'text-emerald-600 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-950/40' }
  if (a >= 45) return { label: 'Modéré',    color: '#6b7280', textClass: 'text-gray-500    dark:text-gray-400',    bgClass: 'bg-gray-50    dark:bg-gray-900/40' }
  if (a >= 25) return { label: 'Fatigué',   color: '#818cf8', textClass: 'text-indigo-400  dark:text-indigo-400',  bgClass: 'bg-indigo-50  dark:bg-indigo-950/40' }
  return              { label: 'Épuisé',    color: '#64748b', textClass: 'text-slate-500   dark:text-slate-400',   bgClass: 'bg-slate-50   dark:bg-slate-900/40' }
}

// ----------------------------------------------------------------
// Composant Slider réutilisable
// ----------------------------------------------------------------
function CircumplexSlider({ label, value, onChange, leftLabel, rightLabel, gradient, ariaLabel }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {label}
        </label>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 tabular-nums">
          {value} / 100
        </span>
      </div>
      <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 -mb-1">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <input
        type="range"
        min={1}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        aria-valuemin={1}
        aria-valuemax={100}
        aria-valuenow={value}
        style={{ background: gradient }}
        className="w-full h-2 rounded-full appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:w-5
                   [&::-webkit-slider-thumb]:h-5
                   [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-white
                   [&::-webkit-slider-thumb]:shadow-md
                   [&::-webkit-slider-thumb]:border-2
                   [&::-webkit-slider-thumb]:border-gray-200
                   [&::-webkit-slider-thumb]:transition-transform
                   [&::-webkit-slider-thumb]:hover:scale-110
                   [&::-moz-range-thumb]:w-5
                   [&::-moz-range-thumb]:h-5
                   [&::-moz-range-thumb]:rounded-full
                   [&::-moz-range-thumb]:bg-white
                   [&::-moz-range-thumb]:border-2
                   [&::-moz-range-thumb]:border-gray-200"
      />
    </div>
  )
}

CircumplexSlider.propTypes = {
  label:      PropTypes.string.isRequired,
  value:      PropTypes.number.isRequired,
  onChange:   PropTypes.func.isRequired,
  leftLabel:  PropTypes.string.isRequired,
  rightLabel: PropTypes.string.isRequired,
  gradient:   PropTypes.string.isRequired,
  ariaLabel:  PropTypes.string.isRequired,
}

// ----------------------------------------------------------------
// Composant principal MoodForm — Modèle Circomplexe de Russell
// ----------------------------------------------------------------
export default function MoodForm({ onSuccess }) {
  const [valence,     setValence]     = useState(50)
  const [arousal,     setArousal]     = useState(50)
  const [contextTags, setContextTags] = useState([])
  const [loading,     setLoading]     = useState(false)
  const [feedback,    setFeedback]    = useState({ type: '', message: '' })

  const valenceMeta = getValenceMeta(valence)
  const arousalMeta = getArousalMeta(arousal)

  // Gradient valence : rouge (mauvais) → teal CESIZen (bon)
  const valenceGradient =
    `linear-gradient(to right, #ef4444 0%, ${valenceMeta.color} ${valence}%, #e5e7eb ${valence}%, #e5e7eb 100%)`

  // Gradient arousal : slate (épuisé) → amber (survolté)
  const arousalGradient =
    `linear-gradient(to right, #94a3b8 0%, ${arousalMeta.color} ${arousal}%, #e5e7eb ${arousal}%, #e5e7eb 100%)`

  function toggleTag(tagId) {
    setContextTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    )
  }

  async function handleSubmit() {
    setFeedback({ type: '', message: '' })
    setLoading(true)
    try {
      const { data } = await api.post('/api/moods', {
        valence,
        arousal,
        context_tags: contextTags.map(id => CONTEXT_TAGS.find(t => t.id === id)?.label).filter(Boolean),
      })
      setFeedback({ type: 'success', message: data.message })
      if (onSuccess) onSuccess()
    } catch (err) {
      const message = err.response?.data?.message ?? 'Une erreur est survenue.'
      setFeedback({ type: 'error', message })
      if (err.response?.status === 409 && onSuccess) onSuccess()
    } finally {
      setLoading(false)
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* ── Indicateur circomplexe (quadrant actuel) ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-2xl px-4 py-3 ${valenceMeta.bgClass}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Ressenti</p>
          <p className={`text-sm font-bold ${valenceMeta.textClass}`}>{valenceMeta.label}</p>
        </div>
        <div className={`rounded-2xl px-4 py-3 ${arousalMeta.bgClass}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Activation</p>
          <p className={`text-sm font-bold ${arousalMeta.textClass}`}>{arousalMeta.label}</p>
        </div>
      </div>

      {/* ── Slider Valence ── */}
      <CircumplexSlider
        label="Comment vous sentez-vous ?"
        value={valence}
        onChange={setValence}
        leftLabel="Désagréable"
        rightLabel="Agréable"
        gradient={valenceGradient}
        ariaLabel="Valence"
      />

      {/* ── Slider Arousal ── */}
      <CircumplexSlider
        label="Quel est votre niveau d'énergie ?"
        value={arousal}
        onChange={setArousal}
        leftLabel="Épuisé"
        rightLabel="Survolté"
        gradient={arousalGradient}
        ariaLabel="Activation"
      />

      {/* ── Tags de contexte ── */}
      <div className="flex flex-col gap-2.5">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Contexte de la journée{' '}
          <span className="text-gray-400 dark:text-gray-500 font-normal text-xs">(facultatif)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {CONTEXT_TAGS.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className={`
                px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150
                border cursor-pointer select-none
                ${contextTags.includes(tag.id)
                  ? 'bg-cesizen-500 dark:bg-cesizen-600 text-white border-cesizen-500 dark:border-cesizen-600 shadow-sm'
                  : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-cesizen-300 dark:hover:border-cesizen-700 hover:text-cesizen-600 dark:hover:text-cesizen-400'
                }
              `}
            >
              {tag.label}
            </button>
          ))}
        </div>
        {contextTags.length > 0 && (
          <p className="text-xs text-cesizen-500 dark:text-cesizen-400 font-medium">
            {contextTags.length} contexte{contextTags.length > 1 ? 's' : ''} sélectionné{contextTags.length > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Feedback ── */}
      {feedback.message && (
        <div className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-xs font-medium ${
          feedback.type === 'success'
            ? 'bg-cesizen-50 dark:bg-cesizen-950/50 text-cesizen-700 dark:text-cesizen-400'
            : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
        }`}>
          {feedback.type === 'success'
            ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
            : <AlertCircle  size={13} className="shrink-0 mt-0.5" />
          }
          {feedback.message}
        </div>
      )}

      {/* ── Soumettre ── */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full
                   bg-cesizen-500 hover:bg-cesizen-600 disabled:opacity-50
                   text-white font-semibold py-3 rounded-2xl text-sm
                   transition-all duration-200 cursor-pointer disabled:cursor-not-allowed
                   shadow-sm"
      >
        <Send size={15} />
        {loading ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  )
}
MoodForm.propTypes = {
  onSuccess: PropTypes.func,
}
