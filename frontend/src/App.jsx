import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Machines from './pages/Machines'
import RoutePlanner from './pages/RoutePlanner'
import Collections from './pages/Collections'
import PublicReport from './pages/PublicReport'
import Reports from './pages/Reports'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Global Theme Fetcher
  useEffect(() => {
    if (session?.user) {
      const applyTheme = async () => {
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single()
        if (profile?.tenant_id) {
          const { data: tenant } = await supabase.from('tenants').select('brand_color').eq('id', profile.tenant_id).single()
          if (tenant?.brand_color) {
            const root = document.documentElement
            root.style.setProperty('--primary-color', tenant.brand_color)
            root.style.setProperty('--primary-glow', tenant.brand_color + '66')
          }
        }
      }
      applyTheme()
    }
  }, [session])

  if (loading) return null

  return (
    <Router>
      <div className="layout">
        <main className="container">
          <Routes>
            <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" />} />
            <Route path="/" element={session ? <Dashboard /> : <Navigate to="/auth" />} />
            <Route path="/machines" element={session ? <Machines /> : <Navigate to="/auth" />} />
            <Route path="/routes" element={session ? <RoutePlanner /> : <Navigate to="/auth" />} />
            <Route path="/collections" element={session ? <Collections /> : <Navigate to="/auth" />} />
            <Route path="/reports" element={session ? <Reports /> : <Navigate to="/auth" />} />
            <Route path="/report/:uid" element={<PublicReport />} />
          </Routes>
        </main>
      </div>

      <style>{`
        .layout {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
        }
      `}</style>
    </Router>
  )
}

export default App
