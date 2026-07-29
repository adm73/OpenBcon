import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../auth/session'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { AuthShell } from './AuthShell'

export function SignupPage() {
  const { config } = usePlatformConfig()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    document.title = `Create account | ${config.productName}${config.productSuffix}`
  }, [config.productName, config.productSuffix])

  function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password.length < 8) {
      setNotice('Use at least 8 characters for the password.')
      return
    }

    if (password !== confirmPassword) {
      setNotice('The password confirmation does not match.')
      return
    }

    try {
      registerUser({
        fullName,
        companyName,
        email,
        password,
      })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to create the account.')
    }
  }

  return (
    <AuthShell
      badge="Create account"
      title="Start your Bconomics workspace."
      description="Create a founder account to save companies, track opportunities, and generate funding-ready materials."
      footer={
        <span>
          Already have an account? <Link to="/login">Log in</Link>
        </span>
      }
    >
      <form className="auth-form" onSubmit={submitSignup}>
        <label>
          <span>Full name</span>
          <input
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value)
              if (notice) {
                setNotice('')
              }
            }}
            placeholder="Ava Lin"
            autoComplete="name"
          />
        </label>
        <label>
          <span>Company name</span>
          <input
            value={companyName}
            onChange={(event) => {
              setCompanyName(event.target.value)
              if (notice) {
                setNotice('')
              }
            }}
            placeholder="Northstar Foods"
            autoComplete="organization"
          />
        </label>
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
            placeholder="ava@northstarfoods.ca"
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
            placeholder="Create a password"
            autoComplete="new-password"
          />
        </label>
        <label>
          <span>Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value)
              if (notice) {
                setNotice('')
              }
            }}
            placeholder="Re-enter the password"
            autoComplete="new-password"
          />
        </label>
        <button type="submit">Create account</button>
      </form>

      {notice ? (
        <p className="auth-notice" role="alert">
          {notice}
        </p>
      ) : null}
    </AuthShell>
  )
}
