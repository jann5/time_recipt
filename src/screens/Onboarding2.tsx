
import Onboarding2Card from '../components/Onboarding2Card'

interface Onboarding2Props {
  onNext: () => void
}

export default function Onboarding2({ onNext }: Onboarding2Props) {
  return <Onboarding2Card onNext={onNext} />
}
