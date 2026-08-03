import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginUser } from '../auth/session'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { getPlatformDisplayName } from '../lib/platformBrand'
import { AuthShell } from './AuthShell'

function getNextPath(search: string) {
  const params = new URLSearchParams(search)
  const next = params.get('next')
  return next && next.startsWith('/') ? next : '/dashboard'
}

export function LoginPage() {
  const { config } = usePlatformConfig()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const nextPath = getNextPath(location.search)
  const platformName = getPlatformDisplayName(config)

  useEffect(() => {
    document.title = `Log in | ${platformName}`
  }, [platformName])

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

      {notice ? (
        <p className="auth-notice" role="alert">
          {notice}
        </p>
      ) : null}

    </AuthShell>
  )
}
