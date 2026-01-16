import React, { useEffect, useState, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { syncFromSupabase, processSyncQueue } from './lib/sync' // Import sync
import LoadingSpinner from './components/ui/LoadingSpinner'
import SyncIndicator from './components/ui/SyncIndicator'

// Lazy Load Pages to optimize initial bundle (Fase 1 Audit)
const Auth = React.lazy(() => import('./pages/Auth'))
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Machines = React.lazy(() => import('./pages/Machines'))
const RoutePlanner = React.lazy(() => import('./pages/RoutePlanner'))
const Collections = React.lazy(() => import('./pages/Collections'))
const PublicReport = React.lazy(() => import('./pages/PublicReport'))
const Reports = React.lazy(() => import('./pages/Reports'))
const Refills = React.lazy(() => import('./pages/Refills'))
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'))

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)
  const [isDownloading, setIsDownloading] = useState(false) // New Global State

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

  // GLobal Sync Trigger (Download + Queue Processing)
  const handleGlobalSync = async () => {
    if (!session) return;
    try {
      if (navigator.onLine) {
        setIsDownloading(true); // Show "Downloading" UI
        await syncFromSupabase(); // Download fresh data
        await processSyncQueue(); // Upload pending data
      }
    } catch (e) {
      console.error("Global sync failed:", e)
    } finally {
      setIsDownloading(false);
    }
  }

  // Initial Sync on Load
  useEffect(() => {
    if (session) {
      handleGlobalSync();
    }
  }, [session]);

  // Sync on Reconnect
  useEffect(() => {
    const handleOnline = () => handleGlobalSync();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [session]); // Re-bind if session changes

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
          {/* Pass Global Downloading State */}
          <SyncIndicator isDownloading={isDownloading} />
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" />} />

              {/* Admin Route */}
              <Route path="/admin" element={session && userRole === 'super_admin' ? <AdminDashboard session={session} /> : <Navigate to="/" />} />

              {/* Standard Routes */}
              <Route path="/" element={session ? <Dashboard isSuperAdmin={userRole === 'super_admin'} /> : <Navigate to="/auth" />} />
              <Route path="/machines" element={session ? <Machines /> : <Navigate to="/auth" />} />
              <Route path="/routes" element={session ? <RoutePlanner /> : <Navigate to="/auth" />} />
              <Route path="/collections" element={session ? <Collections /> : <Navigate to="/auth" />} />
              <Route path="/reports" element={session ? <Reports /> : <Navigate to="/auth" />} />
              <Route path="/refills" element={session ? <Refills /> : <Navigate to="/auth" />} />
              <Route path="/report/:uid" element={<PublicReport />} />
            </Routes>
          </Suspense>
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
