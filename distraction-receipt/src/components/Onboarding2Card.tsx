import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'

interface Onboarding2CardProps {
  onNext?: () => void
}

export default function Onboarding2Card({ onNext }: Onboarding2CardProps) {
  const [status, setStatus] = useState<string>('')
  const [hasAccessibilityPermission, setHasAccessibilityPermission] = useState(false)

  const refreshPermissions = async () => {
    try {
      const hasPermission = await invoke<boolean>('check_macos_permissions')
      setHasAccessibilityPermission(hasPermission)
      setStatus((previous) => {
        if (hasPermission) {
          return 'Uprawnienia przyznane.'
        }
        if (previous === 'Uprawnienia przyznane.') {
          return ''
        }
        return previous
      })
    } catch (error) {
      console.error('Błąd:', error)
    }
  }

  useEffect(() => {
    void refreshPermissions()

    const interval = window.setInterval(() => {
      void refreshPermissions()
    }, 1500)

    const handleFocus = () => {
      void refreshPermissions()
    }
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void refreshPermissions()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const handleRequestPermissions = async () => {
    try {
      setStatus('Sprawdzam uprawnienia...')
      const hasPermission = await invoke<boolean>('request_macos_permissions', {
        openSettings: true,
      })
      if (hasPermission) {
        setHasAccessibilityPermission(true)
        setStatus('Uprawnienia przyznane.')
      } else {
        setHasAccessibilityPermission(false)
        setStatus('Czekam na nadanie uprawnienia Accessibility.')
        window.setTimeout(() => {
          void refreshPermissions()
        }, 1200)
        window.setTimeout(() => {
          void refreshPermissions()
        }, 2800)
      }
    } catch (error) {
      console.error('Błąd:', error)
      setHasAccessibilityPermission(false)
      setStatus('Nie udało się sprawdzić uprawnień. Spróbuj ponownie.')
    }
  }

  const handleRestartApp = async () => {
    try {
      await invoke('restart_app')
    } catch (error) {
      console.error('Błąd restartu aplikacji:', error)
    }
  }

  return (
    <div className="h-full w-full">
      <div
        role="dialog"
        aria-label="Onboarding card step 2"
        className="flex-shrink-0 h-full w-full"
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: '0',
          minHeight: '100%',
          height: '100%',
          background: '#fbfaf5',
          borderRadius: 0,
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          overflowY: 'auto',
          paddingTop: 34,
          paddingBottom: 24,
          paddingLeft: 24,
          paddingRight: 24,
          color: '#1c1b1b',
          fontFamily: 'Courier Prime, monospace',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.28em',
              marginBottom: 18,
            }}
          >
            KROK 2/3
          </div>

          <h1
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.12em',
              margin: '0 auto 22px',
              maxWidth: 300,
              lineHeight: 1.15,
              textTransform: 'uppercase',
            }}
          >
            JAK TO DZIAŁA?
          </h1>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <rect x="8" y="12" width="48" height="36" rx="3" stroke="#1c1b1b" strokeWidth="2.5"/>
            <path d="M28 48L28 52" stroke="#1c1b1b" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M20 52H44" stroke="#1c1b1b" strokeWidth="2.5" strokeLinecap="round"/>
            <path
              d="M32 20C32 20 24 22 24 28C24 36 32 42 32 42C32 42 40 36 40 28C40 22 32 20 32 20Z"
              stroke="#1c1b1b"
              strokeWidth="2.5"
              fill="none"
            />
          </svg>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontSize: 11,
              lineHeight: 1.45,
              maxWidth: 380,
              margin: '24px auto 0',
              color: '#1c1b1b',
            }}
          >
            Pokazujemy, jak wykorzystujesz czas w aplikacjach i przeglądarce.
            <br />
            Twoje dane zostają lokalnie na Twoim Macu — nikt poza Tobą nie ma do nich wglądu.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 20 }}>
          <button
            onClick={handleRequestPermissions}
            style={{
              background: '#1e1e1e',
              color: '#fff',
              padding: '14px 24px',
              width: '78%',
              maxWidth: 320,
              borderRadius: 2,
              fontFamily: 'Courier Prime, monospace',
              fontSize: 13,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
              lineHeight: 1.4,
            }}
          >
            PRZYZNAJ UPRAWNIENIA<br/>MACOS {'->'}
          </button>

          <button
            onClick={() => onNext && onNext()}
            disabled={!hasAccessibilityPermission}
            style={{
              background: hasAccessibilityPermission ? '#1e1e1e' : '#ece8e2',
              color: hasAccessibilityPermission ? '#fff' : '#8e8a84',
              padding: '10px 24px',
              width: '78%',
              maxWidth: 320,
              borderRadius: 2,
              fontFamily: 'Courier Prime, monospace',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: hasAccessibilityPermission ? 'pointer' : 'not-allowed',
              lineHeight: 1.3,
            }}
          >
            DALEJ
          </button>

          {status && (
            <div style={{ fontSize: 10, color: '#666', textAlign: 'center', maxWidth: 320 }}>
              {status}
            </div>
          )}

          {!hasAccessibilityPermission && (
            <button
              onClick={handleRestartApp}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                fontFamily: 'Courier Prime, monospace',
                fontSize: 10,
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
                padding: 0,
              }}
            >
              Mam włączone → uruchom aplikację ponownie
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
