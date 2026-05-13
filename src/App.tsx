import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { currentMonitor, getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { type AppLanguage, LANGUAGE_STORAGE_KEY, normalizeLanguage } from './i18n'
import OnboardingLanguage from './screens/OnboardingLanguage'
import Onboarding1 from './screens/Onboarding1'
import Onboarding2 from './screens/Onboarding2'
import Onboarding3 from './screens/Onboarding3'
import DailyReceipt from './screens/DailyReceipt'
import WeeklyReceipt from './screens/WeeklyReceipt'
import Settings from './screens/Settings'

type Screen = 'onboardingLanguage' | 'onboarding1' | 'onboarding2' | 'onboarding3' | 'daily' | 'weekly' | 'settings'

type ScreenWindowPreset = {
  width: number
  height: number
}

const ONBOARDING_COMPLETED_KEY = 'fugit:onboarding-completed'

const screenWindowPresets: Record<Screen, ScreenWindowPreset> = {
  onboardingLanguage: { width: 330, height: 680 },
  onboarding1: { width: 330, height: 680 },
  onboarding2: { width: 340, height: 760 },
  onboarding3: { width: 350, height: 860 },
  daily: { width: 390, height: 860 },
  weekly: { width: 380, height: 780 },
  settings: { width: 390, height: 880 },
}

/**
 * Fugit - Main App Component
 * 1:1 pixel-perfect design implementation
 * 360px max-width mobile app container with glassmorphism background
 */
export default function App() {
  const onboardingCompleted = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true'
  const storedLanguageValue = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  const initialSelectedLanguage = storedLanguageValue ? normalizeLanguage(storedLanguageValue) : null

  const [language, setLanguage] = useState<AppLanguage>(initialSelectedLanguage ?? 'pl')
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage | null>(initialSelectedLanguage)
  const [isSavingLanguage, setIsSavingLanguage] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<Screen>(
    onboardingCompleted
      ? 'daily'
      : initialSelectedLanguage
        ? 'onboarding1'
        : 'onboardingLanguage',
  )
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null)
  const [readyReceiptDate, setReadyReceiptDate] = useState<string | null>(null)
  const [readyReceiptToConfirm, setReadyReceiptToConfirm] = useState<string | null>(null)
  const [reportReadyOverlayOpen, setReportReadyOverlayOpen] = useState(false)
  const isOnboardingScreen = currentScreen.startsWith('onboarding')
  const isDailyScreen = currentScreen === 'daily'

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

  const handleSelectLanguage = (nextLanguage: AppLanguage) => {
    setSelectedLanguage(nextLanguage)
    setLanguage(nextLanguage)
  }

  const handleConfirmLanguage = async () => {
    if (!selectedLanguage) {
      return
    }

    setIsSavingLanguage(true)
    setLanguage(selectedLanguage)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage)

    try {
      await invoke('set_language', { language: selectedLanguage })
    } catch (error) {
      console.error('Nie udało się zapisać języka:', error)
    } finally {
      setIsSavingLanguage(false)
    }

    handleNavigate('onboarding1')
  }

  const handleLanguageChange = async (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage)
    setSelectedLanguage(nextLanguage)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)

    try {
      await invoke('set_language', { language: nextLanguage })
    } catch (error) {
      console.error('Could not persist language change:', error)
    }
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

  const overlayCopy = language === 'en'
    ? {
      title: 'YOUR RECEIPT IS READY',
      subtitle: 'Tap below to review the report and close the day.',
      action: 'OPEN RECEIPT',
    }
    : {
      title: 'TWÓJ PARAGON JEST GOTOWY',
      subtitle: 'Kliknij poniżej, aby obejrzeć raport i zamknąć dzień.',
      action: 'OBEJRZYJ PARAGON',
    }

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
        {currentScreen === 'onboardingLanguage' && (
          <OnboardingLanguage
            selectedLanguage={selectedLanguage}
            onSelectLanguage={handleSelectLanguage}
            onNext={() => {
              void handleConfirmLanguage()
            }}
            isSaving={isSavingLanguage}
          />
        )}
        {currentScreen === 'onboarding1' && <Onboarding1 language={language} onNext={() => handleNavigate('onboarding2')} />}
        {currentScreen === 'onboarding2' && <Onboarding2 language={language} onNext={() => handleNavigate('onboarding3')} />}
        {currentScreen === 'onboarding3' && <Onboarding3 language={language} onNext={handleCompleteOnboarding} />}
        {currentScreen === 'daily' && (
          <DailyReceipt
            language={language}
            onNavigate={handleNavigate}
            reportDate={selectedHistoryDate ?? undefined}
            readyForConfirmationDate={readyReceiptToConfirm ?? undefined}
            onConfirmReadyReceipt={handleConfirmReadyReceipt}
          />
        )}
        {currentScreen === 'weekly' && (
          <WeeklyReceipt
            language={language}
            onNavigate={handleNavigate}
            onOpenDayReceipt={handleOpenHistoryDay}
          />
        )}
        {currentScreen === 'settings' && (
          <Settings
            language={language}
            onNavigate={handleNavigate}
            onLanguageChange={handleLanguageChange}
          />
        )}
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
              {overlayCopy.title}
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
              {overlayCopy.subtitle}
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
              {overlayCopy.action}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
