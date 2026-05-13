import type { AppLanguage } from '../i18n'
import OnboardingLanguageCard from '../components/OnboardingLanguageCard'

interface OnboardingLanguageProps {
  selectedLanguage: AppLanguage | null
  onSelectLanguage: (language: AppLanguage) => void
  onNext: () => void
  isSaving?: boolean
}

export default function OnboardingLanguage({
  selectedLanguage,
  onSelectLanguage,
  onNext,
  isSaving,
}: OnboardingLanguageProps) {
  return (
    <OnboardingLanguageCard
      selectedLanguage={selectedLanguage}
      onSelectLanguage={onSelectLanguage}
      onNext={onNext}
      isSaving={isSaving}
    />
  )
}
