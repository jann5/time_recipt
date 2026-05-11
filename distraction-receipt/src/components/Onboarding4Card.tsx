import { useState } from 'react'

interface Onboarding4CardProps {
  onFinish?: () => void
  onBack?: () => void
}

export default function Onboarding4Card({ onFinish, onBack }: Onboarding4CardProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoginMode, setIsLoginMode] = useState(false)

  const validateForm = () => {
    if (!email.includes('@')) {
      setError('Email musi zawierać @')
      return false
    }
    if (password.length < 8) {
      setError('Hasło musi mieć minimum 8 znaków')
      return false
    }
    setError('')
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onFinish && onFinish()
    }
  }

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode)
    setError('')
    setEmail('')
    setPassword('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div
        role="dialog"
        aria-label="Onboarding card step 4"
        className="flex-shrink-0"
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: '0',
          minHeight: '430px',
          background: '#fbfaf5',
          borderRadius: 8,
          boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: 44,
          paddingBottom: 32,
          paddingLeft: 28,
          paddingRight: 28,
          color: '#1c1b1b',
          fontFamily: "Courier Prime, monospace",
        }}
      >
        {/* Top area: step + title */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.28em',
              marginBottom: 18,
            }}
          >
            KROK 4/4
          </div>

          <h1
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.12em',
              margin: '0 auto 16px',
              maxWidth: 300,
              lineHeight: 1.15,
              textTransform: 'uppercase',
            }}
          >
            {isLoginMode ? 'ZALOGUJ SIĘ' : 'DOŁĄCZ DO KOLEJKI'}
          </h1>
          
          <p
            style={{
              fontSize: 11,
              lineHeight: 1.6,
              color: '#1c1b1b',
              maxWidth: '280px',
              margin: '0 auto',
            }}
          >
            Synchronizuj swoje streaki i rywalizuj ze znajomymi na najbardziej produktywne paragony.
          </p>
        </div>

        {/* Form - description style */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 32 }}>
            {/* Email Input */}
            <div>
              <input
                type="email"
                placeholder="adres@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px dashed #c4c4c4',
                  padding: '12px 0',
                  fontFamily: "Courier Prime, monospace",
                  fontSize: 12,
                  color: '#1c1b1b',
                  outline: 'none',
                }}
              />
            </div>

            {/* Password Input */}
            <div>
              <input
                type="password"
                placeholder="Hasło"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px dashed #c4c4c4',
                  padding: '12px 0',
                  fontFamily: "Courier Prime, monospace",
                  fontSize: 12,
                  color: '#1c1b1b',
                  outline: 'none',
                }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div style={{ 
                fontSize: 10, 
                color: '#d32f2f', 
                marginTop: 4,
                textAlign: 'center',
              }}>
                {error}
              </div>
            )}

            {/* Login/Register Link */}
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button
                type="button"
                onClick={toggleMode}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1c1b1b',
                  cursor: 'pointer',
                  fontFamily: "Courier Prime, monospace",
                  fontSize: 11,
                  letterSpacing: '0.05em',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dashed',
                }}
              >
                {isLoginMode ? 'Zarejestruj się zamiast tego' : 'Zaloguj się zamiast tego'}
              </button>
            </div>
          </form>
        </div>

        {/* Bottom buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', gap: 16 }}>
          <button
            onClick={handleSubmit}
            style={{
              background: '#1e1e1e',
              color: '#fff',
              padding: '14px 24px',
              width: '78%',
              maxWidth: 320,
              borderRadius: 2,
              fontFamily: "Courier Prime, monospace",
              fontSize: 13,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span>ZACZNIJ DRUKOWAĆ</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
              <path d="M6 14h12v8H6z"/>
            </svg>
          </button>
          
          <button
            onClick={() => onBack && onBack()}
            style={{
              background: 'none',
              border: 'none',
              color: '#1c1b1b',
              padding: '8px 24px',
              width: '100%',
              fontFamily: "Courier Prime, monospace",
              fontSize: 13,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            WSTECZ
          </button>
        </div>
      </div>
    </div>
  )
}
