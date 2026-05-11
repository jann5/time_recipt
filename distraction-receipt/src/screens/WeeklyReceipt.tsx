import WeeklyReceiptCard from '../components/WeeklyReceiptCard'

interface WeeklyReceiptProps {
  onNavigate: (screen: 'weekly' | 'settings' | 'daily') => void
  onOpenDayReceipt?: (date: string) => void
}

export default function WeeklyReceipt({ onNavigate, onOpenDayReceipt }: WeeklyReceiptProps) {
  return <WeeklyReceiptCard onNavigate={onNavigate} onOpenDayReceipt={onOpenDayReceipt} />
}
