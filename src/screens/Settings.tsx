import SettingsCard from '../components/SettingsCard'
import type { AppLanguage } from '../i18n'

interface SettingsProps {
  onNavigate: (screen: 'weekly' | 'settings' | 'daily') => void
  language: AppLanguage
  onLanguageChange?: (nextLanguage: AppLanguage) => Promise<void>
}

export default function Settings({ onNavigate, language, onLanguageChange }: SettingsProps) {
  return <SettingsCard onNavigate={onNavigate} language={language} onLanguageChange={onLanguageChange} />
}
