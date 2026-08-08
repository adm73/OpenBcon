import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginUser, startGoogleSignIn } from '../auth/session'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { getPlatformDisplayName } from '../lib/platformBrand'
import { AuthShell } from './AuthShell'

function getNextPath(search: string) {
  const params = new URLSearchParams(search)
  const next = params.get('next')
  return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
    ? next
    : '/dashboard'
}

export function LoginPage() {
  const { config } = usePlatformConfig()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [googleAvailable, setGoogleAvailable] = useState(false)
  const nextPath = getNextPath(location.search)
  const platformName = getPlatformDisplayName(config)

  useEffect(() => {
    document.title = `Log in | ${platformName}`
  }, [platformName])

  useEffect(() => {
    fetch('/api/auth/google/status')
      .then((response) => response.json() as Promise<{ enabled?: boolean }>)
      .then((payload) => setGoogleAvailable(payload.enabled === true))
      .catch(() => setGoogleAvailable(false))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('auth') === 'verified') {
      setNotice('Your email is verified. You can continue to your workspace.')
    } else if (params.get('auth_error') === 'email_unverified') {
      setNotice('Your account can sign in now. Please verify your email when convenient.')
    } else if (params.get('auth_error')) {
      setNotice('Google sign-in could not be completed. Please try again.')
    }
  }, [location.search])

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      await loginUser({ email, password })
      navigate(nextPath, { replace: true })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to sign in.')
    }
  }

  return (
    <AuthShell
      badge="Log in"
      title="Access your funding workspace."
      description="Sign in to continue managing companies, programs, applications, and generated funding packages."
      footer={
        <>
          <span>
            New here? <Link to="/signup">Create an account</Link>
          </span>
          <span>
            Forgot your password? <Link to="/forgot-password">Reset it</Link>
          </span>
        </>
      }
    >
      <form className="auth-form" onSubmit={submitLogin}>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (notice) {
                setNotice('')
              }
            }}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              if (notice) {
                setNotice('')
              }
            }}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
        </label>
        <button type="submit">Log in</button>
      </form>

      {googleAvailable ? (
        <button type="button" className="auth-secondary-button" onClick={() => startGoogleSignIn(nextPath)}>
          Continue with Google
        </button>
      ) : null}

      {notice ? (
        <p className="auth-notice" role="alert">
          {notice}
        </p>
      ) : null}

    </AuthShell>
  )
}
