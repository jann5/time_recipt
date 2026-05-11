import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { currentMonitor, getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import Onboarding1 from './screens/Onboarding1'
import Onboarding2 from './screens/Onboarding2'
import Onboarding3 from './screens/Onboarding3'
import DailyReceipt from './screens/DailyReceipt'
import WeeklyReceipt from './screens/WeeklyReceipt'
import Settings from './screens/Settings'

type Screen = 'onboarding1' | 'onboarding2' | 'onboarding3' | 'daily' | 'weekly' | 'settings'

type ScreenWindowPreset = {
  width: number
  height: number
}

const ONBOARDING_COMPLETED_KEY = 'distraction-receipt:onboarding-completed'

const screenWindowPresets: Record<Screen, ScreenWindowPreset> = {
  onboarding1: { width: 330, height: 680 },
  onboarding2: { width: 340, height: 760 },
  onboarding3: { width: 350, height: 860 },
  daily: { width: 390, height: 860 },
  weekly: { width: 380, height: 780 },
  settings: { width: 390, height: 880 },
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
  const [currentScreen, setCurrentScreen] = useState<Screen>(
    localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true' ? 'daily' : 'onboarding1',
  )
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null)
  const [readyReceiptDate, setReadyReceiptDate] = useState<string | null>(null)
  const [readyReceiptToConfirm, setReadyReceiptToConfirm] = useState<string | null>(null)
  const [reportReadyOverlayOpen, setReportReadyOverlayOpen] = useState(false)
  const [betaOpen, setBetaOpen] = useState(false)
  const [betaStats, setBetaStats] = useState<DebugDailyStats | null>(null)
  const [betaProbe, setBetaProbe] = useState<DebugTrackingProbe | null>(null)
  const [activeTrackedName, setActiveTrackedName] = useState('')
  const isOnboardingScreen = currentScreen.startsWith('onboarding')
  const isDailyScreen = currentScreen === 'daily'
  const canShowBetaPanel = currentScreen === 'daily' || currentScreen === 'weekly' || currentScreen === 'settings'

  const handleNavigate = (screen: Screen) => {
    setSelectedHistoryDate(null)
    setCurrentScreen(screen)
  }

  const handleOpenHistoryDay = (date: string) => {
    setSelectedHistoryDate(date)
    setCurrentScreen('daily')
  }

  const handleCompleteOnboarding = () => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
    handleNavigate('daily')
  }

  const handleOpenReadyReceipt = () => {
    if (!readyReceiptDate) {
      return
    }

    setSelectedHistoryDate(readyReceiptDate)
    setCurrentScreen('daily')
    setReportReadyOverlayOpen(false)
  }

  const handleConfirmReadyReceipt = () => {
    setSelectedHistoryDate(null)
    setReadyReceiptDate(null)
    setReadyReceiptToConfirm(null)
    setCurrentScreen('daily')
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
    const unlistenPromise = listen<string>('daily-report-ready', (event) => {
      const reportDate = event.payload
      if (!reportDate) {
        return
      }

      setReadyReceiptDate(reportDate)
      setReadyReceiptToConfirm(reportDate)
      setReportReadyOverlayOpen(true)
      setSelectedHistoryDate(null)
      setCurrentScreen('daily')
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
          ? Math.max(300, Math.floor(monitor.workArea.size.width / scaleFactor) - 40)
          : preset.width
        const maxLogicalHeight = monitor?.workArea?.size
          ? Math.max(560, Math.floor(monitor.workArea.size.height / scaleFactor) - 60)
          : preset.height

        const targetWidth = Math.min(preset.width, maxLogicalWidth)
        const targetHeight = Math.min(preset.height, maxLogicalHeight)

        const appWindow = getCurrentWindow()
        const targetSize = new LogicalSize(targetWidth, targetHeight)

        // Reset constraints first, otherwise growing between screens can fail
        // when previous min/max are tighter than the next target size.
        await appWindow.setResizable(true)
        await appWindow.setMaxSize(null)
        await appWindow.setMinSize(null)
        await appWindow.setSize(targetSize)
        await appWindow.center()
        await appWindow.setMinSize(targetSize)
        await appWindow.setMaxSize(targetSize)
        await appWindow.setResizable(false)
        await appWindow.setMaximizable(false)
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
      className="h-full w-full antialiased"
      style={{ backgroundColor: '#fbfaf5', overflow: 'hidden' }}
    >
      {/* Fixed Background - Blur effect behind glass shell (hide for onboarding1 to show only the card) */}
      {currentScreen !== 'onboarding1' && !isDailyScreen && !isOnboardingScreen && (
        <div className="fixed inset-0 bg-surface-variant/80 backdrop-blur-3xl z-0"></div>
      )}

      {/* App Container */}
      <div className="relative z-10 w-full h-full">
        {currentScreen === 'onboarding1' && <Onboarding1 onNext={() => handleNavigate('onboarding2')} />}
        {currentScreen === 'onboarding2' && <Onboarding2 onNext={() => handleNavigate('onboarding3')} />}
        {currentScreen === 'onboarding3' && <Onboarding3 onNext={handleCompleteOnboarding} />}
        {currentScreen === 'daily' && (
          <DailyReceipt
            onNavigate={handleNavigate}
            reportDate={selectedHistoryDate ?? undefined}
            readyForConfirmationDate={readyReceiptToConfirm ?? undefined}
            onConfirmReadyReceipt={handleConfirmReadyReceipt}
          />
        )}
        {currentScreen === 'weekly' && <WeeklyReceipt onNavigate={handleNavigate} onOpenDayReceipt={handleOpenHistoryDay} />}
        {currentScreen === 'settings' && <Settings onNavigate={handleNavigate} />}
      </div>

      {reportReadyOverlayOpen && !isOnboardingScreen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(20, 20, 20, 0.42)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 320,
              background: '#fbfaf5',
              border: '1px dashed #c4c4c4',
              borderRadius: 4,
              padding: '22px 18px',
              textAlign: 'center',
              color: '#1c1b1b',
              fontFamily: 'Courier Prime, monospace',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              TWÓJ PARAGON JEST GOTOWY
            </div>
            <div
              style={{
                fontSize: 10,
                color: '#666',
                fontStyle: 'italic',
                marginBottom: 16,
                letterSpacing: '0.03em',
              }}
            >
              Kliknij poniżej, aby obejrzeć raport i zamknąć dzień.
            </div>
            <button
              onClick={handleOpenReadyReceipt}
              style={{
                background: '#1e1e1e',
                color: '#fff',
                border: 'none',
                borderRadius: 2,
                padding: '12px 16px',
                width: '100%',
                fontFamily: 'Courier Prime, monospace',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              OBEJRZYJ PARAGON
            </button>
          </div>
        </div>
      )}

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
