import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface WeeklyReceiptCardProps {
  onNavigate?: (screen: 'weekly' | 'settings' | 'daily') => void
}

interface WeeklyDayHistory {
  date: string
  day: string
  productivity: number
  streak: boolean
}

interface WeeklyHistory {
  week_label: string
  week_start: string
  week_end: string
  days: WeeklyDayHistory[]
  average_productivity: number
  best_day_label: string
  best_day_productivity: number
}

const fallbackHistory: WeeklyHistory = {
  week_label: 'Tydzień -',
  week_start: '',
  week_end: '',
  days: [
    { date: '', day: 'Pon', productivity: 0, streak: false },
    { date: '', day: 'Wt', productivity: 0, streak: false },
    { date: '', day: 'Śr', productivity: 0, streak: false },
    { date: '', day: 'Czw', productivity: 0, streak: false },
    { date: '', day: 'Pt', productivity: 0, streak: false },
    { date: '', day: 'Sob', productivity: 0, streak: false },
    { date: '', day: 'Nd', productivity: 0, streak: false },
  ],
  average_productivity: 0,
  best_day_label: '-',
  best_day_productivity: 0,
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5"/>
      <path d="M12 19l-7-7 7-7"/>
    </svg>
  )
}

function FlameIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  )
}

export default function WeeklyReceiptCard({ onNavigate }: WeeklyReceiptCardProps) {
  const [history, setHistory] = useState<WeeklyHistory>(fallbackHistory)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await invoke<WeeklyHistory>('get_weekly_history')
        setHistory(data)
      } catch (error) {
        console.error('Błąd pobierania historii:', error)
      } finally {
        setLoading(false)
      }
    }

    void fetchHistory()
  }, [])

  const weekData = useMemo(
    () => (history.days.length > 0 ? history.days : fallbackHistory.days),
    [history.days],
  )

  const bestDayText = history.best_day_label === '-' || history.best_day_productivity === 0
    ? '-'
    : `${history.best_day_label} (${history.best_day_productivity}%)`

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div
        role="dialog"
        aria-label="Weekly history"
        className="flex-shrink-0"
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: '0',
          minHeight: '480px',
          background: '#fbfaf5',
          borderRadius: 8,
          boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 32,
          paddingBottom: 28,
          paddingLeft: 32,
          paddingRight: 32,
          color: '#1c1b1b',
          fontFamily: "Courier Prime, monospace",
          position: 'relative',
          opacity: loading ? 0.75 : 1,
        }}
      >
        <div style={{ position: 'absolute', top: 16, left: 16 }}>
          <button
            onClick={() => onNavigate && onNavigate('daily')}
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
            aria-label="Wróć"
          >
            <BackIcon />
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
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
            HISTORIA
          </h1>
          <div style={{ fontSize: 10, color: '#666', letterSpacing: '0.1em' }}>
            {history.week_label}
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #c4c4c4', marginBottom: 24 }} />

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              marginBottom: 16,
              textTransform: 'uppercase',
            }}
          >
            WYDAJNOŚĆ TYGODNIOWA
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {weekData.map((day, index) => (
              <div
                key={`${day.day}-${index}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: index < weekData.length - 1 ? '1px dashed #e8e8e8' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, width: 32 }}>{day.day}</span>
                  {day.streak && day.productivity > 0 && <FlameIcon />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 100,
                      height: 4,
                      background: '#e8e8e8',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${day.productivity}%`,
                        height: '100%',
                        background: day.productivity >= 70 ? '#1c1b1b' : day.productivity >= 50 ? '#666' : '#999',
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, width: 36, textAlign: 'right' }}>
                    {day.productivity > 0 ? `${day.productivity}%` : '-'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed #c4c4c4' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              <span>Średnia wydajność:</span>
              <span>{history.average_productivity}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span>Najlepszy dzień:</span>
              <span>{bestDayText}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <div style={{ borderTop: '1px dashed #c4c4c4', marginBottom: 20 }} />

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              fontSize: 10,
              color: '#888',
              fontStyle: 'italic',
            }}
          >
            "Konsekwencja jest kluczem do sukcesu."
          </div>
        </div>
      </div>
    </div>
  )
}
