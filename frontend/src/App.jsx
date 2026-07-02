import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Layout           from './components/Layout'
import Login            from './pages/Login'
import Register         from './pages/Register'
import Insights         from './pages/Insights'
import MoodEntry        from './pages/MoodEntry'
import AdminDashboard   from './pages/AdminDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import Profile          from './pages/Profile'
import Articles         from './pages/Articles'

const V2_BANNER = (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
    background: '#dc2626', color: '#fff', textAlign: 'center',
    padding: '6px 0', fontWeight: 700, fontSize: '14px',
    letterSpacing: '0.05em', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  }}>
    🔴 VERSION 2 — Nouveau déploiement Blue/Green actif
  </div>
)

/** Routes enveloppées par le Layout (sidebar + header). */
function AppLayout({ children }) {
  return <Layout>{children}</Layout>
}

function App() {
  return (
    <ThemeProvider>
      {V2_BANNER}
      <div style={{ paddingTop: '32px' }}>
      <Routes>
        {/* Pages standalone (sans Layout) */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Pages authentifiées — enveloppées par le Layout */}
        <Route path="/dashboard"        element={<AppLayout><Insights /></AppLayout>} />
        <Route path="/track"            element={<AppLayout><MoodEntry /></AppLayout>} />
        <Route path="/articles"         element={<AppLayout><Articles /></AppLayout>} />
        <Route path="/admin"            element={<AppLayout><AdminDashboard /></AppLayout>} />
        <Route path="/manager"          element={<AppLayout><ManagerDashboard /></AppLayout>} />
        <Route path="/profile"          element={<AppLayout><Profile /></AppLayout>} />

        {/* Redirection par défaut */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </div>
    </ThemeProvider>
  )
}

export default App
