import Onboarding3Card from '../components/Onboarding3Card'

interface Onboarding3Props {
  onNext: () => void
}

export default function Onboarding3({ onNext }: Onboarding3Props) {
  return <Onboarding3Card onNext={onNext} />
}
