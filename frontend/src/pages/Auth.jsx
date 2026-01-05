import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // 'login' or 'signup'

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Check your email for the confirmation link!')
      }
    } catch (error) {
      alert(error.error_description || error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="glass auth-card">
        <h2>{mode === 'login' ? 'Iniciar Sesión' : 'Registrarse'}</h2>
        <p className="auth-subtitle">Accede a tu panel de DinoPlatform</p>

        <form onSubmit={handleAuth}>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn-primary" disabled={loading}>
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === 'login' ? (
            <p>¿No tienes cuenta? <span onClick={() => setMode('signup')}>Regístrate</span></p>
          ) : (
            <p>¿Ya tienes cuenta? <span onClick={() => setMode('login')}>Inicia Sesión</span></p>
          )}
        </div>
      </div>


    </div>
  )
}
