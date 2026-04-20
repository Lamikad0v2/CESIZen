import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Calendar, X } from 'lucide-react'
import api from '../api/axios'

// ----------------------------------------------------------------
// Modal Glassmorphism — Article complet
// ----------------------------------------------------------------
function ArticleModal({ article, onClose }) {
  if (!article) return null

  const date = new Date(article.created_at).toLocaleDateString('fr-FR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl
                   w-full max-w-2xl max-h-[85vh] flex flex-col
                   border border-white/50 dark:border-white/10"
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4 p-7 border-b border-gray-100 dark:border-white/8 shrink-0">
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white leading-snug">
            {article.title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20
                       flex items-center justify-center text-gray-500 dark:text-gray-400 transition shrink-0"
            aria-label="Fermer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Méta */}
        <div className="flex items-center gap-2 px-7 pt-5 pb-0 text-xs text-gray-400 dark:text-gray-500 shrink-0">
          <Calendar size={12} />
          <span>{date}</span>
          <span>·</span>
          <span>{article.author_prenom} {article.author_nom}</span>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {article.content}
          </p>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Carte d'article — grille Bento
// ----------------------------------------------------------------
function ArticleCard({ article, onClick }) {
  const excerpt = article.content.length > 160
    ? article.content.slice(0, 160) + '…'
    : article.content

  const date = new Date(article.created_at).toLocaleDateString('fr-FR', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <button
      onClick={() => onClick(article)}
      className="group bg-white dark:bg-gray-800/60 rounded-3xl p-6 text-left
                 shadow-sm hover:shadow-md transition-all duration-200
                 border border-gray-100/80 dark:border-white/8
                 hover:-translate-y-0.5 flex flex-col gap-3"
    >
      {/* Icône */}
      <div className="w-10 h-10 rounded-2xl bg-cesizen-50 dark:bg-cesizen-900/40
                      flex items-center justify-center shrink-0">
        <BookOpen size={18} className="text-cesizen-500 dark:text-cesizen-400" />
      </div>

      {/* Texte */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white
                       group-hover:text-cesizen-600 dark:group-hover:text-cesizen-400
                       transition-colors line-clamp-2">
          {article.title}
        </h3>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">
          {excerpt}
        </p>
      </div>

      {/* Méta */}
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 mt-auto pt-1">
        <Calendar size={11} />
        <span>{date}</span>
        <span>·</span>
        <span className="truncate">{article.author_prenom} {article.author_nom}</span>
      </div>
    </button>
  )
}

// ----------------------------------------------------------------
// Page Articles
// ----------------------------------------------------------------
export default function Articles() {
  const navigate = useNavigate()
  const [articles,         setArticles]         = useState([])
  const [loading,          setLoading]           = useState(true)
  const [error,            setError]             = useState(null)
  const [selectedArticle,  setSelectedArticle]   = useState(null)

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('cesizen_user') ?? 'null') }
    catch { return null }
  })()

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return }

    api.get('/api/articles')
      .then(res => setArticles(res.data.data ?? []))
      .catch(() => setError('Erreur lors du chargement des ressources.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto">
      {/* En-tête de page */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-2xl bg-cesizen-500 flex items-center justify-center shadow-sm">
            <BookOpen size={16} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Ressources
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 ml-12">
          Articles et guides pour votre bien-être au travail
        </p>
      </div>

      {/* Erreur */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-900/20
                        text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Chargement */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-cesizen-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* État vide */}
      {!loading && !error && articles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-3xl bg-gray-100 dark:bg-gray-800
                          flex items-center justify-center mb-4">
            <BookOpen size={28} className="text-gray-400 dark:text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Aucune ressource disponible pour le moment.
          </p>
        </div>
      )}

      {/* Grille Bento */}
      {!loading && articles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              onClick={setSelectedArticle}
            />
          ))}
        </div>
      )}

      {/* Modal article complet */}
      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
        />
      )}
    </div>
  )
}
