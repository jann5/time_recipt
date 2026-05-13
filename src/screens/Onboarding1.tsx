
import OnboardingCard from '../components/OnboardingCard'
import type { AppLanguage } from '../i18n'

interface Onboarding1Props {
  onNext: () => void
  language: AppLanguage
}

export default function Onboarding1({ onNext, language }: Onboarding1Props) {
  return <OnboardingCard onNext={onNext} language={language} />
}
