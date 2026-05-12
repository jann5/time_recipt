import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface WeeklyReceiptCardProps {
  onNavigate?: (screen: 'weekly' | 'settings' | 'daily') => void
  onOpenDayReceipt?: (date: string) => void
}

interface WeeklyDayHistory {
  date: string
  day: string
  productivity: number
  streak: boolean
  is_rest_day: boolean
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
    { date: '', day: 'Pon', productivity: 0, streak: false, is_rest_day: false },
    { date: '', day: 'Wt', productivity: 0, streak: false, is_rest_day: false },
    { date: '', day: 'Śr', productivity: 0, streak: false, is_rest_day: false },
    { date: '', day: 'Czw', productivity: 0, streak: false, is_rest_day: false },
    { date: '', day: 'Pt', productivity: 0, streak: false, is_rest_day: false },
    { date: '', day: 'Sob', productivity: 0, streak: false, is_rest_day: false },
    { date: '', day: 'Nd', productivity: 0, streak: false, is_rest_day: false },
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

export default function WeeklyReceiptCard({ onNavigate, onOpenDayReceipt }: WeeklyReceiptCardProps) {
  const [history, setHistory] = useState<WeeklyHistory>(fallbackHistory)
  const [loading, setLoading] = useState(true)
  const [restDayBusyDate, setRestDayBusyDate] = useState<string | null>(null)
  const [restDayError, setRestDayError] = useState('')

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

  useEffect(() => {
    void fetchHistory()
  }, [])

  const weekData = useMemo(
    () => (history.days.length > 0 ? history.days : fallbackHistory.days),
    [history.days],
  )

  const restDayInWeek = weekData.find((day) => day.is_rest_day)

  const toggleRestDay = async (day: WeeklyDayHistory) => {
    if (!day.date || restDayBusyDate) {
      return
    }

    setRestDayError('')
    setRestDayBusyDate(day.date)
    try {
      await invoke('mark_day_off', { date: day.date })
      await fetchHistory()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setRestDayError(message)
    } finally {
      setRestDayBusyDate(null)
    }
  }

  const bestDayText = history.best_day_label === '-' || history.best_day_productivity === 0
    ? '-'
    : `${history.best_day_label} (${history.best_day_productivity}%)`

  return (
    <div className="h-full w-full">
      <div
        role="dialog"
        aria-label="Weekly history"
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
            FUGIT
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
            {weekData.map((day, index) => {
              const restTakenByOtherDay = Boolean(restDayInWeek && restDayInWeek.date !== day.date)
              const canToggleRestDay = Boolean(day.date) && !restTakenByOtherDay && !restDayBusyDate
              const isBusy = restDayBusyDate === day.date

              return (
                <div
                  key={`${day.day}-${index}`}
                  style={{
                    padding: '10px 0',
                    borderBottom: index < weekData.length - 1 ? '1px dashed #e8e8e8' : 'none',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (day.date) {
                        onOpenDayReceipt && onOpenDayReceipt(day.date)
                      }
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: 'none',
                      background: 'none',
                      textAlign: 'left',
                      cursor: day.date ? 'pointer' : 'default',
                      padding: 0,
                    }}
                    aria-label={day.date ? `Pokaż paragon z dnia ${day.date}` : `Dzień ${day.day}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, width: 32 }}>{day.day}</span>
                      {day.streak && day.productivity > 0 && <FlameIcon />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {day.is_rest_day ? (
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em' }}>REST</span>
                      ) : (
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
                      )}
                      <span style={{ fontSize: 11, fontWeight: 500, width: 36, textAlign: 'right' }}>
                        {day.is_rest_day ? 'REST' : day.productivity > 0 ? `${day.productivity}%` : '-'}
                      </span>
                    </div>
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        void toggleRestDay(day)
                      }}
                      disabled={!canToggleRestDay}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: canToggleRestDay ? '#1c1b1b' : '#9a9893',
                        cursor: canToggleRestDay ? 'pointer' : 'not-allowed',
                        fontFamily: 'Courier Prime, monospace',
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        textDecoration: canToggleRestDay ? 'underline' : 'none',
                        textUnderlineOffset: '3px',
                        padding: 0,
                      }}
                      aria-label={day.is_rest_day ? `Usuń Rest day dla ${day.day}` : `Ustaw Rest day dla ${day.day}`}
                    >
                      {isBusy ? 'Zapisywanie...' : day.is_rest_day ? 'Usuń Rest day' : 'Ustaw Rest day'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed #c4c4c4' }}>
            {restDayInWeek && (
              <div style={{ fontSize: 10, color: '#666', marginBottom: 10 }}>
                Rest day: {restDayInWeek.day} ({restDayInWeek.date}) - wyłączony ze średniej
              </div>
            )}
            {restDayError && (
              <div style={{ fontSize: 10, color: '#8a3c3c', marginBottom: 10 }}>
                {restDayError}
              </div>
            )}
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
