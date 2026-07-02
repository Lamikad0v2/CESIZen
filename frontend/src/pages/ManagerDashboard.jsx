import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, Users, Inbox, AlertCircle } from 'lucide-react'
import api from '../api/axios'
import PropTypes from 'prop-types'

function formatDayLabel(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/10 rounded-2xl shadow-xl px-4 py-3 text-sm">
      <p className="text-gray-400 text-xs mb-2 font-medium">{label}</p>
      {payload.map(p =>
        p.value == null ? null : (
          <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              {p.dataKey === 'avg_valence' ? 'Valence moy.' : 'Activation moy.'} :
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">{p.value}/100</span>
          </div>
        )
      )}
      {payload[0]?.payload?.nb_saisies != null && (
        <p className="text-gray-400 text-xs mt-1">
          {payload[0].payload.nb_saisies} saisie{payload[0].payload.nb_saisies === 1 ? '' : 's'}
        </p>
      )}
    </div>
  )
}
ChartTooltip.propTypes = {
  active:  PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.shape({
    dataKey: PropTypes.string,
    value:   PropTypes.number,
    color:   PropTypes.string,
    payload: PropTypes.shape({
      nb_saisies: PropTypes.number,
    }),
  })),
  label:   PropTypes.string,
}

export default function ManagerDashboard() {
  const navigate = useNavigate()

  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cesizen_user') ?? 'null') }
    catch { return null }
  })

  const [teamData, setTeamData] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (!user)                    { navigate('/login',     { replace: true }); return }
    if (user.role !== 'manager')  { navigate('/dashboard', { replace: true }) }
  }, [user, navigate])

  const fetchTeamMood = useCallback(() => {
    if (!user || user?.role !== 'manager') return
    setLoading(true); setError(null)
    api.get('/api/manager/team-mood')
      .then(({ data }) => setTeamData(data.data ?? []))
      .catch((err) => setError(err.response?.data?.message ?? 'Erreur lors du chargement.'))
      .finally(() => setLoading(false))
  }, [user])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchTeamMood() }, [fetchTeamMood])

  if (!user || user?.role !== 'manager') return null

  const chartData  = teamData.map(e => ({
    date:        formatDayLabel(e.date),
    avg_valence: e.avg_valence,
    avg_arousal: e.avg_arousal,
    nb_saisies:  e.nb_saisies,
  }))
  const today      = teamData[teamData.length - 1]
  const filledDays = teamData.filter(e => e.avg_valence != null)
  const weekAvgV   = filledDays.length > 0
    ? (filledDays.reduce((s, e) => s + e.avg_valence, 0) / filledDays.length).toFixed(1)
    : null
  const hasData    = filledDays.length > 0

  const chartContent = hasData ? (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="teamValenceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#1b7a8a" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#1b7a8a" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="teamArousalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
          tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
        <ReferenceLine y={30} stroke="#fca5a5" strokeDasharray="3 3" strokeOpacity={0.6} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="avg_valence" stroke="#1b7a8a" strokeWidth={2.5}
          fill="url(#teamValenceGrad)"
          dot={{ r: 4, fill: '#1b7a8a', stroke: 'white', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: '#1b7a8a', stroke: 'white', strokeWidth: 2 }}
          connectNulls={false} />
        <Area type="monotone" dataKey="avg_arousal" stroke="#f59e0b" strokeWidth={2.5}
          fill="url(#teamArousalGrad)"
          dot={{ r: 4, fill: '#f59e0b', stroke: 'white', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: '#f59e0b', stroke: 'white', strokeWidth: 2 }}
          connectNulls={false} />
      </AreaChart>
    </ResponsiveContainer>
  ) : (
    <div className="h-52 flex flex-col items-center justify-center gap-3">
      <Inbox size={28} className="text-gray-300 dark:text-gray-700" />
      <p className="text-gray-400 dark:text-gray-600 text-sm font-medium">Aucune donnée.</p>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Titre */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <Users size={24} className="text-cesizen-500" />
          Tendance de l&apos;équipe
        </h1>
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
          Données anonymisées — moyennes quotidiennes sur 7 jours.
        </p>
      </div>

      {/* Erreur sans équipe */}
      {error && (
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-amber-100 dark:border-amber-900/50 p-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
            <AlertCircle size={17} className="text-amber-500" />
          </div>
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">{error}</p>
            <p className="text-amber-500 dark:text-amber-600 text-xs mt-1">Demandez à un administrateur de vous affecter à une équipe.</p>
          </div>
        </div>
      )}

      {/* Stats Bento */}
      {!error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Valence moy.',  value: today?.avg_valence == null ? '—' : `${today.avg_valence}/100` },
            { label: 'Activation moy.', value: today?.avg_arousal == null ? '—' : `${today.avg_arousal}/100` },
            { label: 'Saisies auj.',  value: today?.nb_saisies ?? 0 },
            { label: 'Valence 7j',    value: weekAvgV ? `${weekAvgV}/100` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-sm p-5">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 font-medium">{label}</p>
              {loading ? (
                <div className="h-8 bg-gray-50 dark:bg-white/5 rounded-xl animate-pulse w-16" />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{value}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* AreaChart — double série valence + arousal */}
      {!error && (
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-sm p-7">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-cesizen-500" />
            <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-white">Évolution — 7 jours</h2>
            <div className="ml-auto flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-3 h-0.5 rounded inline-block bg-[#1b7a8a]" />Valence
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-3 h-0.5 rounded inline-block bg-[#f59e0b]" />Activation
              </span>
            </div>
          </div>
          {loading ? (
            <div className="h-52 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-cesizen-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : chartContent}
        </div>
      )}

      {/* Liste semaine */}
      {!error && hasData && !loading && (
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-sm overflow-hidden">
          <div className="px-7 pt-5 pb-4">
            <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-white">Détail de la semaine</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {[...teamData].reverse().map(entry => {
              const [y, mo, d] = entry.date.split('-').map(Number)
              const label      = new Date(y, mo - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
              return (
                <div key={entry.date} className="flex items-center justify-between px-7 py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 capitalize">{label}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-600">
                      {entry.nb_saisies} saisie{entry.nb_saisies === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {entry.avg_valence == null ? (
                      <span className="text-xs text-gray-300 dark:text-gray-700 italic">—</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-cesizen-50 dark:bg-cesizen-950/40 text-cesizen-600 dark:text-cesizen-400">
                        V {entry.avg_valence}
                      </span>
                    )}
                    {entry.avg_arousal != null && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                        A {entry.avg_arousal}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
