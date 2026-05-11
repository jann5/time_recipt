import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

interface AppUsage {
  name: string
  time_seconds: number
}

interface DailyReport {
  date: string
  daily_report_time: string
  productive_apps: AppUsage[]
  distraction_apps: AppUsage[]
  neutral_apps: AppUsage[]
  alt_tab_count: number
  total_productive_seconds: number
  total_distraction_seconds: number
  total_neutral_seconds: number
}

interface DailyReceiptCardProps {
  onNavigate?: (screen: 'weekly' | 'settings' | 'daily') => void
  reportDate?: string
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${mins}min`
  }
  return `${mins}min`
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v5h5"/>
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
      <path d="M12 7v5l4 2"/>
    </svg>
  )
}

export default function DailyReceiptCard({ onNavigate, reportDate }: DailyReceiptCardProps) {
  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let disposed = false

    const fetchReport = async () => {
      try {
        const data = await invoke<DailyReport>(
          reportDate ? 'get_daily_report_for_date' : 'get_daily_report',
          reportDate ? { date: reportDate } : undefined,
        )
        if (!disposed) {
          setReport(data)
        }
      } catch (error) {
        if (!disposed) {
          console.error('Błąd pobierania raportu:', error)
        }
      } finally {
        if (!disposed) {
          setLoading(false)
        }
      }
    }

    setLoading(true)
    void fetchReport()

    if (reportDate) {
      return () => {
        disposed = true
      }
    }

    const interval = window.setInterval(() => {
      void fetchReport()
    }, 5000)
    const unlistenPromise = listen<string>('app-switched', () => {
      void fetchReport()
    })

    return () => {
      disposed = true
      clearInterval(interval)
      void unlistenPromise.then((unlisten) => {
        unlisten()
      })
    }
  }, [reportDate])

  const handleSaveImage = async () => {
    try {
      const path = await invoke<string>('save_receipt_as_image')
      console.log('Zapisano obraz:', path)
      alert('Paragon zapisany!')
    } catch (error) {
      console.error('Błąd zapisywania:', error)
      alert('Błąd podczas zapisywania')
    }
  }

  const productiveApps = report?.productive_apps ?? []
  const distractionApps = report?.distraction_apps ?? []
  const neutralApps = report?.neutral_apps ?? []

  const totalProductive = report?.total_productive_seconds ?? 0
  const totalDistraction = report?.total_distraction_seconds ?? 0
  const totalNeutral = report?.total_neutral_seconds ?? 0
  const totalTime = totalProductive + totalDistraction + totalNeutral

  const productivity = totalTime > 0
    ? Math.round((totalProductive / totalTime) * 100)
    : 0

  const sortedProductive = [...productiveApps].sort((a, b) => b.time_seconds - a.time_seconds)
  const sortedDistraction = [...distractionApps].sort((a, b) => b.time_seconds - a.time_seconds)
  const sortedNeutral = [...neutralApps].sort((a, b) => b.time_seconds - a.time_seconds)

  const today = report?.date
    ? new Date(report.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div style={{ fontFamily: 'Courier Prime, monospace', color: '#666' }}>
          Ładowanie...
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <div
        role="dialog"
        aria-label="Daily receipt"
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
          paddingTop: 28,
          paddingBottom: 24,
          paddingLeft: 24,
          paddingRight: 24,
          color: '#1c1b1b',
          fontFamily: 'Courier Prime, monospace',
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: 16, left: 16 }}>
          <button
            onClick={() => onNavigate && onNavigate('settings')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              color: '#1c1b1b',
              opacity: 0.6,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.opacity = '1'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.opacity = '0.6'
            }}
            aria-label="Ustawienia"
          >
            <SettingsIcon />
          </button>
        </div>

        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <button
            onClick={() => onNavigate && onNavigate('weekly')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              color: '#1c1b1b',
              opacity: 0.6,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.opacity = '1'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.opacity = '0.6'
            }}
            aria-label="Historia"
          >
            <HistoryIcon />
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.25em',
              marginBottom: 12,
              color: '#888',
              textTransform: 'uppercase',
            }}
          >
            DISTRACTION CO.
          </div>

          <div style={{ width: 40, height: 1, background: '#1c1b1b', margin: '0 auto 16px' }} />

          <h1
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.18em',
              margin: '0 0 6px 0',
              textTransform: 'uppercase',
            }}
          >
            TWÓJ CODZIENNY RAPORT
          </h1>
          <div style={{ fontSize: 10, color: '#666', letterSpacing: '0.1em' }}>
            {today} · {report?.daily_report_time || '22:00'}
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #c4c4c4', marginBottom: 24 }} />

        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              marginBottom: 14,
              textTransform: 'uppercase',
              color: '#1c1b1b',
            }}
          >
            ROZPROSZENIA
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedDistraction.length > 0 ? (
              sortedDistraction.map((app, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, alignItems: 'center' }}>
                  <span style={{ letterSpacing: '0.02em' }}>{app.name}</span>
                  <span style={{ fontWeight: 500 }}>{formatTime(app.time_seconds)}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>
                Brak rozpraszaczy dzisiaj
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10,
              fontWeight: 700,
              marginTop: 14,
              paddingTop: 10,
              borderTop: '1px dashed #d0d0d0',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ color: '#666' }}>Total wasted time</span>
            <span>{formatTime(totalDistraction)}</span>
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #c4c4c4', marginBottom: 24 }} />

        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              marginBottom: 14,
              textTransform: 'uppercase',
              color: '#1c1b1b',
            }}
          >
            PRACA
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedProductive.length > 0 ? (
              sortedProductive.map((app, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, alignItems: 'center' }}>
                  <span style={{ letterSpacing: '0.02em' }}>{app.name}</span>
                  <span style={{ fontWeight: 500 }}>{formatTime(app.time_seconds)}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>
                Brak pracy dzisiaj
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10,
              fontWeight: 700,
              marginTop: 14,
              paddingTop: 10,
              borderTop: '1px dashed #d0d0d0',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ color: '#666' }}>Total prod. time</span>
            <span>{formatTime(totalProductive)}</span>
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #c4c4c4', marginBottom: 28 }} />

        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              marginBottom: 14,
              textTransform: 'uppercase',
              color: '#1c1b1b',
            }}
          >
            INNE
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedNeutral.length > 0 ? (
              sortedNeutral.map((app, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, alignItems: 'center' }}>
                  <span style={{ letterSpacing: '0.02em' }}>{app.name}</span>
                  <span style={{ fontWeight: 500 }}>{formatTime(app.time_seconds)}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>
                Brak innych pozycji dzisiaj
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #c4c4c4', marginBottom: 28 }} />

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '0.15em',
              marginBottom: 16,
              textTransform: 'uppercase',
            }}
          >
            WYDAJNOŚĆ DNIA: {productivity}%
          </div>

          <div
            style={{
              fontSize: 11,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              letterSpacing: '0.05em',
            }}
          >
            <span>Alt+Tab: {report?.alt_tab_count || 0}</span>
          </div>

          <div style={{ fontSize: 10, color: '#888', fontStyle: 'italic', letterSpacing: '0.03em' }}>
            {totalTime > 0
              ? `Śledzenie aktywne od ${formatTime(totalTime)}`
              : 'Zacznij pracować, a zobaczysz statystyki'}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ marginTop: 'auto' }}>
          <div style={{ borderTop: '1px dashed #c4c4c4', marginBottom: 20 }} />

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={handleSaveImage}
              style={{
                background: 'none',
                border: 'none',
                color: '#1c1b1b',
                cursor: 'pointer',
                fontFamily: 'Courier Prime, monospace',
                fontSize: 10,
                letterSpacing: '0.1em',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
                padding: 0,
                opacity: 0.7,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.opacity = '1'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.opacity = '0.7'
              }}
            >
              Zapisz obraz
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
