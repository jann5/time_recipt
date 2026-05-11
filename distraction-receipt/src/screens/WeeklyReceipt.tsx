import WeeklyReceiptCard from '../components/WeeklyReceiptCard'

interface WeeklyReceiptProps {
  onNavigate: (screen: 'weekly' | 'settings' | 'daily') => void
}

export default function WeeklyReceipt({ onNavigate }: WeeklyReceiptProps) {
  return <WeeklyReceiptCard onNavigate={onNavigate} />
}