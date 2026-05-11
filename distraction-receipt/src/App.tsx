import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { currentMonitor, getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import Onboarding1 from './screens/Onboarding1'
import Onboarding2 from './screens/Onboarding2'
import Onboarding3 from './screens/Onboarding3'
import Onboarding4 from './screens/Onboarding4'
import DailyReceipt from './screens/DailyReceipt'
import WeeklyReceipt from './screens/WeeklyReceipt'
import Settings from './screens/Settings'

type Screen = 'onboarding1' | 'onboarding2' | 'onboarding3' | 'onboarding4' | 'daily' | 'weekly' | 'settings'

type ScreenWindowPreset = {
  width: number
  height: number
}

const screenWindowPresets: Record<Screen, ScreenWindowPreset> = {
  onboarding1: { width: 290, height: 500 },
  onboarding2: { width: 360, height: 640 },
  onboarding3: { width: 300, height: 620 },
  onboarding4: { width: 330, height: 560 },
  daily: { width: 340, height: 640 },
  weekly: { width: 330, height: 600 },
  settings: { width: 340, height: 640 },
}

interface DebugAppUsage {
  name: string
  time_seconds: number
}

interface DebugDailyStats {
  date: string
  apps: DebugAppUsage[]
  alt_tab_count: number
  last_updated: string
}

interface DebugTrackingProbe {
  accessibility_permission: boolean
  can_read_frontmost_app: boolean
  frontmost_app: string | null
  error: string | null
}

/**
 * Distraction Receipt - Main App Component
 * 1:1 pixel-perfect design implementation
 * 360px max-width mobile app container with glassmorphism background
 */
export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding1')
  const [betaOpen, setBetaOpen] = useState(false)
  const [betaStats, setBetaStats] = useState<DebugDailyStats | null>(null)
  const [betaProbe, setBetaProbe] = useState<DebugTrackingProbe | null>(null)
  const [activeTrackedName, setActiveTrackedName] = useState('')
  const isOnboardingScreen = currentScreen.startsWith('onboarding')
  const isDailyScreen = currentScreen === 'daily'
  const canShowBetaPanel = currentScreen === 'daily' || currentScreen === 'weekly' || currentScreen === 'settings'

  const handleNavigate = (screen: Screen) => {
    setCurrentScreen(screen)
  }

  useEffect(() => {
    const unlistenPromise = listen<string>('navigate-to', (event) => {
      const nextScreen = event.payload
      if (nextScreen === 'daily' || nextScreen === 'weekly' || nextScreen === 'settings') {
        setCurrentScreen(nextScreen)
      }
    })

    return () => {
      void unlistenPromise.then((unlisten) => {
        unlisten()
      })
    }
  }, [])

  useEffect(() => {
    let disposed = false

    const applyWindowSizeForScreen = async () => {
      try {
        if (disposed) {
          return
        }

        const preset = screenWindowPresets[currentScreen]
        const monitor = await currentMonitor()
        const scaleFactor = monitor?.scaleFactor ?? 1

        const maxLogicalWidth = monitor?.workArea?.size
          ? Math.max(260, Math.floor(monitor.workArea.size.width / scaleFactor) - 40)
          : preset.width
        const maxLogicalHeight = monitor?.workArea?.size
          ? Math.max(420, Math.floor(monitor.workArea.size.height / scaleFactor) - 60)
          : preset.height

        const targetWidth = Math.min(preset.width, maxLogicalWidth)
        const targetHeight = Math.min(preset.height, maxLogicalHeight)

        const appWindow = getCurrentWindow()
        const targetSize = new LogicalSize(targetWidth, targetHeight)

        await appWindow.setResizable(false)
        await appWindow.setMaximizable(false)
        await appWindow.setMinSize(targetSize)
        await appWindow.setMaxSize(targetSize)
        await appWindow.setSize(targetSize)
        await appWindow.center()
      } catch (error) {
        console.error('Nie udało się dopasować rozmiaru okna:', error)
      }
    }

    void applyWindowSizeForScreen()
    const retryOne = window.setTimeout(() => {
      void applyWindowSizeForScreen()
    }, 120)
    const retryTwo = window.setTimeout(() => {
      void applyWindowSizeForScreen()
    }, 360)

    return () => {
      disposed = true
      clearTimeout(retryOne)
      clearTimeout(retryTwo)
    }
  }, [currentScreen])

  useEffect(() => {
    if (!betaOpen || !canShowBetaPanel) {
      return
    }

    const fetchBetaStats = async () => {
      try {
        const [stats, probe] = await Promise.all([
          invoke<DebugDailyStats>('get_daily_stats'),
          invoke<DebugTrackingProbe>('get_tracking_probe'),
        ])
        setBetaStats(stats)
        setBetaProbe(probe)
      } catch (error) {
        console.error('Błąd pobierania podglądu beta:', error)
      }
    }

    void fetchBetaStats()
    const interval = window.setInterval(() => {
      void fetchBetaStats()
    }, 2000)

    const unlistenPromise = listen<string>('app-switched', (event) => {
      setActiveTrackedName(event.payload ?? '')
      void fetchBetaStats()
    })

    return () => {
      clearInterval(interval)
      void unlistenPromise.then((unlisten) => {
        unlisten()
      })
    }
  }, [betaOpen, canShowBetaPanel])

  const betaApps = [...(betaStats?.apps ?? [])].sort((a, b) => b.time_seconds - a.time_seconds)

  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center antialiased ${isDailyScreen || isOnboardingScreen ? 'p-0' : 'p-4'}`}
      style={{ backgroundColor: '#fbfaf5' }}
    >
      {/* Fixed Background - Blur effect behind glass shell (hide for onboarding1 to show only the card) */}
      {currentScreen !== 'onboarding1' && !isDailyScreen && !isOnboardingScreen && (
        <div className="fixed inset-0 bg-surface-variant/80 backdrop-blur-3xl z-0"></div>
      )}

      {/* App Container */}
      <div className="relative z-10 w-full h-full">
        {currentScreen === 'onboarding1' && <Onboarding1 onNext={() => handleNavigate('onboarding2')} />}
        {currentScreen === 'onboarding2' && <Onboarding2 onNext={() => handleNavigate('onboarding3')} />}
        {currentScreen === 'onboarding3' && <Onboarding3 onNext={() => handleNavigate('onboarding4')} />}
        {currentScreen === 'onboarding4' && <Onboarding4 onFinish={() => handleNavigate('daily')} onBack={() => handleNavigate('onboarding3')} />}
        {currentScreen === 'daily' && <DailyReceipt onNavigate={handleNavigate} />}
        {currentScreen === 'weekly' && <WeeklyReceipt onNavigate={handleNavigate} />}
        {currentScreen === 'settings' && <Settings onNavigate={handleNavigate} />}
      </div>

      {canShowBetaPanel && (
        <div style={{ position: 'fixed', right: 14, bottom: 14, zIndex: 70 }}>
          <button
            onClick={() => setBetaOpen((value) => !value)}
            style={{
              background: '#1e1e1e',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '8px 12px',
              fontSize: 11,
              fontFamily: 'Courier Prime, monospace',
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            {betaOpen ? 'UKRYJ BETA' : 'POKAŻ BETA'}
          </button>

          {betaOpen && (
            <div
              style={{
                marginTop: 8,
                width: 320,
                maxHeight: 340,
                overflowY: 'auto',
                background: '#fbfaf5',
                border: '1px dashed #bdb9b2',
                borderRadius: 6,
                padding: 12,
                boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
                color: '#1c1b1b',
                fontFamily: 'Courier Prime, monospace',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', marginBottom: 8 }}>
                PODGLĄD BETA
              </div>
              <div style={{ fontSize: 10, marginBottom: 4 }}>
                Aktywne: {activeTrackedName || '—'}
              </div>
              <div style={{ fontSize: 10, marginBottom: 10 }}>
                Alt-Tab: {betaStats?.alt_tab_count ?? 0}
              </div>
              <div style={{ fontSize: 10, marginBottom: 4 }}>
                Accessibility: {betaProbe?.accessibility_permission ? 'OK' : 'NIE'}
              </div>
              <div style={{ fontSize: 10, marginBottom: 8 }}>
                Odczyt front app: {betaProbe?.can_read_frontmost_app ? 'OK' : 'NIE'}
              </div>
              {betaProbe?.frontmost_app && (
                <div style={{ fontSize: 10, marginBottom: 8 }}>
                  Front app: {betaProbe.frontmost_app}
                </div>
              )}
              {betaProbe?.error && (
                <div style={{ fontSize: 10, marginBottom: 8, color: '#8a3c3c' }}>
                  {betaProbe.error}
                </div>
              )}
              {betaApps.length === 0 && (
                <div style={{ fontSize: 10, color: '#666' }}>
                  Brak danych jeszcze.
                </div>
              )}
              {betaApps.map((entry, index) => (
                <div
                  key={`${entry.name}-${index}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 10,
                    padding: '4px 0',
                    borderTop: index === 0 ? '1px dashed #ddd8d1' : undefined,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.name}
                  </span>
                  <span>{entry.time_seconds}s</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
