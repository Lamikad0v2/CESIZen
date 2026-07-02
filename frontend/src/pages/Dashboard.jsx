import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  CheckCircle2, CalendarDays,
  TrendingUp, Inbox, Flame, Zap,
} from 'lucide-react'
import api from '../api/axios'
import MoodForm, { getEnergyMeta } from '../components/MoodForm'
import PropTypes from 'prop-types'

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function formatDayLabel(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
}

/** Calcule la série de jours consécutifs saisis (à partir d'aujourd'hui vers le passé). */
function computeStreak(history) {
  let streak = 0
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date))
  const today = new Date().toISOString().split('T')[0]
  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(today)
    expected.setDate(expected.getDate() - i)
    const expectedStr = expected.toISOString().split('T')[0]
    if (sorted[i]?.date === expectedStr && sorted[i]?.energy_level !== null) streak++
    else break
  }
  return streak
}

// ----------------------------------------------------------------
// Tooltip personnalisé
// ----------------------------------------------------------------
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length || payload[0].value == null) return null
  const meta = getEnergyMeta(payload[0].value)
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/10 rounded-2xl shadow-xl px-4 py-3 text-sm">
      <p className="text-gray-400 dark:text-gray-500 text-xs mb-1">{label}</p>
      <p className={`font-semibold ${meta.text}`}>{meta.emoji} {meta.label}</p>
      <p className="text-gray-400 text-xs">{payload[0].value}/100</p>
    </div>
  )
}
ChartTooltip.propTypes = {
  active:  PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.number })),
  label:   PropTypes.string,
}

