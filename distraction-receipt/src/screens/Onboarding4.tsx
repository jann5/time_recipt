import Onboarding4Card from '../components/Onboarding4Card'

interface Onboarding4Props {
  onFinish: () => void
  onBack?: () => void
}

export default function Onboarding4({ onFinish, onBack }: Onboarding4Props) {
  return <Onboarding4Card onFinish={onFinish} onBack={onBack} />
}
