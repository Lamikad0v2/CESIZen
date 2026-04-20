import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { CheckCircle2, BarChart2, CalendarDays } from 'lucide-react'
import api from '../api/axios'
import MoodForm, { getValenceMeta, getArousalMeta } from '../components/MoodForm'

// ----------------------------------------------------------------
// Vue dédiée à la saisie quotidienne de l'humeur
// Route : /track
// ----------------------------------------------------------------
export default function MoodEntry() {
  const navigate = useNavigate()

  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cesizen_user') ?? 'null') }
    catch { return null }
  })

  const [submitted,   setSubmitted]   = useState(false)
  const [todayEntry,  setTodayEntry]  = useState(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  const fetchToday = useCallback(() => {
    if (!user) return
    setLoading(true)
    api.get('/api/moods/history')
      .then(({ data }) => {
        const entries = data.data ?? []
        const today   = new Date().toISOString().split('T')[0]
        const entry   = entries.find(e => e.date === today)
        if (entry?.valence != null) {
          setSubmitted(true)
          setTodayEntry(entry)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => { fetchToday() }, [fetchToday])

  if (!user) return null

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="max-w-xl mx-auto space-y-5">

      {/* En-tête */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Comment allez-vous ?
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
          <CalendarDays size={13} />
          {todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
        </p>
      </div>

      {/* Carte principale */}
      <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-sm p-7">
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-cesizen-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : submitted ? (
          <SuccessState entry={todayEntry} />
        ) : (
          <MoodForm onSuccess={() => { setSubmitted(true); fetchToday() }} />
        )}
      </div>

      {/* Lien vers les statistiques */}
      <div className="text-center">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-cesizen-600 dark:text-cesizen-400
                     hover:text-cesizen-700 dark:hover:text-cesizen-300 font-medium transition"
        >
          <BarChart2 size={15} />
          Voir mes statistiques
        </Link>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// État de confirmation post-soumission
// ----------------------------------------------------------------
function SuccessState({ entry }) {
  const valenceMeta = entry?.valence != null ? getValenceMeta(entry.valence) : null
  const arousalMeta = entry?.arousal != null ? getArousalMeta(entry.arousal) : null

  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="w-16 h-16 rounded-full bg-cesizen-50 dark:bg-cesizen-950/50 flex items-center justify-center">
        <CheckCircle2 className="text-cesizen-500" size={32} />
      </div>
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
          C&apos;est noté !
        </h2>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Humeur enregistrée pour aujourd&apos;hui.<br />Revenez demain.
        </p>
      </div>
      {valenceMeta && arousalMeta && entry && (
        <div className="flex gap-3">
          <div className={`px-4 py-2.5 rounded-2xl ${valenceMeta.bgClass}`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Ressenti</p>
            <p className={`text-sm font-bold ${valenceMeta.textClass}`}>
              {valenceMeta.label} — {entry.valence}/100
            </p>
          </div>
          <div className={`px-4 py-2.5 rounded-2xl ${arousalMeta.bgClass}`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Activation</p>
            <p className={`text-sm font-bold ${arousalMeta.textClass}`}>
              {arousalMeta.label} — {entry.arousal}/100
            </p>
          </div>
        </div>
      )}
      {entry?.context_tags?.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {entry.context_tags.map(tag => (
            <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-gray-400">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
