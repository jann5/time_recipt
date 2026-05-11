
import OnboardingCard from '../components/OnboardingCard'

interface Onboarding1Props {
  onNext: () => void
}

export default function Onboarding1({ onNext }: Onboarding1Props) {
  return <OnboardingCard onNext={onNext} />
}
