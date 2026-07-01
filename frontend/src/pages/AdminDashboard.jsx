import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, X, Users, Building2,
  ShieldCheck, AlertTriangle, Bell, CheckCheck, BookOpen,
} from 'lucide-react'
import api from '../api/axios'

// ----------------------------------------------------------------
// Constantes UI
// ----------------------------------------------------------------
const ROLES = ['collaborateur', 'manager', 'rh', 'admin']

const ROLE_STYLE = {
  admin:         'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300',
  rh:            'bg-teal-100   dark:bg-teal-900/60   text-teal-700   dark:text-teal-300',
  manager:       'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300',
  collaborateur: 'bg-gray-100   dark:bg-gray-800       text-gray-500   dark:text-gray-400',
}

const ROLE_ICON_BG = {
  admin:         'bg-indigo-50 dark:bg-indigo-950/50',
  rh:            'bg-teal-50   dark:bg-teal-950/50',
  manager:       'bg-purple-50 dark:bg-purple-950/50',
  collaborateur: 'bg-gray-100  dark:bg-gray-800',
}

// ----------------------------------------------------------------
// Sous-composants réutilisables
// ----------------------------------------------------------------
function RoleBadge({ role }) {
  return (
    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold capitalize ${ROLE_STYLE[role] ?? 'bg-gray-100 text-gray-500'}`}>
      {role}
    </span>
  )
}

function Avatar({ prenom, nom, role }) {
  const initials = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase()
  return (
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${ROLE_ICON_BG[role] ?? 'bg-gray-100'}`}>
      <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{initials}</span>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-7 border border-gray-100 dark:border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20
                       flex items-center justify-center text-gray-500 dark:text-gray-400 transition"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function BtnPrimary({ children, loading, disabled, ...props }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                 text-white font-semibold py-3.5 rounded-2xl text-sm transition
                 cursor-pointer disabled:cursor-not-allowed"
    >
      {loading ? 'En cours…' : children}
    </button>
  )
}

function BtnDanger({ children, loading, ...props }) {
  return (
    <button
      {...props}
      disabled={loading}
      className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50
                 text-white font-semibold py-3.5 rounded-2xl text-sm transition
                 cursor-pointer disabled:cursor-not-allowed"
    >
      {loading ? 'Suppression…' : children}
    </button>
  )
}

