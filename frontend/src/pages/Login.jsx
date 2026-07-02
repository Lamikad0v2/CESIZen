import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

export default function Login() {
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', mot_de_passe: '' })
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFeedback({ type: '', message: '' })
    setLoading(true)

    try {
      const { data } = await api.post('/api/login', form)
      setFeedback({ type: 'success', message: data.message })
      localStorage.setItem('cesizen_user', JSON.stringify(data.data))
      const redirectTo = '/dashboard'
      setTimeout(() => navigate(redirectTo), 1500)
    } catch (err) {
      const message =
        err.response?.data?.message ?? 'An unexpected error occurred.'
      setFeedback({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Carte principale */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl dark:shadow-black/40 p-10 border border-gray-100/80 dark:border-white/10">

          {/* Logo / Brand mark */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="text-white text-2xl font-bold tracking-tight">CZ</span>
            </div>
          </div>

          {/* En-tête */}
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-1 text-center">
            Connexion
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-8 text-center">
            Bon retour sur CESIZen.
          </p>

          {/* Message de retour */}
          {feedback.message && (
            <div
              className={`mb-6 rounded-2xl px-4 py-3 text-sm font-medium text-center ${
                feedback.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {feedback.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="jean.dupont@example.com"
                className="w-full rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-3 text-sm
                           text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           transition"
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="mot_de_passe" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Mot de passe
              </label>
              <input
                id="mot_de_passe"
                type="password"
                name="mot_de_passe"
                value={form.mot_de_passe}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className="w-full rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-3 text-sm
                           text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           transition"
              />
            </div>

            {/* Bouton */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                         text-white font-semibold py-3.5 rounded-2xl text-sm transition
                         cursor-pointer disabled:cursor-not-allowed shadow-sm shadow-indigo-200
                         mt-2"
            >
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-gray-400 dark:text-gray-500">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold">
              S&apos;inscrire
            </Link>
          </p>
        </div>

        {/* Footer discret */}
        <p className="mt-6 text-center text-xs text-gray-400">
          CESIZen — Bien-être au travail
        </p>
      </div>
    </div>
  )
}
