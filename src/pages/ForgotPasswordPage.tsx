import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { requestPasswordReset } from '../auth/session'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { getPlatformDisplayName } from '../lib/platformBrand'
import { AuthShell } from './AuthShell'

export function ForgotPasswordPage() {
  const { config } = usePlatformConfig()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [resetLink, setResetLink] = useState('')
  const platformName = getPlatformDisplayName(config)

  useEffect(() => {
    document.title = `Forgot password | ${platformName}`
  }, [platformName])

  async function submitForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const result = await requestPasswordReset(email)
      if (result.previewResetUrl) {
        const previewUrl = new URL(result.previewResetUrl, window.location.origin)
        setResetLink(`${previewUrl.pathname}${previewUrl.search}`)
        setNotice('A preview reset link has been prepared for this account.')
        return
      }

      if (result.token) {
      const nextLink = `/reset-password?token=${result.token}`
      setResetLink(nextLink)
      setNotice('A demo reset link has been prepared for this account.')
      return
      }

      setResetLink('')
      setNotice('If an account exists for this email, a reset link will be sent.')
    } catch (error) {
      setResetLink('')
      setNotice(error instanceof Error ? error.message : 'Unable to request a password reset.')
    }
  }

  return (
    <AuthShell
      badge="Forgot password"
      title="Recover access to your workspace."
      description="Enter the email address linked to your account and we will prepare a password reset flow."
      footer={
        <span>
          Back to <Link to="/login">log in</Link>
        </span>
      }
    >
      <form className="auth-form" onSubmit={submitForgotPassword}>
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
        <button type="submit">Send reset link</button>
      </form>

      {notice ? (
        <p className="auth-notice" role="status">
          {notice}
        </p>
      ) : null}

      {resetLink ? (
        <div className="auth-demo-note">
          <strong>Demo reset link</strong>
          <p>
            In development, the link is shown here for testing. In production, it is
            delivered by email.
          </p>
          <button type="button" onClick={() => navigate(resetLink)}>
            Open reset page
          </button>
        </div>
      ) : null}
    </AuthShell>
  )
}
