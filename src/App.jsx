import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { UserProvider, useUser } from './hooks/useUser'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import ListsPage from './pages/ListsPage'
import DetailPage from './pages/DetailPage'
import LegendsPage from './pages/LegendsPage'
import FunPage from './pages/FunPage'
import StatsPage from './pages/StatsPage'

function AppRoutes() {
  const { currentUser, loading, login } = useUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (currentUser) navigate('/', { replace: true })
  }, [currentUser])

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-float">✨</div>
          <div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  if (!currentUser) return <LoginPage onLogin={login} />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/watchlist/:id" element={<DetailPage />} />
        <Route path="/legends" element={<LegendsPage />} />
        <Route path="/fun" element={<FunPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </BrowserRouter>
  )
}
