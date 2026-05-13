export type AppLanguage = 'pl' | 'en'

export const LANGUAGE_STORAGE_KEY = 'fugit:language'

export function normalizeLanguage(value: string | null | undefined): AppLanguage {
  return value?.trim().toLowerCase() === 'en' ? 'en' : 'pl'
}

export function localeForLanguage(language: AppLanguage): string {
  return language === 'en' ? 'en-GB' : 'pl-PL'
}

const weekdayMap: Record<string, string> = {
  Pon: 'Mon',
  Wt: 'Tue',
  Śr: 'Wed',
  Czw: 'Thu',
  Pt: 'Fri',
  Sob: 'Sat',
  Nd: 'Sun',
}

export function translateWeekdayLabel(day: string, language: AppLanguage): string {
  if (language === 'pl') {
    return day
  }

  return weekdayMap[day] ?? day
}

export function formatDateKey(dateKey: string, language: AppLanguage): string {
  const parsed = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return dateKey
  }

  return parsed.toLocaleDateString(localeForLanguage(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
