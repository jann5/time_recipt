import DailyReceiptCard from '../components/DailyReceiptCard'

interface DailyReceiptProps {
  onNavigate: (screen: 'weekly' | 'settings' | 'daily') => void
}

export default function DailyReceipt({ onNavigate }: DailyReceiptProps) {
  return <DailyReceiptCard onNavigate={onNavigate} />
}
