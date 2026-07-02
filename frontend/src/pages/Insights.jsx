/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  ScatterChart, Scatter, ReferenceArea,
} from 'recharts'
import {
  Flame, TrendingUp, Zap, CheckCircle2, Inbox,
  PenLine, CloudSun, BarChart2, Target,
} from 'lucide-react'
import api from '../api/axios'
import { getValenceMeta, getArousalMeta } from '../components/MoodForm'
import PropTypes from 'prop-types'

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function formatDayLabel(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
}

export function computeStreak(history) {
  let streak = 0
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date))
  const today  = new Date().toISOString().split('T')[0]
  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(today)
    expected.setDate(expected.getDate() - i)
    const expectedStr = expected.toISOString().split('T')[0]
    if (sorted[i]?.date === expectedStr && sorted[i]?.valence != null) streak++
    else break
  }
  return streak
}

export function computeTagFrequency(history) {
  const freq = {}
  history.forEach(e => {
    if (Array.isArray(e.context_tags)) {
      e.context_tags.forEach(tag => { freq[tag] = (freq[tag] ?? 0) + 1 })
    }
  })
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }))
}

export function getWeatherText(avgValence, avgArousal, topTag) {
  if (avgValence == null) return 'Commencez à saisir vos humeurs pour voir votre météo intérieure.'
  const highV = avgValence >= 60
  const lowV  = avgValence < 40
  const highA = avgArousal >= 60
  const lowA  = avgArousal < 40
  let text = ''
  if (highV && highA)  text = 'Semaine dynamique et positive. Votre énergie est au rendez-vous.'
  else if (highV && lowA)  text = 'Semaine sereine et apaisée. Vous êtes dans un état de calme bienveillant.'
  else if (lowV && highA)  text = 'Semaine sous tension. L\'agitation domine malgré un ressenti difficile.'
  else if (lowV && lowA)   text = 'Semaine épuisante. Prenez soin de vous et faites-vous accompagner si besoin.'
  else                     text = 'Semaine équilibrée. Votre état émotionnel reste stable et modéré.'
  if (topTag) text += ` Contexte dominant : ${topTag}.`
  return text
}

// Quadrant Russell pour un point donné
function getQuadrant(v, a) {
  if (v >= 50 && a >= 50) return 'q1' // Actif / Enthousiaste
  if (v <  50 && a >= 50) return 'q2' // Stressé / Anxieux
  if (v >= 50 && a <  50) return 'q3' // Serein / Détendu
  return                        'q4'  // Épuisé / Déprimé
}

const QUADRANT_COLORS = {
  q1: '#1b7a8a', // cesizen - actif
  q2: '#f59e0b', // amber   - stressé
  q3: '#06b6d4', // cyan    - serein
  q4: '#ef4444', // red     - épuisé
}

// ----------------------------------------------------------------
// Tooltip personnalisé (AreaChart)
// ----------------------------------------------------------------
function AreaChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/10 rounded-2xl shadow-xl px-4 py-3 text-sm">
      <p className="text-gray-400 dark:text-gray-500 text-xs mb-2 font-medium">{label}</p>
      {payload.map(p =>
        p.value == null ? null : (
          <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-gray-500 dark:text-gray-400 text-xs capitalize">
              {p.dataKey === 'valence' ? 'Ressenti' : 'Activation'} :
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">{p.value}/100</span>
          </div>
        )
      )}
    </div>
  )
}
AreaChartTooltip.propTypes = {
  active:  PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.shape({
    dataKey: PropTypes.string,
    value:   PropTypes.number,
    color:   PropTypes.string,
  })),
  label:   PropTypes.string,
}

