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
import AdminDashboard from './pages/AdminDashboard'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        setLoading(false)
        setUserRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Global Theme & Role Fetcher
  useEffect(() => {
    // 1. Try to load from local storage immediately for speed
    const cachedColor = localStorage.getItem('brand_color')
    if (cachedColor) {
      document.documentElement.style.setProperty('--primary-color', cachedColor)
      document.documentElement.style.setProperty('--primary-glow', cachedColor + '66')
    }

    if (session?.user) {
      const initUser = async () => {
        try {
          // Fetch fresh color and role
          const { data: profile, error } = await supabase.from('profiles').select('tenant_id, role').eq('id', session.user.id).maybeSingle()

          if (error) {
            console.error('Error fetching profile:', error)
          } else if (profile) {
            setUserRole(profile.role || 'admin')

            if (profile.tenant_id) {
              const { data: tenant } = await supabase.from('tenants').select('brand_color').eq('id', profile.tenant_id).maybeSingle()
              if (tenant?.brand_color) {
                const root = document.documentElement
                root.style.setProperty('--primary-color', tenant.brand_color)
                root.style.setProperty('--primary-glow', tenant.brand_color + '66')
                localStorage.setItem('brand_color', tenant.brand_color)
              }
            }
          }
        } catch (err) {
          console.error('Critical init error:', err)
        } finally {
          setLoading(false)
        }
      }
      initUser()
    }
  }, [session])

  if (loading) return null

  return (
    <Router>
      <div className="layout">
        <main className="container">
          <Routes>
            <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" />} />

            {/* Admin Route */}
            <Route path="/admin" element={session && userRole === 'super_admin' ? <AdminDashboard session={session} /> : <Navigate to="/" />} />

            {/* Standard Routes */}
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
