import WeeklyReceiptCard from '../components/WeeklyReceiptCard'
import type { AppLanguage } from '../i18n'

interface WeeklyReceiptProps {
  onNavigate: (screen: 'weekly' | 'settings' | 'daily') => void
  onOpenDayReceipt?: (date: string) => void
  language: AppLanguage
}

export default function WeeklyReceipt({ onNavigate, onOpenDayReceipt, language }: WeeklyReceiptProps) {
  return (
    <WeeklyReceiptCard
      onNavigate={onNavigate}
      onOpenDayReceipt={onOpenDayReceipt}
      language={language}
    />
  )
}
