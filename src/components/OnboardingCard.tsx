interface OnboardingCardProps {
  onNext?: () => void
}

export default function OnboardingCard({ onNext }: OnboardingCardProps) {
  return (
    <div aria-hidden={false} className="h-full w-full">
      <div
        role="dialog"
        aria-label="Onboarding card"
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
          fontFamily: "Courier Prime, monospace",
        }}
      >
        {/* Top area: step + title */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.28em',
              marginBottom: 18,
            }}
          >
            KROK 1/3
          </div>

          <h1
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.12em',
              margin: '0 auto 22px',
              maxWidth: 300,
              lineHeight: 1.15,
              textTransform: 'uppercase',
            }}
          >
            WITAJ W FUGIT
            <br />CO.
          </h1>
        </div>

        {/* Center icon */}
        <div style={{ textAlign: 'center' }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <rect x="6" y="3" width="12" height="14" rx="1" stroke="#1c1b1b" strokeWidth="1.8" />
            <path d="M8 7h5" stroke="#1c1b1b" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="16.2" cy="8.2" r="0.7" fill="#1c1b1b" />
            <path d="M6 17l3 1 3-1 3 1 3-1" stroke="#1c1b1b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Description: big whitespace above and below -> keep narrow column */}
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontSize: 11,
              lineHeight: 1.45,
              maxWidth: 380,
              margin: '24px auto 0',
              color: '#1c1b1b',
            }}
          >
            Dlaczego paragon? Bo wykresy
            <br />nie bolą tak, jak wydany czas.
          </p>
        </div>

        {/* Bottom button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => onNext && onNext()}
            style={{
              background: '#1e1e1e',
              color: '#fff',
              padding: '14px 24px',
              width: '78%',
              maxWidth: 320,
              borderRadius: 2,
              fontFamily: "Courier Prime, monospace",
              fontSize: 13,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <span>DALEJ</span>
            <span style={{ transform: 'translateY(1px)' }}>→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
