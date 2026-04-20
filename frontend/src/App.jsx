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

/** Routes enveloppées par le Layout (sidebar + header). */
function AppLayout({ children }) {
  return <Layout>{children}</Layout>
}

function App() {
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  )
}

export default App
