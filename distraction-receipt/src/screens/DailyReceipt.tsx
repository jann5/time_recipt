import DailyReceiptCard from '../components/DailyReceiptCard'

interface DailyReceiptProps {
  onNavigate: (screen: 'weekly' | 'settings' | 'daily') => void
  reportDate?: string
  readyForConfirmationDate?: string
  onConfirmReadyReceipt?: () => void
}

export default function DailyReceipt({
  onNavigate,
  reportDate,
  readyForConfirmationDate,
  onConfirmReadyReceipt,
}: DailyReceiptProps) {
  return (
    <DailyReceiptCard
      onNavigate={onNavigate}
      reportDate={reportDate}
      readyForConfirmationDate={readyForConfirmationDate}
      onConfirmReadyReceipt={onConfirmReadyReceipt}
    />
  )
}