// ----------------------------------------------------------------
// Scatter Tooltip
// ----------------------------------------------------------------
function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { valence, arousal, date } = payload[0]?.payload ?? {}
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/10 rounded-2xl shadow-xl px-3 py-2 text-xs">
      {date && <p className="text-gray-400 mb-1">{formatDayLabel(date)}</p>}
      <div className="flex gap-2">
        <span className="text-gray-500">V <strong className="text-gray-800 dark:text-white">{valence}</strong></span>
        <span className="text-gray-500">A <strong className="text-gray-800 dark:text-white">{arousal}</strong></span>
      </div>
    </div>
  )
}
ScatterTooltip.propTypes = {
  active:  PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.shape({
    payload: PropTypes.shape({
      valence: PropTypes.number,
      arousal: PropTypes.number,
      date:    PropTypes.string,
    }),
  })),
}

// ----------------------------------------------------------------
// Streak Ring SVG
// ----------------------------------------------------------------
function StreakRing({ streak, max = 7 }) {
  const r     = 36
  const circ  = 2 * Math.PI * r
  const ratio = Math.min(streak / max, 1)
  const dash  = circ * ratio
  const gap   = circ - dash

  return (
    <div data-testid="streak-ring" className="relative w-24 h-24 mx-auto">
      <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
        {/* Track */}
        <circle cx="48" cy="48" r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-gray-100 dark:text-white/8"
        />
        {/* Progress */}
        <circle cx="48" cy="48" r={r}
          fill="none"
          stroke="#1b7a8a"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{streak}</span>
        <span className="text-[10px] text-gray-400 font-medium mt-0.5">/ {max}j</span>
      </div>
    </div>
  )
}
StreakRing.propTypes = {
  streak: PropTypes.number.isRequired,
  max:    PropTypes.number,
}