// ----------------------------------------------------------------
// Carte statistique réutilisable
// ----------------------------------------------------------------
function StatCard({ icon, label, value, sub, accent = 'indigo' }) {
  const accents = {
    indigo: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400',
    orange: 'bg-orange-50 dark:bg-orange-950/50 text-orange-500 dark:text-orange-400',
    green:  'bg-green-50  dark:bg-green-950/50  text-green-600  dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
  }
  return (
    <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8
                    shadow-sm p-5 flex flex-col gap-3">
      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${accents[accent]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
StatCard.propTypes = {
  icon:   PropTypes.node,
  label:  PropTypes.string,
  value:  PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  sub:    PropTypes.string,
  accent: PropTypes.string,
}

// ----------------------------------------------------------------
// Custom dot pour l'AreaChart (S6478 — défini au niveau module)
// ----------------------------------------------------------------
function CustomDot({ cx, cy, payload }) {
  if (payload.energy_level == null || cx == null || cy == null)
    return <g key={`empty-${payload.date}`} />
  const meta = getEnergyMeta(payload.energy_level)
  return (
    <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={4.5}
      fill={meta?.hex ?? '#6366f1'} stroke="white" strokeWidth={2} />
  )
}
CustomDot.propTypes = {
  cx:      PropTypes.number,
  cy:      PropTypes.number,
  payload: PropTypes.shape({
    energy_level: PropTypes.number,
    date:         PropTypes.string,
  }),
}

// ----------------------------------------------------------------
// Composant principal
// ----------------------------------------------------------------
export default function Dashboard() { // NOSONAR
  const navigate = useNavigate()

  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cesizen_user') ?? 'null') }
    catch { return null }
  })

  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [history,          setHistory]          = useState([])
  const [historyLoading,   setHistoryLoading]   = useState(true)

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
        setAlreadySubmitted(entries.some((e) => e.date === today && e.energy_level !== null))
      })
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [user])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchHistory() }, [fetchHistory])

  if (!user) return null

  // ----------------------------------------------------------------
  // Calculs
  // ----------------------------------------------------------------
  const chartData = history.map((entry) => ({
    date:         formatDayLabel(entry.date),
    energy_level: entry.energy_level,
  }))

  const hasAnyData  = history.some((e) => e.energy_level !== null)
  const filledDays  = history.filter((e) => e.energy_level !== null)
  const avgEnergy   = filledDays.length > 0
    ? Math.round(filledDays.reduce((s, e) => s + e.energy_level, 0) / filledDays.length)
    : null
  const avgMeta     = avgEnergy ? getEnergyMeta(avgEnergy) : null
  const streak      = computeStreak(history)

  const todayEntry  = history.find(e => e.date === new Date().toISOString().split('T')[0])
  const todayMeta   = todayEntry?.energy_level ? getEnergyMeta(todayEntry.energy_level) : null

  const todayLabel  = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  let streakSub
  if (streak > 1) streakSub = 'jours consécutifs'
  else if (streak === 1) streakSub = 'Continuez !'
  else streakSub = 'Commencez !'

  const chartContent = hasAnyData ? (
    <ResponsiveContainer width="100%" height={200} data-testid="chart">
      <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          axisLine={false} tickLine={false} width={28}
        />
        <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} />
        <ReferenceLine y={60} stroke="#e5e7eb" strokeDasharray="4 4" />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="energy_level"
          stroke="#6366f1"
          strokeWidth={2.5}
          fill="url(#energyGrad)"
          dot={<CustomDot />}
          activeDot={{ r: 6, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }}
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  ) : (
    <div className="h-48 flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center">
        <Inbox size={20} className="text-gray-300 dark:text-gray-600" />
      </div>
      <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">Aucune donnée.</p>
    </div>
  )

  const recapContent = hasAnyData ? (
    <div className="divide-y divide-gray-50 dark:divide-white/5">
      {[...history].reverse().map((entry) => {
        const meta = entry.energy_level ? getEnergyMeta(entry.energy_level) : null
        const [y, mo, d] = entry.date.split('-').map(Number)
        const dateLabel  = new Date(y, mo - 1, d).toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long',
        })
        return (
          <div key={entry.date} className="flex items-center justify-between px-6 py-3.5 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${meta ? meta.bg : 'bg-gray-50 dark:bg-white/5'}`}>
                {meta ? meta.emoji : '—'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 capitalize">{dateLabel}</p>
                {entry.emotion_tags?.length > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-600 truncate">
                    {entry.emotion_tags.join(' · ')}
                  </p>
                )}
              </div>
            </div>
            <div className="shrink-0">
              {meta
                ? <span className={`text-sm font-bold ${meta.text}`}>{entry.energy_level}/100</span>
                : <span className="text-xs text-gray-300 dark:text-gray-700 italic">—</span>
              }
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

  // ----------------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------------
  return (
    <div className="space-y-5">

      {/* Salutation */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Bonjour, {user.prenom} 👋
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
          <CalendarDays size={13} />
          {todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
        </p>
      </div>

      {/* ── Stat Cards (Bento Row 1) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Flame size={16} />}
          label="Série active"
          value={`${streak}j`}
          sub={streakSub}
          accent="orange"
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Énergie moy. 7j"
          value={avgEnergy ? `${avgMeta?.emoji ?? ''} ${avgEnergy}` : '—'}
          sub={avgEnergy ? `sur 100 (${filledDays.length} jours)` : 'Aucune donnée'}
          accent="indigo"
        />
        <StatCard
          icon={<Zap size={16} />}
          label="Aujourd'hui"
          value={todayMeta ? `${todayMeta.emoji} ${todayEntry.energy_level}` : '—'}
          sub={todayMeta ? `${todayMeta.label} / 100` : 'Non saisi'}
          accent="green"
        />
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label="Saisies / 7j"
          value={`${filledDays.length}/7`}
          sub={filledDays.length === 7 ? 'Semaine complète 🎉' : `${7 - filledDays.length} jour(s) manquant`}
          accent="purple"
        />
      </div>

      {/* ── Bento Row 2 : Formulaire + Graphique ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Formulaire humeur */}
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8
                        shadow-sm p-6 lg:col-span-1 flex flex-col">

          {alreadySubmitted ? (
            <div className="flex flex-col items-center justify-center text-center flex-1 gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-950/50 flex items-center justify-center">
                <CheckCircle2 className="text-green-500" size={28} />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">C&apos;est noté !</h2>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Humeur enregistrée.<br />Revenez demain.
              </p>
              {todayMeta && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-3xl ${todayMeta.bg}`}>
                  <span className="text-xl">{todayMeta.emoji}</span>
                  <span className={`text-sm font-semibold ${todayMeta.text}`}>
                    {todayEntry.energy_level}/100 — {todayMeta.label}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <MoodForm onSuccess={() => { setAlreadySubmitted(true); fetchHistory() }} />
          )}
        </div>

        {/* AreaChart */}
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8
                        shadow-sm p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-500" />
              <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-white">
                Évolution — 7 jours
              </h2>
            </div>
            {avgEnergy != null && avgMeta && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-xl ${avgMeta.bg} ${avgMeta.text}`}>
                Moy. {avgMeta.emoji} {avgEnergy}/100
              </span>
            )}
          </div>

          {historyLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : chartContent}
        </div>
      </div>

      {/* ── Récapitulatif semaine ── */}
      <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-sm overflow-hidden">
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
      </div>

    </div>
  )
}
