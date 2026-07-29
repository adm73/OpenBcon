import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  resetPassword,
  validatePasswordResetToken,
} from '../auth/session'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { AuthShell } from './AuthShell'

export function ResetPasswordPage() {
  const { config } = usePlatformConfig()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notice, setNotice] = useState('')
  const token = searchParams.get('token') ?? ''
  const tokenRecord = useMemo(
    () => (token ? validatePasswordResetToken(token) : null),
    [token],
  )

  useEffect(() => {
    document.title = `Reset password | ${config.productName}${config.productSuffix}`
  }, [config.productName, config.productSuffix])

  function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      setNotice('This reset link is missing a token.')
      return
    }

    if (password.length < 8) {
      setNotice('Use at least 8 characters for the new password.')
      return
    }

    if (password !== confirmPassword) {
      setNotice('The password confirmation does not match.')
      return
    }

    try {
      resetPassword({ token, password })
      navigate('/login', { replace: true })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to reset the password.')
    }
  }

  return (
    <AuthShell
      badge="Reset password"
      title="Choose a new password."
      description="Set a new password for this workspace account, then return to login."
      footer={
        <span>
          Need a new link? <Link to="/forgot-password">Request another reset</Link>
        </span>
      }
    >
      {!tokenRecord ? (
        <div className="auth-empty-state">
          <strong>Reset link unavailable</strong>
          <p>
            This reset link is invalid or has expired. Request a fresh password reset
            to continue.
          </p>
          <Link className="auth-inline-link" to="/forgot-password">
            Request a new reset link
          </Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submitReset}>
          <label>
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (notice) {
                  setNotice('')
                }
              }}
              placeholder="Enter a new password"
              autoComplete="new-password"
            />
          </label>
          <label>
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value)
                if (notice) {
                  setNotice('')
                }
              }}
              placeholder="Re-enter the new password"
              autoComplete="new-password"
            />
          </label>
          <button type="submit">Reset password</button>
        </form>
      )}

      {notice ? (
        <p className="auth-notice" role="alert">
          {notice}
        </p>
      ) : null}
    </AuthShell>
  )
}
