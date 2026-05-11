import SettingsCard from '../components/SettingsCard'

interface SettingsProps {
  onNavigate: (screen: 'weekly' | 'settings' | 'daily') => void
}

export default function Settings({ onNavigate }: SettingsProps) {
  return <SettingsCard onNavigate={onNavigate} />
}