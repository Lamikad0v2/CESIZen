/* eslint-disable react-hooks/static-components */
import { useState, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import PropTypes from 'prop-types'
import {
  Home, ShieldCheck, Users, User, LogOut,
  Moon, Sun, Menu, X, PenLine,
  ChevronLeft, ChevronRight, ChevronDown,
  BookOpen,
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

// ----------------------------------------------------------------
// Halos décoratifs — arrière-plan vivant
// ----------------------------------------------------------------
function BackgroundHalos() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
      <div className="absolute -top-60 -right-60 w-[600px] h-[600px] rounded-full
                      bg-cesizen-400/8 dark:bg-cesizen-600/6 blur-3xl" />
      <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] rounded-full
                      bg-cyan-400/8 dark:bg-cyan-600/5 blur-3xl" />
      <div className="absolute bottom-10 right-1/4 w-[350px] h-[350px] rounded-full
                      bg-purple-400/8 dark:bg-purple-600/6 blur-3xl" />
    </div>
  )
}

// ----------------------------------------------------------------
// NavItem — entrée de navigation (expanded ou collapsed)
// ----------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
function NavItem({ to, icon: Icon, label, isActive, collapsed, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={`group relative flex items-center rounded-2xl text-sm font-medium transition-all duration-200
        ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-4 py-2.5 w-full'}
        ${isActive
          ? 'bg-cesizen-500 text-white shadow-sm shadow-cesizen-200 dark:shadow-cesizen-900'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-white/8'
        }`}
    >
      <Icon size={16} className="shrink-0" />
      {!collapsed && <span>{label}</span>}

      {/* Tooltip quand sidebar rétractée */}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap
                         rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900
                         text-xs font-medium px-2.5 py-1.5
                         opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
          {label}
        </span>
      )}
    </Link>
  )
}

NavItem.propTypes = {
  to:        PropTypes.string.isRequired,
  icon:      PropTypes.elementType.isRequired,
  label:     PropTypes.string.isRequired,
  isActive:  PropTypes.bool.isRequired,
  collapsed: PropTypes.bool.isRequired,
  onClick:   PropTypes.func,
}

