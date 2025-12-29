import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

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

            <style dangerouslySetInnerHTML={{
                __html: `
        .auth-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 80vh;
        }
        
        .auth-card {
          width: 100%;
          max-width: 400px;
          padding: 40px;
        }
        
        .auth-card h2 {
          margin: 0 0 8px;
        }
        
        .auth-subtitle {
          color: var(--text-dim);
          margin-bottom: 32px;
        }
        
        .input-group {
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
        }
        
        .input-group label {
          font-size: 0.9rem;
          margin-bottom: 8px;
          color: var(--text-dim);
        }
        
        .input-group input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color);
          padding: 12px;
          border-radius: 8px;
          color: white;
          outline: none;
          transition: var(--transition-fast);
        }
        
        .input-group input:focus {
          border-color: var(--primary-color);
        }
        
        .btn-primary {
          width: 100%;
          margin-top: 10px;
        }
        
        .auth-toggle {
          margin-top: 24px;
          text-align: center;
          font-size: 0.9rem;
        }
        
        .auth-toggle span {
          color: var(--primary-color);
          cursor: pointer;
          font-weight: 600;
        }
      `}} />
        </div>
    )
}
