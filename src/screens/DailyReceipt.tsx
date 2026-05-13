import DailyReceiptCard from '../components/DailyReceiptCard'
import type { AppLanguage } from '../i18n'

interface DailyReceiptProps {
  onNavigate: (screen: 'weekly' | 'settings' | 'daily') => void
  reportDate?: string
  readyForConfirmationDate?: string
  onConfirmReadyReceipt?: () => void
  language: AppLanguage
}

export default function DailyReceipt({
  onNavigate,
  reportDate,
  readyForConfirmationDate,
  onConfirmReadyReceipt,
  language,
}: DailyReceiptProps) {
  return (
    <DailyReceiptCard
      onNavigate={onNavigate}
      reportDate={reportDate}
      readyForConfirmationDate={readyForConfirmationDate}
      onConfirmReadyReceipt={onConfirmReadyReceipt}
      language={language}
    />
  )
}
