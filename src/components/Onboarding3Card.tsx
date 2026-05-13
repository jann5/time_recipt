import { type TouchEvent, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { AppLanguage } from '../i18n'

interface Onboarding3CardProps {
  onNext?: () => void
  language: AppLanguage
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
  language: AppLanguage
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

export default function Onboarding3Card({ onNext, language }: Onboarding3CardProps) {
  const isEnglish = language === 'en'
  const copy = {
    loadSettingsError: isEnglish
      ? 'Could not load onboarding settings:'
      : 'Nie udało się wczytać ustawień onboarding:',
    saveSettingsError: isEnglish
      ? 'Could not save onboarding settings:'
      : 'Nie udało się zapisać ustawień onboarding:',
    saveErrorText: isEnglish
      ? 'Could not save settings. Try again.'
      : 'Nie udało się zapisać ustawień. Spróbuj ponownie.',
  }
  const [hour, setHour] = useState(22)
  const [minute, setMinute] = useState(0)
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const holdTimeoutRef = useRef<number | null>(null)
  const holdIntervalRef = useRef<number | null>(null)
  const lastTickMsRef = useRef(0)

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
        console.error(copy.loadSettingsError, error)
      }
    }

    void loadSavedSettings()

    return () => {
      disposed = true
      if (holdTimeoutRef.current !== null) {
        window.clearTimeout(holdTimeoutRef.current)
        holdTimeoutRef.current = null
      }
      if (holdIntervalRef.current !== null) {
        window.clearInterval(holdIntervalRef.current)
        holdIntervalRef.current = null
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [])

  const playTick = () => {
    try {
      const ContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!ContextCtor) {
        return
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new ContextCtor()
      }

      const ctx = audioContextRef.current
      if (!ctx) {
        return
      }

      if (ctx.state === 'suspended') {
        void ctx.resume()
      }

      const nowMs = Date.now()
      if (nowMs - lastTickMsRef.current < 25) {
        return
      }
      lastTickMsRef.current = nowMs

      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(1680, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.018, now + 0.003)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.042)
    } catch {
      // Ignore audio errors; picker should still work.
    }
  }

  const clearHold = () => {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
  }

  const startHold = (action: () => void) => {
    clearHold()
    action()

    holdTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        action()
      }, 85)
    }, 260)
  }

  const shiftHour = (delta: number) => {
    setHour((prev) => {
      const next = (prev + delta + 24) % 24
      return next
    })
    playTick()
  }

  const shiftMinute = (delta: number) => {
    setMinute((prev) => {
      const next = (prev + delta + 60) % 60
      return next
    })
    playTick()
  }

  const holdButtonHandlers = (action: () => void) => ({
    onMouseDown: () => startHold(action),
    onMouseUp: clearHold,
    onMouseLeave: clearHold,
    onTouchStart: (event: TouchEvent<HTMLButtonElement>) => {
      event.preventDefault()
      startHold(action)
    },
    onTouchEnd: clearHold,
    onTouchCancel: clearHold,
  })

  const handleNext = async () => {
    setIsSaving(true)
    setSaveError('')

    try {
      const settings = await invoke<UserSettings>('get_settings')
      const dailyReportTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`

      await invoke('update_settings', {
        newSettings: {
          ...settings,
          daily_report_time: dailyReportTime,
        },
      })

      onNext && onNext()
    } catch (error) {
      console.error(copy.saveSettingsError, error)
      setSaveError(copy.saveErrorText)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="h-full w-full">
      <div
        role="dialog"
        aria-label="Onboarding card step 4"
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
          fontFamily: 'Courier Prime, monospace',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.28em',
              marginBottom: 18,
            }}
          >
            {isEnglish ? 'STEP 4/4' : 'KROK 4/4'}
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
            {isEnglish ? 'REPORT TIME' : 'GODZINA WYDRUKU'}
          </h1>

          <p
            style={{
              fontSize: 11,
              lineHeight: 1.45,
              color: '#1c1b1b',
              marginBottom: 20,
            }}
          >
            {isEnglish ? (
              <>
                Set your daily summary time.
                <br />
                Hold arrows to scroll faster.
              </>
            ) : (
              <>
                Ustaw godzinę codziennego podsumowania.
                <br />
                Możesz przytrzymać strzałkę, żeby przewijać szybciej.
              </>
            )}
          </p>

          <div style={{ borderTop: '1px dashed #c4c4c4', marginBottom: 20 }} />
        </div>

        <div style={{ marginBottom: 10 }}>
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
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            {isEnglish ? 'REPORT TIME' : 'CZAS RAPORTU'}
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: 4,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                type="button"
                aria-label={isEnglish ? 'Increase hour' : 'Zwiększ godzinę'}
                {...holdButtonHandlers(() => shiftHour(1))}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: '#777',
                  padding: '4px 8px',
                }}
              >
                ▲
              </button>
              <span style={{ fontSize: 28, fontWeight: 400, letterSpacing: '0.1em', minWidth: 42, textAlign: 'center' }}>
                {hour.toString().padStart(2, '0')}
              </span>
              <button
                type="button"
                aria-label={isEnglish ? 'Decrease hour' : 'Zmniejsz godzinę'}
                {...holdButtonHandlers(() => shiftHour(-1))}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: '#777',
                  padding: '4px 8px',
                }}
              >
                ▼
              </button>
            </div>

            <span style={{ fontSize: 28, fontWeight: 400, marginBottom: 4 }}>:</span>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                type="button"
                aria-label={isEnglish ? 'Increase minutes' : 'Zwiększ minuty'}
                {...holdButtonHandlers(() => shiftMinute(1))}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: '#777',
                  padding: '4px 8px',
                }}
              >
                ▲
              </button>
              <span style={{ fontSize: 28, fontWeight: 400, letterSpacing: '0.1em', minWidth: 42, textAlign: 'center' }}>
                {minute.toString().padStart(2, '0')}
              </span>
              <button
                type="button"
                aria-label={isEnglish ? 'Decrease minutes' : 'Zmniejsz minuty'}
                {...holdButtonHandlers(() => shiftMinute(-1))}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: '#777',
                  padding: '4px 8px',
                }}
              >
                ▼
              </button>
            </div>
          </div>
        </div>

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
              fontFamily: 'Courier Prime, monospace',
              fontSize: 13,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: isSaving ? 'default' : 'pointer',
              opacity: isSaving ? 0.85 : 1,
            }}
          >
            {isSaving ? (isEnglish ? 'SAVING...' : 'ZAPISYWANIE...') : isEnglish ? 'START' : 'ZACZNIJ'}
          </button>
        </div>
      </div>
    </div>
  )
}
