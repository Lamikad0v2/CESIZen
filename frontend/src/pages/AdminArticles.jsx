import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, X, BookOpen } from 'lucide-react'
import api from '../api/axios'

// ----------------------------------------------------------------
// Modal réutilisable
// ----------------------------------------------------------------
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg p-7
                      border border-gray-100 dark:border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            {title}
          </h3>
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

// ----------------------------------------------------------------
// Page AdminArticles
// ----------------------------------------------------------------
export default function AdminArticles() {
  const navigate = useNavigate()

  const [articles, setArticles] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [toast,    setToast]    = useState(null)
  const [modal,    setModal]    = useState(null)   // null | 'form' | 'delete'
  const [editing,  setEditing]  = useState(null)   // article en cours d'édition
  const [deleting, setDeleting] = useState(null)   // article en cours de suppression
  const [form,     setForm]     = useState({ title: '', content: '' })

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('cesizen_user') ?? 'null') }
    catch { return null }
  })()

  useEffect(() => {
    if (!user) { navigate('/login',     { replace: true }); return }
    if (!['admin', 'rh'].includes(user.role)) {
      navigate('/dashboard', { replace: true }); return
    }
    // eslint-disable-next-line react-hooks/immutability
    loadArticles()
  }, [])

  function loadArticles() {
    setLoading(true)
    api.get('/api/articles')
      .then(res => setArticles(res.data.data ?? []))
      .catch(() => showToast('Erreur lors du chargement des articles.', 'error'))
      .finally(() => setLoading(false))
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function openCreate() {
    setForm({ title: '', content: '' })
    setEditing(null)
    setModal('form')
  }

  function openEdit(article) {
    setForm({ title: article.title, content: article.content })
    setEditing(article)
    setModal('form')
  }

  function openDelete(article) {
    setDeleting(article)
    setModal('delete')
  }

  function closeModal() {
    setModal(null)
    setEditing(null)
    setDeleting(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return

    try {
      if (editing) {
        await api.put(`/api/articles/${editing.id}`, form)
        showToast('Article modifié avec succès.')
      } else {
        await api.post('/api/articles', form)
        showToast('Article créé avec succès.')
      }
      closeModal()
      loadArticles()
    } catch {
      showToast('Une erreur est survenue. Veuillez réessayer.', 'error')
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await api.delete(`/api/articles/${deleting.id}`)
      showToast('Article supprimé.')
      closeModal()
      loadArticles()
    } catch {
      showToast('Impossible de supprimer cet article.', 'error')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-cesizen-500 flex items-center justify-center shadow-sm">
            <BookOpen size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Gestion des Articles
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Créez et gérez les ressources bien-être
            </p>
          </div>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-cesizen-500 hover:bg-cesizen-600
                     text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={15} />
          <span>Nouvel article</span>
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-5 px-4 py-3 rounded-2xl text-sm font-medium flex items-center justify-between
          ${toast.type === 'error'
            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}
        >
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-3 opacity-60 hover:opacity-100 transition">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tableau des articles */}
      <div className="bg-white dark:bg-gray-800/60 rounded-3xl
                      border border-gray-100/80 dark:border-white/8 overflow-hidden shadow-sm">

        {/* En-tête du tableau */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Liste des articles
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {articles.length} article{articles.length !== 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <div className="w-5 h-5 border-2 border-cesizen-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <BookOpen size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Aucun article pour l&apos;instant.
            </p>
            <button onClick={openCreate} className="mt-3 text-sm text-cesizen-500 hover:underline">
              Créer le premier article
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100/60 dark:divide-white/6">
            {articles.map(article => (
              <div key={article.id} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {article.title}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {article.author_prenom} {article.author_nom}
                    {' · '}
                    {new Date(article.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(article)}
                    title="Modifier"
                    className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/10
                               hover:bg-cesizen-50 dark:hover:bg-cesizen-900/30
                               hover:text-cesizen-600 text-gray-500
                               flex items-center justify-center transition"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => openDelete(article)}
                    title="Supprimer"
                    className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/10
                               hover:bg-red-50 dark:hover:bg-red-900/20
                               hover:text-red-500 text-gray-500
                               flex items-center justify-center transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Création / Édition */}
      {modal === 'form' && (
        <Modal
          title={editing ? "Modifier l'article" : 'Nouvel article'}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Titre
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Titre de l'article"
                className="w-full px-4 py-2.5 rounded-2xl
                           bg-gray-50 dark:bg-white/8
                           border border-gray-200/60 dark:border-white/10
                           text-sm text-gray-900 dark:text-white placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-cesizen-400 dark:focus:ring-cesizen-600
                           transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Contenu
              </label>
              <textarea
                value={form.content}
                onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                placeholder="Rédigez le contenu de votre article..."
                rows={8}
                className="w-full px-4 py-2.5 rounded-2xl
                           bg-gray-50 dark:bg-white/8
                           border border-gray-200/60 dark:border-white/10
                           text-sm text-gray-900 dark:text-white placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-cesizen-400 dark:focus:ring-cesizen-600
                           transition resize-none"
                required
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-2xl bg-cesizen-500 hover:bg-cesizen-600
                           text-white text-sm font-semibold transition-colors"
              >
                {editing ? 'Sauvegarder les modifications' : "Créer l'article"}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="py-2.5 px-5 rounded-2xl bg-gray-100 dark:bg-white/10
                           hover:bg-gray-200 dark:hover:bg-white/15
                           text-gray-600 dark:text-gray-400 text-sm font-medium transition"
              >
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Confirmation de suppression */}
      {modal === 'delete' && deleting && (
        <Modal title="Supprimer l'article" onClose={closeModal}>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Êtes-vous sûr de vouloir supprimer{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              &ldquo;{deleting.title}&rdquo;
            </span>{' '}
            ? Cette action est irréversible.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDelete}
              className="flex-1 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600
                         text-white text-sm font-semibold transition-colors"
            >
              Supprimer définitivement
            </button>
            <button
              onClick={closeModal}
              className="py-2.5 px-5 rounded-2xl bg-gray-100 dark:bg-white/10
                         hover:bg-gray-200 dark:hover:bg-white/15
                         text-gray-600 dark:text-gray-400 text-sm font-medium transition"
            >
              Annuler
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
