import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import api from '../api/axios'

// ----------------------------------------------------------------
// Règles de validation — miroir exact des regex backend PHP
// ----------------------------------------------------------------
const REGEX_NAME  = /^[\p{L}\s-]{2,}$/u
const REGEX_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function isValidName(value)  { return REGEX_NAME.test(value.trim()) }
function isValidEmail(value) { return REGEX_EMAIL.test(value.trim()) }

function getPasswordCriteria(password) {
  return {
    length:  password.length >= 8,
    upper:   /[A-Z]/.test(password),
    digit:   /[0-9]/.test(password),
    special: /[\W_]/.test(password),
  }
}

function CriterionRow({ met, label }) {
  return (
    <li className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-green-600' : 'text-gray-400'}`}>
      {met
        ? <CheckCircle2 size={13} className="shrink-0" />
        : <XCircle     size={13} className="shrink-0" />
      }
      {label}
    </li>
  )
}

export default function Register() {
  const navigate = useNavigate()

  const [form, setForm] = useState({ nom: '', prenom: '', email: '', mot_de_passe: '' })
  const [touched, setTouched] = useState({ nom: false, prenom: false, email: false })
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [loading,  setLoading]  = useState(false)

  const passwordCriteria     = useMemo(() => getPasswordCriteria(form.mot_de_passe), [form.mot_de_passe])
  const allPasswordCriteriaMet = Object.values(passwordCriteria).every(Boolean)
  const isFormValid =
    isValidName(form.nom) && isValidName(form.prenom) &&
    isValidEmail(form.email) && allPasswordCriteriaMet

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }) }
  function handleBlur(e)   { setTouched({ ...touched, [e.target.name]: true }) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isFormValid) return
    setFeedback({ type: '', message: '' })
    setLoading(true)
    try {
      const { data } = await api.post('/api/register', form)
      setFeedback({ type: 'success', message: data.message })
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      const message = err.response?.data?.message ?? 'An unexpected error occurred.'
      setFeedback({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  /** Classes CSS d'un input selon son état de validation. */
  function inputClass(fieldName, isValid) {
    const base =
      'w-full rounded-2xl bg-gray-50 dark:bg-white/5 border px-4 py-3 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 transition ' +
      'focus:outline-none focus:ring-2 focus:border-transparent'
    if (!touched[fieldName]) return `${base} border-gray-200 dark:border-white/10 focus:ring-indigo-500`
    return isValid
      ? `${base} border-green-300 dark:border-green-700 focus:ring-green-400`
      : `${base} border-red-300 dark:border-red-700  focus:ring-red-400`
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Carte principale */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl dark:shadow-black/40 p-10 border border-gray-100/80 dark:border-white/10">

          {/* Logo / Brand mark */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="text-white text-2xl font-bold tracking-tight">CZ</span>
            </div>
          </div>

          {/* En-tête */}
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-1 text-center">
            Créer un compte
          </h1>
          <p className="text-sm text-gray-400 mb-8 text-center">
            Rejoignez CESIZen et commencez à suivre votre bien-être.
          </p>

          {/* Bannière de retour API */}
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

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Nom & Prénom — côte à côte */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Nom
                </label>
                <input
                  type="text"
                  name="nom"
                  value={form.nom}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Dupont"
                  className={inputClass('nom', isValidName(form.nom))}
                />
                {touched.nom && !isValidName(form.nom) && (
                  <p className="mt-1 text-xs text-red-500">
                    Lettres, tirets et espaces (min. 2 car.).
                  </p>
                )}
              </div>

              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Prénom
                </label>
                <input
                  type="text"
                  name="prenom"
                  value={form.prenom}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Jean"
                  className={inputClass('prenom', isValidName(form.prenom))}
                />
                {touched.prenom && !isValidName(form.prenom) && (
                  <p className="mt-1 text-xs text-red-500">
                    Lettres, tirets et espaces (min. 2 car.).
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Adresse email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="jean.dupont@example.com"
                className={inputClass('email', isValidEmail(form.email))}
              />
              {touched.email && !isValidEmail(form.email) && (
                <p className="mt-1 text-xs text-red-500">
                  Veuillez saisir une adresse email valide.
                </p>
              )}
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Mot de passe
              </label>
              <input
                type="password"
                name="mot_de_passe"
                value={form.mot_de_passe}
                onChange={handleChange}
                placeholder="Créez un mot de passe fort"
                className={
                  'w-full rounded-2xl bg-gray-50 border px-4 py-3 text-sm text-gray-800 placeholder-gray-400 transition ' +
                  'focus:outline-none focus:ring-2 focus:border-transparent ' +
                  (form.mot_de_passe === ''
                    ? 'border-gray-200 focus:ring-indigo-500'
                    : allPasswordCriteriaMet
                      ? 'border-green-300 focus:ring-green-400'
                      : 'border-orange-300 focus:ring-orange-400')
                }
              />

              {/* Checklist des critères */}
              {form.mot_de_passe !== '' && (
                <ul className="mt-3 space-y-1.5 pl-1">
                  <CriterionRow met={passwordCriteria.length}  label="Minimum 8 caractères" />
                  <CriterionRow met={passwordCriteria.upper}   label="Au moins 1 majuscule" />
                  <CriterionRow met={passwordCriteria.digit}   label="Au moins 1 chiffre" />
                  <CriterionRow met={passwordCriteria.special} label="Au moins 1 caractère spécial (!@#$…)" />
                </ul>
              )}
            </div>

            {/* Bouton */}
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                         text-white font-semibold py-3.5 rounded-2xl text-sm transition
                         cursor-pointer disabled:cursor-not-allowed shadow-sm shadow-indigo-200
                         mt-2"
            >
              {loading ? 'Inscription en cours…' : "S'inscrire"}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-gray-400">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">
              Se connecter
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          CESIZen — Bien-être au travail
        </p>
      </div>
    </div>
  )
}
