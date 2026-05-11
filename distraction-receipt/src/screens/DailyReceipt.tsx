import DailyReceiptCard from '../components/DailyReceiptCard'

interface DailyReceiptProps {
  onNavigate: (screen: 'weekly' | 'settings' | 'daily') => void
  reportDate?: string
}

export default function DailyReceipt({ onNavigate, reportDate }: DailyReceiptProps) {
  return <DailyReceiptCard onNavigate={onNavigate} reportDate={reportDate} />
}
