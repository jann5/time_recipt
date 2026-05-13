import Onboarding3Card from '../components/Onboarding3Card'
import type { AppLanguage } from '../i18n'

interface Onboarding3Props {
  onNext: () => void
  language: AppLanguage
}

export default function Onboarding3({ onNext, language }: Onboarding3Props) {
  return <Onboarding3Card onNext={onNext} language={language} />
}