// ----------------------------------------------------------------
// Card shell réutilisable
// ----------------------------------------------------------------
function Card({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-sm ${className}`}>
      {children}
    </div>
  )
}
Card.propTypes = {
  children:  PropTypes.node,
  className: PropTypes.string,
}

function CardHeader({ icon, title, extra }) {
  return (
    <div className="flex items-center gap-2 px-6 pt-5 pb-0">
      {icon}
      <h2 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white flex-1">{title}</h2>
      {extra}
    </div>
  )
}
CardHeader.propTypes = {
  icon:  PropTypes.node,
  title: PropTypes.string,
  extra: PropTypes.node,
}

// ----------------------------------------------------------------
// Composant principal — Vue Insights / Tableau de bord
// Route : /dashboard
// ----------------------------------------------------------------
export default function Insights() { // NOSONAR
  const navigate = useNavigate()

  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cesizen_user') ?? 'null') }
    catch { return null }
  })

  const [history,        setHistory]        = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)

  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  const fetchHistory = useCallback(() => {
    if (!user) return
    setHistoryLoading(true)
    api.get('/api/moods/history')
      .then(({ data }) => {
        const entries = data.data ?? []
        setHistory(entries)
        const today = new Date().toISOString().split('T')[0]
        setAlreadySubmitted(entries.some(e => e.date === today && e.valence != null))
      })
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [user])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchHistory() }, [fetchHistory])

  if (!user) return null

  // ── Calculs ────────────────────────────────────────────────────
  const chartData = history.map(entry => ({
    date:    formatDayLabel(entry.date),
    valence: entry.valence,
    arousal: entry.arousal,
  }))

  const filledDays = history.filter(e => e.valence != null)
  const hasAnyData = filledDays.length > 0

  const avgValence = hasAnyData
    ? Math.round(filledDays.reduce((s, e) => s + e.valence, 0) / filledDays.length)
    : null
  const avgArousal = hasAnyData
    ? Math.round(filledDays.reduce((s, e) => s + e.arousal, 0) / filledDays.length)
    : null

  const streak = computeStreak(history)

  const tagFreq  = computeTagFrequency(history)
  const topTag   = tagFreq[0]?.tag ?? null
  const maxCount = tagFreq[0]?.count ?? 1

  const weatherText = getWeatherText(avgValence, avgArousal, topTag)

  // ScatterChart data split by quadrant
  const scatterData = filledDays.map(e => ({
    valence: e.valence, arousal: e.arousal, date: e.date,
    quadrant: getQuadrant(e.valence, e.arousal),
  }))
  const q1 = scatterData.filter(p => p.quadrant === 'q1')
  const q2 = scatterData.filter(p => p.quadrant === 'q2')
  const q3 = scatterData.filter(p => p.quadrant === 'q3')
  const q4 = scatterData.filter(p => p.quadrant === 'q4')

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  let streakSub
  if (streak > 1) streakSub = `${streak} jours consécutifs`
  else if (streak === 1) streakSub = 'Continue !'
  else streakSub = 'Commence !'

  const emptyDataBlock = (height = 'h-52') => (
    <div className={`${height} flex flex-col items-center justify-center gap-3`}>
      <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center">
        <Inbox size={20} className="text-gray-300 dark:text-gray-600" />
      </div>
      <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">Aucune donnée.</p>
    </div>
  )

  const scatterContent = hasAnyData ? (
    <ResponsiveContainer width="100%" height={220} data-testid="scatter-chart">
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <XAxis type="number" dataKey="valence" domain={[0, 100]}
          tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
          label={{ value: 'Valence →', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#9ca3af' }}
        />
        <YAxis type="number" dataKey="arousal" domain={[0, 100]}
          tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28}
          label={{ value: '↑ Activation', angle: -90, position: 'insideLeft', offset: 12, fontSize: 10, fill: '#9ca3af' }}
        />
        <ReferenceArea x1={0}  x2={50} y1={50} y2={100} fill="#f59e0b" fillOpacity={0.05} />
        <ReferenceArea x1={50} x2={100} y1={50} y2={100} fill="#1b7a8a" fillOpacity={0.05} />
        <ReferenceArea x1={0}  x2={50} y1={0}  y2={50}  fill="#ef4444" fillOpacity={0.05} />
        <ReferenceArea x1={50} x2={100} y1={0}  y2={50}  fill="#06b6d4" fillOpacity={0.05} />
        <ReferenceArea x1={0}  x2={30} y1={0}  y2={30}  fill="#ef4444" fillOpacity={0.08} stroke="#ef4444" strokeOpacity={0.2} strokeDasharray="3 3" />
        <Tooltip content={<ScatterTooltip />} />
        <Scatter name="q1" data={q1} fill={QUADRANT_COLORS.q1} r={5} />
        <Scatter name="q2" data={q2} fill={QUADRANT_COLORS.q2} r={5} />
        <Scatter name="q3" data={q3} fill={QUADRANT_COLORS.q3} r={5} />
        <Scatter name="q4" data={q4} fill={QUADRANT_COLORS.q4} r={5} />
      </ScatterChart>
    </ResponsiveContainer>
  ) : emptyDataBlock()

  const areaChartContent = hasAnyData ? (
    <ResponsiveContainer width="100%" height={200} data-testid="chart">
      <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="valenceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#1b7a8a" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#1b7a8a" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="arousalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date"
          tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
        />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
          tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28}
        />
        <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.35} />
        <Tooltip content={<AreaChartTooltip />} />
        <Area type="monotone" dataKey="valence" stroke="#1b7a8a" strokeWidth={2.5}
          fill="url(#valenceGrad)"
          dot={{ r: 4, fill: '#1b7a8a', stroke: 'white', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: '#1b7a8a', stroke: 'white', strokeWidth: 2 }}
          connectNulls={false}
        />
        <Area type="monotone" dataKey="arousal" stroke="#f59e0b" strokeWidth={2.5}
          fill="url(#arousalGrad)"
          dot={{ r: 4, fill: '#f59e0b', stroke: 'white', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: '#f59e0b', stroke: 'white', strokeWidth: 2 }}
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  ) : emptyDataBlock()

  const recapContent = hasAnyData ? (
    <div className="divide-y divide-gray-50 dark:divide-white/5">
      {[...history].reverse().map(entry => {
        const valenceMeta = entry.valence == null ? null : getValenceMeta(entry.valence)
        const arousalMeta = entry.arousal == null ? null : getArousalMeta(entry.arousal)
        const [y, mo, d]  = entry.date.split('-').map(Number)
        const dateLabel   = new Date(y, mo - 1, d).toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long',
        })
        return (
          <div key={entry.date} className="flex items-center justify-between px-6 py-3.5 gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 capitalize">{dateLabel}</p>
              {entry.context_tags?.length > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-600 truncate">
                  {entry.context_tags.join(' · ')}
                </p>
              )}
            </div>
            <div className="shrink-0 flex gap-1.5">
              {valenceMeta ? (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap ${valenceMeta.bgClass} ${valenceMeta.textClass}`}>
                  V {entry.valence}
                </span>
              ) : (
                <span className="text-xs text-gray-300 dark:text-gray-700 italic">—</span>
              )}
              {arousalMeta && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap ${arousalMeta.bgClass} ${arousalMeta.textClass}`}>
                  A {entry.arousal}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  ) : (
    <p className="text-center text-sm text-gray-400 dark:text-gray-600 py-8">
      Aucune entrée pour cette semaine.
    </p>
  )

  // ── Rendu ──────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Tableau de bord
        </h1>
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500 capitalize">{todayLabel}</p>
      </div>

      {/* ── CTA — Saisie manquante ── */}
      {!historyLoading && !alreadySubmitted && (
        <Link
          to="/track"
          className="flex items-center justify-between p-4 rounded-2xl
                     bg-cesizen-50 dark:bg-cesizen-950/40
                     border border-cesizen-200 dark:border-cesizen-800/60
                     hover:bg-cesizen-100 dark:hover:bg-cesizen-950/60 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cesizen-500 flex items-center justify-center shadow-sm">
              <PenLine size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-cesizen-700 dark:text-cesizen-300">
                Saisir mon humeur du jour
              </p>
              <p className="text-xs text-cesizen-500 dark:text-cesizen-500">
                Pas encore enregistré aujourd&apos;hui
              </p>
            </div>
          </div>
          <TrendingUp size={16} className="text-cesizen-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}

      {/* ══════════════════════════════════════════════════════════
          BENTO GRID — 12 colonnes
          ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">

        {/* ── Streak Ring [col-span-3] ── */}
        <Card className="col-span-1 lg:col-span-3 p-5 flex flex-col items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full">
            <Flame size={14} className="text-orange-400" />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Série active</span>
          </div>
          <StreakRing streak={streak} />
          <p className="text-xs text-gray-400 text-center leading-snug">
            {streakSub}
          </p>
        </Card>

        {/* ── Stat Cards [col-span-3 each] ── */}
        <Card className="col-span-1 lg:col-span-3 p-5 flex flex-col gap-3">
          <div className="w-9 h-9 rounded-2xl bg-cesizen-50 dark:bg-cesizen-950/50 flex items-center justify-center">
            <TrendingUp size={16} className="text-cesizen-600 dark:text-cesizen-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-0.5">Valence moy. 7j</p>
            <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {avgValence == null ? '—' : `${avgValence}/100`}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {avgValence == null ? 'Aucune donnée' : getValenceMeta(avgValence).label}
            </p>
          </div>
        </Card>

        <Card className="col-span-1 lg:col-span-3 p-5 flex flex-col gap-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center">
            <Zap size={16} className="text-amber-500 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-0.5">Activation moy. 7j</p>
            <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {avgArousal == null ? '—' : `${avgArousal}/100`}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {avgArousal == null ? 'Aucune donnée' : getArousalMeta(avgArousal).label}
            </p>
          </div>
        </Card>

        <Card className="col-span-1 lg:col-span-3 p-5 flex flex-col gap-3">
          <div className="w-9 h-9 rounded-2xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center">
            <CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-0.5">Saisies / 7j</p>
            <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {filledDays.length}/7
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {filledDays.length === 7 ? 'Semaine complète' : `${7 - filledDays.length} jour(s) manquant`}
            </p>
          </div>
        </Card>

        {/* ── Russell Scatter Plot [col-span-7] ── */}
        <Card className="col-span-1 sm:col-span-2 lg:col-span-7 overflow-hidden">
          <CardHeader
            icon={<Target size={14} className="text-cesizen-500" />}
            title="Carte émotionnelle — Modèle Circomplexe"
          />
          <div className="px-4 pb-2 pt-1 flex flex-wrap gap-x-4 gap-y-1">
            {[
              { color: QUADRANT_COLORS.q1, label: 'Actif / Enthousiaste' },
              { color: QUADRANT_COLORS.q2, label: 'Stressé / Anxieux' },
              { color: QUADRANT_COLORS.q3, label: 'Serein / Détendu' },
              { color: QUADRANT_COLORS.q4, label: 'Épuisé / Déprimé' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
          <div className="px-2 pb-4">
            {historyLoading ? (
              <div className="h-52 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-cesizen-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : scatterContent}
          </div>
        </Card>

        {/* ── Météo Intérieure [col-span-5] ── */}
        <Card className="col-span-1 sm:col-span-2 lg:col-span-5 p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CloudSun size={14} className="text-amber-400" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">Météo Intérieure</span>
          </div>

          {avgValence != null && (
            <div className="flex items-center gap-3">
              {/* Badge valence */}
              <div className={`px-3 py-1.5 rounded-2xl text-sm font-bold ${getValenceMeta(avgValence).bgClass} ${getValenceMeta(avgValence).textClass}`}>
                V {avgValence}
              </div>
              <div className={`px-3 py-1.5 rounded-2xl text-sm font-bold ${getArousalMeta(avgArousal).bgClass} ${getArousalMeta(avgArousal).textClass}`}>
                A {avgArousal}
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed" data-testid="weather-text">
            {weatherText}
          </p>

          {topTag && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="px-2.5 py-1 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/8 font-medium">
                {topTag}
              </span>
              <span>contexte le plus fréquent</span>
            </div>
          )}
        </Card>

        {/* ── Évolution 7 jours [col-span-7] ── */}
        <Card className="col-span-1 sm:col-span-2 lg:col-span-7 overflow-hidden">
          <CardHeader
            icon={<TrendingUp size={14} className="text-cesizen-500" />}
            title="Évolution — 7 jours"
            extra={
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-3 h-0.5 rounded inline-block bg-[#1b7a8a]" />Ressenti
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-3 h-0.5 rounded inline-block bg-[#f59e0b]" />Activation
                </span>
              </div>
            }
          />
          <div className="p-4">
            {historyLoading ? (
              <div className="h-52 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-cesizen-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : areaChartContent}
          </div>
        </Card>

        {/* ── Focus Contextuel [col-span-5] ── */}
        <Card className="col-span-1 sm:col-span-2 lg:col-span-5 p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-cesizen-500" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">Focus Contextuel</span>
          </div>

          {tagFreq.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
                Ajoutez des contextes lors de vos saisies pour voir les tendances.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tagFreq.map(({ tag, count }) => {
                const pct = Math.round((count / maxCount) * 100)
                return (
                  <div key={tag} data-testid={`focus-tag-${tag}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{tag}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{count}×</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-cesizen-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

      </div>

      {/* ── Récapitulatif semaine ── */}
      <Card className="overflow-hidden">
        <div className="px-6 pt-5 pb-4">
          <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-white">
            Récapitulatif de la semaine
          </h2>
        </div>

        {historyLoading ? (
          <div className="px-6 pb-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 dark:bg-white/5 rounded-2xl animate-pulse" /> // NOSONAR
            ))}
          </div>
        ) : recapContent}
      </Card>

    </div>
  )
}