// ----------------------------------------------------------------
// NavSection — catégorie rétractable
// ----------------------------------------------------------------
function NavSection({ label, items, collapsed, isExpanded, onToggle, isActive, onNavClick }) {
  const hasActiveItem = items.some(item => isActive(item.to))

  return (
    <div className="mb-1">
      {/* En-tête de section */}
      {!collapsed && (
        <button
          onClick={onToggle}
          className={`w-full flex items-center justify-between px-4 py-1.5 rounded-xl
                      text-[11px] font-semibold uppercase tracking-wider transition-colors
                      ${hasActiveItem
                        ? 'text-cesizen-600 dark:text-cesizen-400'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                      }`}
        >
          <span>{label}</span>
          <ChevronDown
            size={12}
            className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
          />
        </button>
      )}

      {/* Séparateur en mode collapsed */}
      {collapsed && (
        <div className="w-6 h-px mx-auto my-2 bg-gray-200/60 dark:bg-white/10" />
      )}

      {/* Items avec transition max-height */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: (collapsed || isExpanded) ? '500px' : '0px' }}
      >
        <div className="space-y-0.5 py-0.5">
          {items.map(({ to, icon, label: itemLabel }) => (
            <NavItem
              key={to}
              to={to}
              icon={icon}
              label={itemLabel}
              isActive={isActive(to)}
              collapsed={collapsed}
              onClick={onNavClick}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

NavSection.propTypes = {
  label:      PropTypes.string.isRequired,
  items:      PropTypes.arrayOf(PropTypes.shape({
    to:    PropTypes.string.isRequired,
    icon:  PropTypes.elementType.isRequired,
    label: PropTypes.string.isRequired,
  })).isRequired,
  collapsed:   PropTypes.bool.isRequired,
  isExpanded:  PropTypes.bool.isRequired,
  onToggle:    PropTypes.func.isRequired,
  isActive:    PropTypes.func.isRequired,
  onNavClick:  PropTypes.func,
}

// ----------------------------------------------------------------
// SidebarContent (desktop + mobile drawer) — S6478: défini hors du parent
// ----------------------------------------------------------------
function SidebarContent({
  isMobile, onClose,
  collapsed, expandedSections, navSections,
  isActive, toggleCollapse, toggleSection,
  initials, user, handleLogout,
}) {
  const sidebarCollapsed = isMobile ? false : collapsed

  return (
    <>
      {/* ── Logo + bouton collapse ── */}
      <div className={`flex items-center border-b border-gray-200/60 dark:border-white/10 shrink-0
                       transition-all duration-200
                       ${sidebarCollapsed ? 'justify-center px-3 py-4' : 'justify-between px-5 py-5'}`}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cesizen-500 flex items-center justify-center shadow-md">
              <span className="text-white text-xs font-bold tracking-tight">CZ</span>
            </div>
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-white">
              CESIZen
            </span>
          </div>
        )}

        {sidebarCollapsed && (
          <div className="w-8 h-8 rounded-xl bg-cesizen-500 flex items-center justify-center shadow-md">
            <span className="text-white text-xs font-bold tracking-tight">CZ</span>
          </div>
        )}

        {/* Bouton fermeture mobile */}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-xl
                       text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition"
          >
            <X size={15} />
          </button>
        )}

        {/* Bouton collapse desktop */}
        {!isMobile && (
          <button
            onClick={toggleCollapse}
            aria-label={collapsed ? 'Développer la sidebar' : 'Réduire la sidebar'}
            className={`w-7 h-7 flex items-center justify-center rounded-xl
                        text-gray-400 hover:text-cesizen-600 hover:bg-cesizen-50 dark:hover:bg-cesizen-900/30
                        transition-colors duration-150 ${sidebarCollapsed ? 'mt-0' : ''}`}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}
      </div>

      {/* ── Navigation par sections ── */}
      <nav className={`flex-1 overflow-y-auto transition-all duration-200
                       ${sidebarCollapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
        {navSections.map(section => (
          <NavSection
            key={section.id}
            label={section.label}
            items={section.items}
            collapsed={sidebarCollapsed}
            isExpanded={expandedSections[section.id]}
            onToggle={() => toggleSection(section.id)}
            isActive={isActive}
            onNavClick={isMobile ? onClose : undefined}
          />
        ))}
      </nav>

      {/* ── Utilisateur + Déconnexion ── */}
      <div className={`border-t border-gray-200/60 dark:border-white/10 shrink-0
                       ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
        {sidebarCollapsed ? (
          /* Mode icône : avatar centré + bouton logout */
          <div className="flex flex-col items-center gap-1.5">
            <Link
              to="/profile"
              title={`${user?.prenom} ${user?.nom}`}
              className="group relative w-9 h-9 rounded-xl bg-cesizen-100 dark:bg-cesizen-900
                         flex items-center justify-center hover:ring-2 hover:ring-cesizen-400 transition"
            >
              <span className="text-xs font-bold text-cesizen-700 dark:text-cesizen-300">{initials}</span>
              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap
                               rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900
                               text-xs font-medium px-2.5 py-1.5
                               opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {user?.prenom} {user?.nom}
              </span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-7 h-7 flex items-center justify-center rounded-xl
                         text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          /* Mode expanded : card utilisateur */
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-gray-50 dark:bg-white/5">
            <div className="w-8 h-8 rounded-xl bg-cesizen-100 dark:bg-cesizen-900
                            flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-cesizen-700 dark:text-cesizen-300">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                {user?.prenom} {user?.nom}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate capitalize">
                {user?.role}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="w-7 h-7 flex items-center justify-center rounded-xl
                         text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  )
}

SidebarContent.propTypes = {
  isMobile:         PropTypes.bool,
  onClose:          PropTypes.func,
  collapsed:        PropTypes.bool.isRequired,
  expandedSections: PropTypes.object.isRequired,
  navSections:      PropTypes.array.isRequired,
  isActive:         PropTypes.func.isRequired,
  toggleCollapse:   PropTypes.func.isRequired,
  toggleSection:    PropTypes.func.isRequired,
  initials:         PropTypes.string.isRequired,
  user:             PropTypes.object,
  handleLogout:     PropTypes.func.isRequired,
}

// ----------------------------------------------------------------
// Composant principal
// ----------------------------------------------------------------
export default function Layout({ children }) {
  const navigate    = useNavigate()
  const location    = useLocation()
  const { dark, toggle } = useTheme()

  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Collapse persisté en localStorage
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('cesizen_sidebar_collapsed') === 'true' }
    catch { return false }
  })

  // Sections expanded (toutes ouvertes par défaut)
  const [expandedSections, setExpandedSections] = useState({
    personnel: true,
    equipe:    true,
    gestion:   true,
  })

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('cesizen_user') ?? 'null') }
    catch { return null }
  })()

  function handleLogout() {
    localStorage.removeItem('cesizen_user')
    navigate('/login', { replace: true })
  }

  function toggleCollapse() {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('cesizen_sidebar_collapsed', String(next)) } catch { /* noop */ }
      return next
    })
  }

  function toggleSection(id) {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const isActive = useCallback((to) => location.pathname === to, [location.pathname])

  const initials = user
    ? `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase()
    : '?'

  // Sections de navigation
  const navSections = [
    {
      id:    'personnel',
      label: 'Personnel',
      show:  true,
      items: [
        { to: '/dashboard', icon: Home,      label: 'Tableau de bord' },
        { to: '/track',     icon: PenLine,   label: 'Saisie'          },
        { to: '/articles',  icon: BookOpen,  label: 'Ressources'      },
        { to: '/profile',   icon: User,      label: 'Profil'          },
      ],
    },
    {
      id:    'equipe',
      label: 'Équipe',
      show:  user?.role === 'manager',
      items: [
        { to: '/manager', icon: Users, label: 'Équipe' },
      ],
    },
    {
      id:    'gestion',
      label: 'Gestion',
      show:  ['admin', 'rh'].includes(user?.role),
      items: [
        { to: '/admin', icon: ShieldCheck, label: 'Administration' },
      ],
    },
  ].filter(s => s.show)

  // Version plate pour la bottom tab bar mobile
  const flatNavItems = navSections.flatMap(s => s.items)

  // Props communs pour SidebarContent
  const sidebarProps = {
    collapsed, expandedSections, navSections,
    isActive, toggleCollapse, toggleSection,
    initials, user, handleLogout,
  }

  // ----------------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------------
  const sidebarWidth = collapsed ? 'w-[4.5rem]' : 'w-56'
  const mainMargin   = collapsed ? 'lg:ml-[4.5rem]' : 'lg:ml-56'

  return (
    <div className="flex min-h-screen
                    bg-gradient-to-br from-slate-50 via-white to-cesizen-50/30
                    dark:from-gray-950 dark:via-gray-900 dark:to-cesizen-950/50
                    relative">
      <BackgroundHalos />

      {/* ── Sidebar Desktop (fixe gauche, lg+) ── */}
      <aside
        className={`hidden lg:flex flex-col ${sidebarWidth} shrink-0 fixed left-0 top-0 h-full z-30
                    bg-white/70 dark:bg-black/40 backdrop-blur-xl
                    border-r border-gray-200/50 dark:border-white/10
                    transition-all duration-200`}
      >
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ── Drawer mobile (overlay) ── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
          />
          <aside className="relative flex flex-col w-64 h-full
                            bg-white dark:bg-gray-900
                            border-r border-gray-200/50 dark:border-white/10">
            <SidebarContent {...sidebarProps} isMobile onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Zone principale ── */}
      <div className={`${mainMargin} flex-1 flex flex-col min-h-screen relative z-10 transition-all duration-200`}>

        {/* ── Top Header ── */}
        <header className="sticky top-0 z-20
                           bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl
                           border-b border-gray-200/50 dark:border-white/10
                           px-5 py-3 flex items-center gap-3">
          {/* Hamburger mobile */}
          <button
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-xl
                       text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menu"
          >
            <Menu size={17} />
          </button>

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-cesizen-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">CZ</span>
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">CESIZen</span>
          </div>

          <div className="flex-1" />

          {/* Toggle Dark / Light */}
          <button
            onClick={toggle}
            aria-label={dark ? 'Activer le mode clair' : 'Activer le mode sombre'}
            className="w-9 h-9 flex items-center justify-center rounded-2xl
                       bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15
                       text-gray-600 dark:text-gray-300 transition"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Avatar → Profil */}
          <Link
            to="/profile"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl
                       hover:bg-gray-100 dark:hover:bg-white/10 transition group"
            aria-label="Mon profil"
          >
            <div className="w-7 h-7 rounded-xl bg-cesizen-100 dark:bg-cesizen-900 flex items-center justify-center">
              <span className="text-xs font-bold text-cesizen-700 dark:text-cesizen-300">{initials}</span>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:inline">
              {user?.prenom}
            </span>
          </Link>
        </header>

        {/* ── Contenu de la page ── */}
        <main className="flex-1 p-5 lg:p-7 pb-24 lg:pb-7">
          {children}
        </main>
      </div>

      {/* ── Bottom Tab Bar (mobile, lg:hidden) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30
                      bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl
                      border-t border-gray-200/50 dark:border-white/10
                      flex items-center justify-around px-2 py-1 safe-bottom">
        {/* eslint-disable-next-line no-unused-vars */}
        {flatNavItems.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-2xl transition ${
              isActive(to)
                ? 'text-cesizen-600 dark:text-cesizen-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
}
