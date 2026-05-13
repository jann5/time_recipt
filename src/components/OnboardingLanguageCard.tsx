import type { AppLanguage } from '../i18n'

const plFlag = '/flags/pl-flat.svg'
const gbFlag = '/flags/gb-flat.svg'

interface OnboardingLanguageCardProps {
  selectedLanguage: AppLanguage | null
  onSelectLanguage: (language: AppLanguage) => void
  onNext?: () => void
  isSaving?: boolean
}

export default function OnboardingLanguageCard({
  selectedLanguage,
  onSelectLanguage,
  onNext,
  isSaving,
}: OnboardingLanguageCardProps) {
  const canContinue = selectedLanguage !== null && !isSaving

  return (
    <div aria-hidden={false} className="h-full w-full">
      <div
        role="dialog"
        aria-label="Language selection"
        className="flex-shrink-0 h-full w-full"
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: '0',
          minHeight: '100%',
          height: '100%',
          background: '#fbfaf5',
          borderRadius: 0,
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: 34,
          paddingBottom: 24,
          paddingLeft: 24,
          paddingRight: 24,
          color: '#1c1b1b',
          fontFamily: 'Courier Prime, monospace',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.28em',
              marginBottom: 18,
            }}
          >
            STEP 1/4
          </div>

          <h1
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.12em',
              margin: '0 auto 16px',
              maxWidth: 300,
              lineHeight: 1.15,
              textTransform: 'uppercase',
            }}
          >
            CHOOSE YOUR LANGUAGE
          </h1>

          <p
            style={{
              fontSize: 11,
              lineHeight: 1.45,
              maxWidth: 300,
              margin: '0 auto',
              color: '#1c1b1b',
            }}
          >
            Wybierz język aplikacji.
            <br />
            Select app language.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => onSelectLanguage('pl')}
            style={{
              flex: 1,
              maxWidth: 140,
              border: selectedLanguage === 'pl' ? '1px solid #1c1b1b' : '1px dashed #c4c4c4',
              background: selectedLanguage === 'pl' ? '#f4f0e6' : '#fbfaf5',
              color: '#1c1b1b',
              borderRadius: 2,
              padding: '14px 10px',
              fontFamily: 'Courier Prime, monospace',
              fontSize: 12,
              letterSpacing: '0.08em',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
            aria-label="Polski"
          >
            <img
              src={plFlag}
              alt=""
              aria-hidden="true"
              style={{
                width: 60,
                height: 40,
                display: 'block',
                border: '1px solid #d8d4cc',
              }}
            />
            <span>POLSKI</span>
          </button>

          <button
            onClick={() => onSelectLanguage('en')}
            style={{
              flex: 1,
              maxWidth: 140,
              border: selectedLanguage === 'en' ? '1px solid #1c1b1b' : '1px dashed #c4c4c4',
              background: selectedLanguage === 'en' ? '#f4f0e6' : '#fbfaf5',
              color: '#1c1b1b',
              borderRadius: 2,
              padding: '14px 10px',
              fontFamily: 'Courier Prime, monospace',
              fontSize: 12,
              letterSpacing: '0.08em',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
            aria-label="English"
          >
            <img
              src={gbFlag}
              alt=""
              aria-hidden="true"
              style={{
                width: 60,
                height: 40,
                display: 'block',
                border: '1px solid #d8d4cc',
              }}
            />
            <span>ENGLISH</span>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => onNext?.()}
            disabled={!canContinue}
            style={{
              background: canContinue ? '#1e1e1e' : '#ece8e2',
              color: canContinue ? '#fff' : '#8e8a84',
              padding: '14px 24px',
              width: '78%',
              maxWidth: 320,
              borderRadius: 2,
              border: 'none',
              fontFamily: 'Courier Prime, monospace',
              fontSize: 13,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: canContinue ? 'pointer' : 'not-allowed',
            }}
          >
            <span>{isSaving ? 'Saving...' : 'Continue'}</span>
            <span style={{ transform: 'translateY(1px)' }}>→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
