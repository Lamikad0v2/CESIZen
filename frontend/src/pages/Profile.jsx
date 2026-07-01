import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, AlertCircle, User, Shield, Mail, Lock } from 'lucide-react'
import api from '../api/axios'

// ----------------------------------------------------------------
// Validation (miroir des règles backend)
// ----------------------------------------------------------------
const REGEX_NAME = /^[\p{L}\s-]{2,}$/u

function isValidName(v) { return REGEX_NAME.test(v.trim()) }

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
    <li className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
      {met ? <CheckCircle2 size={12} className="shrink-0" /> : <XCircle size={12} className="shrink-0" />}
      {label}
    </li>
  )
}

// ----------------------------------------------------------------
// Composant principal
// ----------------------------------------------------------------
export default function Profile() {
  const navigate = useNavigate()

  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cesizen_user') ?? 'null') }
    catch { return null }
  })

  const [form, setForm] = useState({
    prenom:       user?.prenom       ?? '',
    nom:          user?.nom          ?? '',
    mot_de_passe: '',
  })

  const [feedback,         setFeedback]         = useState({ type: '', message: '' })
  const [loading,          setLoading]          = useState(false)
  const [showDeleteModal,  setShowDeleteModal]  = useState(false)
  const [deleting,         setDeleting]         = useState(false)

  const passwordCriteria      = useMemo(() => getPasswordCriteria(form.mot_de_passe), [form.mot_de_passe])
  const allPasswordCriteriaMet = Object.values(passwordCriteria).every(Boolean)
  const isFormValid = isValidName(form.prenom) && isValidName(form.nom) &&
    (form.mot_de_passe === '' || allPasswordCriteriaMet)

  // Redirige si non authentifié
  if (!user) {
    navigate('/login', { replace: true })
    return null
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isFormValid) return
    setFeedback({ type: '', message: '' })
    setLoading(true)
    try {
      const payload = {
        prenom: form.prenom.trim(),
        nom:    form.nom.trim(),
      }
      if (form.mot_de_passe !== '') payload.mot_de_passe = form.mot_de_passe

      const { data } = await api.put('/api/account/profile', payload)
      setFeedback({ type: 'success', message: data.message })

      // Met à jour le localStorage avec le nouveau nom/prénom
      const updated = { ...user, prenom: payload.prenom, nom: payload.nom }
      localStorage.setItem('cesizen_user', JSON.stringify(updated))
      setUser(updated)
      setForm(f => ({ ...f, mot_de_passe: '' }))
    } catch (err) {
      const message = err.response?.data?.message ?? 'Une erreur est survenue.'
      setFeedback({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      await api.delete('/api/account')
      localStorage.removeItem('cesizen_user')
      navigate('/login', { replace: true })
    } catch {
      setShowDeleteModal(false)
    } finally {
      setDeleting(false)
    }
  }

  const ROLE_LABEL = {
    admin:         'Administrateur',
    rh:            'Ressources Humaines',
    manager:       'Manager',
    collaborateur: 'Collaborateur',
  }

  const initials = `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase()

  // ----------------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------------
  return (
    <div className="max-w-2xl space-y-5">

      {/* En-tête profil */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Mon profil</h1>
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Gérez vos informations personnelles.</p>
      </div>

      {/* Carte identité */}
      <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-sm p-6
                      flex items-center gap-5">
        {/* Avatar grand */}
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
          <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{initials}</span>
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            {user.prenom} {user.nom}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Mail size={11} /> {user.email}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Shield size={11} /> {ROLE_LABEL[user.role] ?? user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Formulaire de modification */}
      <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-sm p-7">
        <div className="flex items-center gap-2 mb-6">
          <User size={16} className="text-indigo-500" />
          <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-white">
            Modifier mes informations
          </h2>
        </div>

        {feedback.message && (
          <div className={`mb-5 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
          }`}>
            {feedback.type === 'success'
              ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
              : <AlertCircle  size={15} className="shrink-0 mt-0.5" />
            }
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Prénom + Nom */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Prénom
              </label>
              <input
                type="text" name="prenom" value={form.prenom}
                onChange={handleChange} required
                className="w-full rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10
                           px-4 py-3 text-sm text-gray-800 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              {form.prenom && !isValidName(form.prenom) && (
                <p className="mt-1 text-xs text-red-500">Lettres uniquement, min. 2 caractères.</p>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Nom
              </label>
              <input
                type="text" name="nom" value={form.nom}
                onChange={handleChange} required
                className="w-full rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10
                           px-4 py-3 text-sm text-gray-800 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              {form.nom && !isValidName(form.nom) && (
                <p className="mt-1 text-xs text-red-500">Lettres uniquement, min. 2 caractères.</p>
              )}
            </div>
          </div>

          {/* Nouveau mot de passe (optionnel) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Nouveau mot de passe{' '}
              <span className="font-normal normal-case text-gray-400">(laisser vide pour ne pas changer)</span>
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password" name="mot_de_passe" value={form.mot_de_passe}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10
                           pl-10 pr-4 py-3 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {form.mot_de_passe !== '' && (
              <ul className="mt-2.5 space-y-1.5 pl-1">
                <CriterionRow met={passwordCriteria.length}  label="Minimum 8 caractères" />
                <CriterionRow met={passwordCriteria.upper}   label="Au moins 1 majuscule" />
                <CriterionRow met={passwordCriteria.digit}   label="Au moins 1 chiffre" />
                <CriterionRow met={passwordCriteria.special} label="Au moins 1 caractère spécial" />
              </ul>
            )}
          </div>

          <button
            type="submit"
            disabled={!isFormValid || loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                       text-white font-semibold py-3.5 rounded-2xl text-sm transition
                       cursor-pointer disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </form>
      </div>

      {/* Section RGPD */}
      <div className="bg-white dark:bg-gray-900/80 rounded-3xl border border-red-100 dark:border-red-900/40 shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Zone de danger</h2>
        <p className="text-xs text-gray-400 dark:text-gray-600 mb-4">
          La suppression est irréversible. Toutes vos données d&apos;humeur et votre compte seront définitivement effacés (RGPD art. 17).
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 text-sm font-semibold text-red-500 hover:text-red-600
                     dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-950/40
                     hover:bg-red-100 dark:hover:bg-red-900/40 px-4 py-2.5 rounded-2xl transition"
        >
          <AlertCircle size={15} />
          Supprimer mon compte et mes données
        </button>
      </div>

      {/* Modal RGPD */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm p-7 border border-gray-100 dark:border-white/10">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center mb-4">
                <AlertCircle className="text-red-500" size={26} />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
                Supprimer mon compte
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Cette action est <strong className="text-gray-800 dark:text-gray-100">irréversible</strong>.
                Votre compte et toutes vos données seront définitivement supprimés (RGPD art. 17).
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50
                           text-white font-semibold py-3.5 rounded-2xl text-sm transition
                           cursor-pointer disabled:cursor-not-allowed"
              >
                {deleting ? 'Suppression en cours…' : 'Supprimer définitivement'}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="w-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300
                           hover:bg-gray-50 dark:hover:bg-white/5 font-medium py-3.5 rounded-2xl text-sm transition cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
