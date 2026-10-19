import { ButtonV2, ButtonV2Size, ButtonV2Type, FOUNDATION_THEME } from '@juspay/blend-design-system'
import { Eye, Lock } from 'lucide-react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { continueAsGuest, signInWithGoogle, signOut, start, useSession } from './session'

const { colors } = FOUNDATION_THEME

const TITLE: CSSProperties = {
  fontSize: 20,
  lineHeight: '28px',
  fontWeight: 600,
  color: colors.gray[900],
}
const BODY: CSSProperties = {
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  color: colors.gray[500],
}

/**
 * Nothing of the app renders until the visitor has either signed in or chosen to look as a
 * guest. Every visit starts here (the session is per tab — src/auth/supabase.ts).
 */
function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession()
  useEffect(start, [])

  switch (session.status) {
    case 'editor':
    case 'guest':
      return children
    case 'loading':
      return <Screen>{null}</Screen>
    case 'unconfigured':
      return (
        <Screen>
          <Card>
            <h1 className="m-0" style={TITLE}>
              Sign-in isn’t set up
            </h1>
            <p className="m-0" style={BODY}>
              This deployment is missing its Supabase settings (VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY).
            </p>
          </Card>
        </Screen>
      )
    case 'denied':
      return (
        <Screen>
          <Card>
            <Badge tone="red">
              <Lock size={18} />
            </Badge>
            <h1 className="m-0" style={TITLE}>
              No edit access
            </h1>
            <p className="m-0" style={BODY}>
              <strong style={{ color: colors.gray[700] }}>{session.email}</strong> isn’t on the list
              of editors. You can still look around as a guest.
            </p>
            <div className="flex flex-col gap-2">
              <ButtonV2
                text="Continue as guest"
                buttonType={ButtonV2Type.PRIMARY}
                size={ButtonV2Size.MEDIUM}
                width="100%"
                onClick={async () => {
                  await signOut()
                  continueAsGuest()
                }}
              />
              <ButtonV2
                text="Use a different account"
                buttonType={ButtonV2Type.SECONDARY}
                size={ButtonV2Size.MEDIUM}
                width="100%"
                onClick={() => void signOut()}
              />
            </div>
          </Card>
        </Screen>
      )
    case 'signed-out':
      return (
        <Screen>
          <SignIn />
        </Screen>
      )
  }
}

function SignIn() {
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const google = async () => {
    setLeaving(true)
    setError(null)
    const problem = await signInWithGoogle()
    // On success the page is already on its way to Google; only a problem comes back here.
    if (problem) {
      setLeaving(false)
      setError(problem)
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <h1 className="m-0" style={TITLE}>
          Sign in to Hyper Recon
        </h1>
        <p className="m-0" style={BODY}>
          Editors sign in with their Juspay Google account. Anyone else can look around as a guest.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <ButtonV2
          text="Continue with Google"
          buttonType={ButtonV2Type.SECONDARY}
          size={ButtonV2Size.MEDIUM}
          width="100%"
          leftSlot={{ slot: <GoogleLogo />, maxHeight: 16 }}
          loading={leaving}
          disabled={leaving}
          onClick={() => void google()}
        />
        <ButtonV2
          text="Continue as guest"
          buttonType={ButtonV2Type.SECONDARY}
          size={ButtonV2Size.MEDIUM}
          width="100%"
          leftSlot={{ slot: <Eye size={16} />, maxHeight: 16 }}
          disabled={leaving}
          onClick={continueAsGuest}
        />
        {error && (
          <span
            role="alert"
            style={{ fontSize: 13, lineHeight: '18px', fontWeight: 500, color: colors.red[600] }}
          >
            {error}
          </span>
        )}
      </div>

      <p className="m-0 text-center" style={{ ...BODY, fontSize: 12, lineHeight: '16px' }}>
        Guests can view everything but can’t make changes.
      </p>
    </Card>
  )
}

/** Google's four-colour "G", as its sign-in buttons draw it. */
function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <main
      className="flex min-h-dvh items-center justify-center px-4 py-10"
      style={{ backgroundColor: colors.gray[25] }}
    >
      {children}
    </main>
  )
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex w-full max-w-[400px] flex-col gap-5 rounded-2xl border bg-white p-8"
      style={{ borderColor: colors.gray[200], boxShadow: '0 8px 24px rgba(16, 24, 40, 0.06)' }}
    >
      {children}
    </div>
  )
}

function Badge({ tone, children }: { tone: 'red'; children: ReactNode }) {
  return (
    <span
      className="flex size-10 items-center justify-center rounded-xl"
      style={{ backgroundColor: colors[tone][50], color: colors[tone][600] }}
    >
      {children}
    </span>
  )
}

export default AuthGate
