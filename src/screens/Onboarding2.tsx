
import Onboarding2Card from '../components/Onboarding2Card'
import type { AppLanguage } from '../i18n'

interface Onboarding2Props {
  onNext: () => void
  language: AppLanguage
}

export default function Onboarding2({ onNext, language }: Onboarding2Props) {
  return <Onboarding2Card onNext={onNext} language={language} />
}
