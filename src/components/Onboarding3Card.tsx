import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface Onboarding3CardProps {
  onNext?: () => void
}

interface BrowserRule {
  pattern: string
  label: string
  category: 'productive' | 'distraction'
  browsers: string[]
}

interface UserSettings {
  distraction_apps: string[]
  work_apps: string[]
  browser_rules: BrowserRule[]
  daily_report_time: string
  notifications_enabled: boolean
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) {
    return null
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  }
}

export default function Onboarding3Card({ onNext }: Onboarding3CardProps) {
  const [hour, setHour] = useState(22)
  const [minute, setMinute] = useState(0)
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [distractions, setDistractions] = useState<Record<string, boolean>>(() => {
    // Load saved distractions from localStorage
    const saved = localStorage.getItem('distractions')
    if (saved) {
      const parsed = JSON.parse(saved) as unknown
      if (parsed && typeof parsed === 'object') {
        const entries = Object.entries(parsed as Record<string, unknown>)
          .filter(([key, value]) => key.trim().length > 0 && typeof value === 'boolean')
          .map(([key, value]) => [key, value as boolean] as const)
        if (entries.length > 0) {
          return Object.fromEntries(entries)
        }
      }
    }
    return {
      YouTube: true,
      Facebook: true,
      Netflix: false,
      Instagram: false,
      TikTok: false,
    }
  })

  useEffect(() => {
    let disposed = false

    const loadSavedSettings = async () => {
      try {
        const settings = await invoke<UserSettings>('get_settings')
        const parsedTime = parseTime(settings.daily_report_time)
        if (!disposed && parsedTime) {
          setHour(parsedTime.hour)
          setMinute(parsedTime.minute)
        }
      } catch (error) {
        console.error('Nie udało się wczytać ustawień onboarding:', error)
      }
    }

    void loadSavedSettings()

    return () => {
      disposed = true
    }
  }, [])

  // Save to localStorage whenever distractions change
  const updateDistractions = (newDistractions: Record<string, boolean>) => {
    setDistractions(newDistractions)
    localStorage.setItem('distractions', JSON.stringify(newDistractions))
  }


  const toggleDistraction = (name: string) => {
    const newDistractions = { ...distractions, [name]: !distractions[name as keyof typeof distractions] }
    updateDistractions(newDistractions)
  }

  const incrementHour = () => setHour(h => (h + 1) % 24)
  const decrementHour = () => setHour(h => (h - 1 + 24) % 24)
  const incrementMinute = () => setMinute(m => (m + 1) % 60)
  const decrementMinute = () => setMinute(m => (m - 1 + 60) % 60)

  const handleNext = async () => {
    setIsSaving(true)
    setSaveError('')

    try {
      const settings = await invoke<UserSettings>('get_settings')
      const dailyReportTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      const selectedDistractions = Object.entries(distractions)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name.trim())
        .filter((name) => name.length > 0)

      await invoke('update_settings', {
        newSettings: {
          ...settings,
          daily_report_time: dailyReportTime,
          distraction_apps: selectedDistractions,
        },
      })

      onNext && onNext()
    } catch (error) {
      console.error('Nie udało się zapisać ustawień onboarding:', error)
      setSaveError('Nie udało się zapisać ustawień. Spróbuj ponownie.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="h-full w-full">
      <div
        role="dialog"
        aria-label="Onboarding card step 3"
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
          overflowY: 'auto',
          paddingTop: 34,
          paddingBottom: 24,
          paddingLeft: 24,
          paddingRight: 24,
          color: '#1c1b1b',
          fontFamily: "Courier Prime, monospace",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.28em',
              marginBottom: 18,
            }}
          >
            KROK 3/3
          </div>

          <h1
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.12em',
              margin: '0 0 8px 0',
              textTransform: 'uppercase',
            }}
          >
            TWÓJ ROZKŁAD DNIA
          </h1>
          
          <p
            style={{
              fontSize: 11,
              lineHeight: 1.45,
              color: '#1c1b1b',
              marginBottom: 20,
            }}
          >
            Ty decydujesz, co jest rozproszeniem.
            <br />
            Dane zostają lokalnie — tylko Ty masz do nich dostęp.
          </p>
          
          {/* Dashed line separator */}
          <div style={{ borderTop: '1px dashed #c4c4c4', marginBottom: 20 }} />
        </div>

        {/* Time Picker Section */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.15em',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            GODZINA WYDRUKU
          </div>
          
          <div
            style={{
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: 4,
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {/* Hour */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                onClick={incrementHour}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: '#999',
                  padding: '4px 8px',
                }}
              >
                ▲
              </button>
              <span style={{ fontSize: 28, fontWeight: 400, letterSpacing: '0.1em' }}>
                {hour.toString().padStart(2, '0')}
              </span>
              <button
                onClick={decrementHour}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: '#999',
                  padding: '4px 8px',
                }}
              >
                ▼
              </button>
            </div>
            
            {/* Colon */}
            <span style={{ fontSize: 28, fontWeight: 400, marginBottom: 4 }}>:</span>
            
            {/* Minute */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                onClick={incrementMinute}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: '#999',
                  padding: '4px 8px',
                }}
              >
                ▲
              </button>
              <span style={{ fontSize: 28, fontWeight: 400, letterSpacing: '0.1em' }}>
                {minute.toString().padStart(2, '0')}
              </span>
              <button
                onClick={decrementMinute}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: '#999',
                  padding: '4px 8px',
                }}
              >
                ▼
              </button>
            </div>
          </div>
        </div>

        {/* Dashed line separator */}
        <div style={{ borderTop: '1px dashed #c4c4c4', marginBottom: 20 }} />

        {/* Distractions Section */}
        <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
          <style>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.15em',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            ZAZNACZ ROZPRASZACZE
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(distractions).map(([name, checked]) => (
              <label
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: 12,
                  paddingBottom: 8,
                  borderBottom: '1px dashed #e0e0e0',
                }}
              >
                <span>{name}</span>
                <div
                  onClick={() => toggleDistraction(name)}
                  style={{
                    width: 16,
                    height: 16,
                    border: '1px solid #1c1b1b',
                    background: checked ? '#1c1b1b' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  )}
                </div>
              </label>
            ))}
          </div>
          
          <button
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.webkitdirectory = false
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files
                if (files && files.length > 0) {
                  const file = files[0]
                  // Extract app name from filename (remove .app, .exe, .dmg, .pkg, .zip, etc.)
                  const appName = file.name.replace(/(\.app)?\.zip$/i, '').replace(/\.app$/i, '').replace(/\.exe$/i, '').replace(/\.dmg$/i, '').replace(/\.pkg$/i, '')
                  // Add to distractions state
                  const newDistractions = { ...distractions, [appName]: true }
                  updateDistractions(newDistractions)
                }
              }
              input.click()
            }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 11,
              color: '#1c1b1b',
              cursor: 'pointer',
              marginTop: 16,
              fontFamily: "Courier Prime, monospace",
              fontStyle: 'italic',
            }}
          >
            + Dodaj własną aplikację
          </button>
        </div>

        {/* Button */}
        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          {saveError && (
            <div
              style={{
                fontSize: 10,
                color: '#8a3c3c',
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              {saveError}
            </div>
          )}

          <button
            onClick={() => void handleNext()}
            disabled={isSaving}
            style={{
              background: '#1e1e1e',
              color: '#fff',
              padding: '14px 24px',
              width: '100%',
              borderRadius: 2,
              fontFamily: "Courier Prime, monospace",
              fontSize: 13,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: isSaving ? 'default' : 'pointer',
              opacity: isSaving ? 0.85 : 1,
            }}
          >
            {isSaving ? 'ZAPISYWANIE...' : 'ZACZNIJ'}
          </button>
        </div>
      </div>
    </div>
  )
}