// ----------------------------------------------------------------
// Skeleton loader
// ----------------------------------------------------------------
function SkeletonRows({ count = 3 }) {
  return (
    <div className="p-6 space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-16 bg-gray-50 dark:bg-white/5 rounded-2xl animate-pulse" />
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// Composant principal
// ----------------------------------------------------------------
export default function AdminDashboard() {
  const navigate = useNavigate()

  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cesizen_user') ?? 'null') }
    catch { return null }
  })

  const [teams,       setTeams]       = useState([])
  const [users,       setUsers]       = useState([])
  const [alerts,      setAlerts]      = useState([])
  const [articles,    setArticles]    = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [activeTab,   setActiveTab]   = useState('teams')
  const [modal,       setModal]       = useState(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [toast,       setToast]       = useState(null)

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return }
    if (!['admin', 'rh'].includes(user.role)) { navigate('/dashboard', { replace: true }) }
  }, [user, navigate])

  const fetchAll = useCallback(() => {
    if (!user || !['admin', 'rh'].includes(user.role)) return
    setDataLoading(true)
    Promise.all([
      api.get('/api/teams'),
      api.get('/api/admin/users'),
      api.get('/api/admin/alerts'),
      api.get('/api/articles'),
    ])
      .then(([teamsRes, usersRes, alertsRes, articlesRes]) => {
        setTeams(teamsRes.data.data ?? [])
        setUsers(usersRes.data.data ?? [])
        setAlerts(alertsRes.data.data ?? [])
        setArticles(articlesRes.data.data ?? [])
      })
      .catch(() => showToast('error', 'Erreur lors du chargement des données.'))
      .finally(() => setDataLoading(false))
  }, [user])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function showToast(type, message) { setToast({ type, message }) }
  function closeModal()             { setModal(null) }

  // ── Handlers Équipes ──────────────────────────────────────────

  async function handleTeamSubmit(e) {
    e.preventDefault()
    const nomEquipe = e.target.nom_equipe.value.trim()
    if (!nomEquipe) return
    setSubmitting(true)
    try {
      if (modal.data) {
        await api.put(`/api/teams/${modal.data.id}`, { nom_equipe: nomEquipe })
        showToast('success', 'Équipe modifiée.')
      } else {
        await api.post('/api/teams', { nom_equipe: nomEquipe })
        showToast('success', 'Équipe créée.')
      }
      closeModal(); fetchAll()
    } catch (err) {
      showToast('error', err.response?.data?.message ?? 'Une erreur est survenue.')
    } finally { setSubmitting(false) }
  }

  async function handleTeamDelete(team) {
    setSubmitting(true)
    try {
      await api.delete(`/api/teams/${team.id}`)
      showToast('success', `Équipe "${team.nom_equipe}" supprimée.`)
      closeModal(); fetchAll()
    } catch (err) {
      showToast('error', err.response?.data?.message ?? 'Une erreur est survenue.')
    } finally { setSubmitting(false) }
  }

  // ── Handlers Utilisateurs ────────────────────────────────────

  async function handleUserSubmit(e) {
    e.preventDefault()
    const role    = e.target.role.value
    const rawTeam = e.target.team_id.value
    const teamId  = rawTeam === '' ? null : parseInt(rawTeam, 10)
    setSubmitting(true)
    try {
      await api.put(`/api/admin/users/${modal.data.id}`, { role, team_id: teamId })
      showToast('success', 'Utilisateur mis à jour.')
      closeModal(); fetchAll()
    } catch (err) {
      showToast('error', err.response?.data?.message ?? 'Une erreur est survenue.')
    } finally { setSubmitting(false) }
  }

  async function handleUserDelete(targetUser) {
    setSubmitting(true)
    try {
      await api.delete(`/api/admin/users/${targetUser.id}`)
      showToast('success', `"${targetUser.prenom} ${targetUser.nom}" supprimé.`)
      closeModal(); fetchAll()
    } catch (err) {
      showToast('error', err.response?.data?.message ?? 'Une erreur est survenue.')
    } finally { setSubmitting(false) }
  }

  // ── Handlers Alertes ─────────────────────────────────────────

  async function handleMarkAlertRead(alertId) {
    try {
      const safeId = Number.parseInt(alertId, 10)
      await api.put(`/api/admin/alerts/${safeId}/read`)
      fetchAll()
    } catch {
      showToast('error', "Impossible de marquer l'alerte comme lue.")
    }
  }

  // ── Handlers Articles ────────────────────────────────────────

  async function handleArticleSubmit(e) {
    e.preventDefault()
    const title   = e.target.title.value.trim()
    const content = e.target.content.value.trim()
    if (!title || !content) return
    setSubmitting(true)
    try {
      if (modal.data) {
        await api.put(`/api/articles/${modal.data.id}`, { title, content })
        showToast('success', 'Article modifié.')
      } else {
        await api.post('/api/articles', { title, content })
        showToast('success', 'Article publié.')
      }
      closeModal(); fetchAll()
    } catch (err) {
      showToast('error', err.response?.data?.message ?? 'Une erreur est survenue.')
    } finally { setSubmitting(false) }
  }

  async function handleArticleDelete(article) {
    setSubmitting(true)
    try {
      await api.delete(`/api/articles/${article.id}`)
      showToast('success', 'Article supprimé.')
      closeModal(); fetchAll()
    } catch (err) {
      showToast('error', err.response?.data?.message ?? 'Une erreur est survenue.')
    } finally { setSubmitting(false) }
  }

  if (!user || !['admin', 'rh'].includes(user.role)) return null

  const unreadCount = alerts.filter(a => !a.is_read).length

  // ----------------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------------
  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3
                         rounded-2xl shadow-xl text-sm font-medium max-w-xs ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      {/* Titre + stats rapides */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
          Gestion RH
        </h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 flex flex-wrap gap-x-2">
          <span>{users.length} utilisateur{users.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{teams.length} équipe{teams.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{unreadCount} alerte{unreadCount !== 1 ? 's' : ''} non lue{unreadCount !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{articles.length} article{articles.length !== 1 ? 's' : ''}</span>
        </p>
      </div>

      {/* Onglets — scrollable sur mobile */}
      <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-wrap gap-2 bg-gray-100/80 dark:bg-white/5 p-1 rounded-2xl w-full">
          {[
            { key: 'teams',    label: 'Équipes',      count: teams.length,    icon: <Building2 size={13} />, badge: 0 },
            { key: 'users',    label: 'Utilisateurs', count: users.length,    icon: <Users size={13} />,     badge: 0 },
            { key: 'alerts',   label: 'Alertes',      count: null,            icon: <Bell size={13} />,      badge: unreadCount },
            { key: 'articles', label: 'Articles',     count: articles.length, icon: <BookOpen size={13} />,  badge: 0 },
          ].map(tab => (
            <button
              key={tab.key}
              data-testid={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                activeTab === tab.key
                  ? tab.key === 'alerts' && unreadCount > 0
                    ? 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== null && <span className="text-gray-400 font-normal">({tab.count})</span>}
              {tab.badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold w-4 h-4 rounded-full
                                 flex items-center justify-center leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB : ÉQUIPES ── */}
      {activeTab === 'teams' && (
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-50 dark:border-white/5">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Liste des équipes</h2>
            <button
              onClick={() => setModal({ type: 'team-form', data: null })}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700
                         text-white text-xs font-semibold px-4 py-2 rounded-xl transition w-fit"
            >
              <Plus size={13} /> Créer une équipe
            </button>
          </div>

          {dataLoading ? (
            <SkeletonRows count={3} />
          ) : teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Building2 size={28} className="text-gray-300 dark:text-gray-700 mb-3" />
              <p className="text-gray-400 dark:text-gray-600 text-sm font-medium">Aucune équipe créée.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {teams.map((team) => (
                <div key={team.id} className="flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-gray-50/60 dark:hover:bg-white/3 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
                      <Building2 size={15} className="text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{team.nom_equipe}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {team.nombre_membres} membre{team.nombre_membres !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setModal({ type: 'team-form', data: team })}
                      className="w-8 h-8 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                                 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/50
                                 flex items-center justify-center transition" title="Modifier">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setModal({ type: 'confirm-delete', data: { target: team, kind: 'team' } })}
                      className="w-8 h-8 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50
                                 dark:hover:text-red-400 dark:hover:bg-red-950/50
                                 flex items-center justify-center transition" title="Supprimer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB : UTILISATEURS ── */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-50 dark:border-white/5">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Liste des utilisateurs</h2>
          </div>
          {dataLoading ? (
            <SkeletonRows count={4} />
          ) : (
            <div className="w-full overflow-x-auto">
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-gray-50/60 dark:hover:bg-white/3 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar prenom={u.prenom} nom={u.nom} role={u.role} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{u.prenom} {u.nom}</p>
                        {u.id === user.id && <span className="text-xs text-indigo-400">(vous)</span>}
                        <RoleBadge role={u.role} />
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-600 truncate">
                        {u.email}{u.nom_equipe ? ` · ${u.nom_equipe}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button onClick={() => setModal({ type: 'user-edit', data: u })}
                      className="w-8 h-8 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                                 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/50
                                 flex items-center justify-center transition" title="Modifier">
                      <Pencil size={14} />
                    </button>
                    {u.id !== user.id && !(user.role === 'rh' && u.role === 'admin') && (
                      <button onClick={() => setModal({ type: 'confirm-delete', data: { target: u, kind: 'user' } })}
                        className="w-8 h-8 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50
                                   dark:hover:text-red-400 dark:hover:bg-red-950/50
                                   flex items-center justify-center transition" title="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB : ALERTES ── */}
      {activeTab === 'alerts' && (
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-50 dark:border-white/5">
            <Bell size={15} className="text-red-400" />
            <h2 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Alertes prévention burn-out</h2>
            <span className="ml-auto text-xs text-gray-300 dark:text-gray-700 hidden sm:inline">
              Énergie &lt; 30 / 3 jours consécutifs
            </span>
          </div>

          {dataLoading ? (
            <SkeletonRows count={3} />
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <CheckCheck size={28} className="text-green-400" />
              <p className="text-gray-400 dark:text-gray-600 text-sm font-medium">Aucune alerte active.</p>
              <p className="text-gray-300 dark:text-gray-700 text-xs">Tout le monde va bien !</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {alerts.map((alert) => (
                <div key={alert.id}
                  className={`flex items-center justify-between px-4 sm:px-6 py-4 transition ${alert.is_read ? 'opacity-50' : 'hover:bg-red-50/20 dark:hover:bg-red-950/10'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${alert.is_read ? 'bg-gray-100 dark:bg-gray-800' : 'bg-red-50 dark:bg-red-950/40'}`}>
                      <AlertTriangle size={15} className={alert.is_read ? 'text-gray-400' : 'text-red-400'} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!alert.is_read && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                        <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{alert.prenom} {alert.nom}</p>
                        {alert.nom_equipe && <span className="text-xs text-gray-400">· {alert.nom_equipe}</span>}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-600 truncate">{alert.message}</p>
                      <p className="text-xs text-gray-300 dark:text-gray-700 mt-0.5">
                        {new Date(alert.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="ml-2 shrink-0">
                    {!alert.is_read ? (
                      <button onClick={() => handleMarkAlertRead(alert.id)}
                        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400
                                   hover:text-green-600 bg-gray-100 dark:bg-white/8 hover:bg-green-50 dark:hover:bg-green-950/40
                                   px-3 py-1.5 rounded-xl transition">
                        <CheckCheck size={12} /> Lu
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-700 italic">Lu</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB : ARTICLES ── */}
      {activeTab === 'articles' && (
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-50 dark:border-white/5">
            <div>
              <h2 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Ressources &amp; Articles</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {articles.length} article{articles.length !== 1 ? 's' : ''} publiés
              </p>
            </div>
            <button
              onClick={() => setModal({ type: 'article-form', data: null })}
              className="flex items-center gap-1.5 bg-cesizen-500 hover:bg-cesizen-600
                         text-white text-xs font-semibold px-4 py-2 rounded-xl transition w-fit"
            >
              <Plus size={13} /> Nouvel article
            </button>
          </div>

          {dataLoading ? (
            <SkeletonRows count={3} />
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <BookOpen size={28} className="text-gray-300 dark:text-gray-700 mb-3" />
              <p className="text-gray-400 dark:text-gray-600 text-sm font-medium">Aucun article publié.</p>
              <button
                onClick={() => setModal({ type: 'article-form', data: null })}
                className="mt-3 text-sm text-cesizen-500 hover:underline"
              >
                Créer le premier article
              </button>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {articles.map((article) => (
                <div key={article.id} className="flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-gray-50/60 dark:hover:bg-white/3 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-cesizen-50 dark:bg-cesizen-950/40 flex items-center justify-center shrink-0">
                      <BookOpen size={15} className="text-cesizen-500 dark:text-cesizen-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">{article.title}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {article.author_prenom} {article.author_nom}
                        {' · '}
                        {new Date(article.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => setModal({ type: 'article-form', data: article })}
                      className="w-8 h-8 rounded-xl text-gray-400 hover:text-cesizen-600 hover:bg-cesizen-50
                                 dark:hover:text-cesizen-400 dark:hover:bg-cesizen-950/40
                                 flex items-center justify-center transition" title="Modifier"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setModal({ type: 'confirm-delete', data: { target: article, kind: 'article' } })}
                      className="w-8 h-8 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50
                                 dark:hover:text-red-400 dark:hover:bg-red-950/50
                                 flex items-center justify-center transition" title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Formulaire équipe */}
      {modal?.type === 'team-form' && (
        <Modal title={modal.data ? "Modifier l'équipe" : 'Créer une équipe'} onClose={closeModal}>
          <form onSubmit={handleTeamSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Nom de l&apos;équipe
              </label>
              <input name="nom_equipe" type="text" defaultValue={modal.data?.nom_equipe ?? ''}
                maxLength={150} required autoFocus placeholder="ex: Équipe Produit"
                className="w-full rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10
                           px-4 py-3 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" />
            </div>
            <BtnPrimary loading={submitting}>
              {modal.data ? 'Enregistrer les modifications' : "Créer l'équipe"}
            </BtnPrimary>
          </form>
        </Modal>
      )}

      {/* Édition utilisateur */}
      {modal?.type === 'user-edit' && (
        <Modal title={`Modifier — ${modal.data.prenom} ${modal.data.nom}`} onClose={closeModal}>
          <form onSubmit={handleUserSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Rôle</label>
              <select name="role" defaultValue={modal.data.role} disabled={modal.data.id === user.id}
                className="w-full rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10
                           px-4 py-3 text-sm text-gray-800 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition disabled:opacity-50">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {modal.data.id === user.id && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">Vous ne pouvez pas modifier votre propre rôle.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Équipe</label>
              <select name="team_id" defaultValue={modal.data.team_id ?? ''}
                className="w-full rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10
                           px-4 py-3 text-sm text-gray-800 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
                <option value="">— Aucune équipe —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.nom_equipe}</option>)}
              </select>
            </div>
            <BtnPrimary loading={submitting}>Enregistrer</BtnPrimary>
          </form>
        </Modal>
      )}

      {/* Formulaire article (création / édition) */}
      {modal?.type === 'article-form' && (
        <Modal title={modal.data ? "Modifier l'article" : 'Nouvel article'} onClose={closeModal}>
          <form onSubmit={handleArticleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Titre
              </label>
              <input
                name="title"
                type="text"
                defaultValue={modal.data?.title ?? ''}
                required
                autoFocus
                placeholder="Titre de l'article"
                className="w-full rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10
                           px-4 py-3 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-cesizen-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Contenu
              </label>
              <textarea
                name="content"
                defaultValue={modal.data?.content ?? ''}
                required
                rows={7}
                placeholder="Rédigez le contenu de l'article..."
                className="w-full rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10
                           px-4 py-3 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-cesizen-500 focus:border-transparent
                           transition resize-none"
              />
            </div>
            <BtnPrimary loading={submitting}>
              {modal.data ? 'Enregistrer les modifications' : "Publier l'article"}
            </BtnPrimary>
          </form>
        </Modal>
      )}

      {/* Confirmation de suppression (équipe / utilisateur / article) */}
      {modal?.type === 'confirm-delete' && (
        <Modal title="Confirmer la suppression" onClose={closeModal}>
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-4">
              <AlertTriangle className="text-red-500" size={24} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {modal.data.kind === 'team' ? (
                <>Supprimer l&apos;équipe <strong className="text-gray-800 dark:text-gray-100">« {modal.data.target.nom_equipe} »</strong> ? Les membres seront retirés de cette équipe.</>
              ) : modal.data.kind === 'article' ? (
                <>Supprimer l&apos;article <strong className="text-gray-800 dark:text-gray-100">« {modal.data.target.title} »</strong> ? Cette action est irréversible.</>
              ) : (
                <>Supprimer <strong className="text-gray-800 dark:text-gray-100">{modal.data.target.prenom} {modal.data.target.nom}</strong> ? Toutes ses données seront supprimées.</>
              )}
            </p>
          </div>
          <div className="space-y-2">
            <BtnDanger
              loading={submitting}
              onClick={() =>
                modal.data.kind === 'team'    ? handleTeamDelete(modal.data.target)    :
                modal.data.kind === 'article' ? handleArticleDelete(modal.data.target) :
                handleUserDelete(modal.data.target)
              }
            >
              Oui, supprimer définitivement
            </BtnDanger>
            <button
              onClick={closeModal}
              className="w-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-white/5 font-medium py-3.5 rounded-2xl text-sm transition cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </Modal>
      )}

    </div>
  )
}
