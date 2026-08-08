import nodemailer from 'nodemailer'
import { environment } from './config'
import type { RuntimeSMTPConfig } from './runtimeAuthConfig'

let smtpTransporter: nodemailer.Transporter | null = null
let smtpTransporterKey = ''

function getEnvironmentSMTPConfig(): RuntimeSMTPConfig {
  return {
    enabled: environment.EMAIL_PROVIDER === 'smtp',
    host: environment.SMTP_HOST ?? '',
    port: environment.SMTP_PORT,
    secure: environment.SMTP_SECURE,
    username: environment.SMTP_USER ?? '',
    password: environment.SMTP_PASSWORD ?? '',
    from: environment.EMAIL_FROM,
  }
}

function getSmtpTransporter(config: RuntimeSMTPConfig) {
  const transporterKey = [
    config.host,
    config.port,
    config.secure,
    config.username,
    config.password,
  ].join('|')
  if (!smtpTransporter || smtpTransporterKey !== transporterKey) {
    if (!config.host || !config.username || !config.password) {
      throw new Error('SMTP email configuration is incomplete.')
    }
    smtpTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
    })
    smtpTransporterKey = transporterKey
  }
  return smtpTransporter
}

export function isEmailDeliveryConfigured(
  config: RuntimeSMTPConfig = getEnvironmentSMTPConfig(),
) {
  return !config.enabled || Boolean(config.host && config.username && config.password)
}

export async function sendVerificationEmail(input: {
  email: string
  fullName: string
  verificationUrl: string
}, config: RuntimeSMTPConfig = getEnvironmentSMTPConfig()) {
  const subject = 'Verify your OpenBcon email address'
  const greeting = input.fullName.trim() || 'there'
  const text = [
    `Hi ${greeting},`,
    '',
    'Verify your email address to activate your OpenBcon account:',
    input.verificationUrl,
    '',
    'This link expires in 24 hours. If you did not create this account, you can ignore this email.',
  ].join('\n')
  const html = `<!doctype html><html><body><p>Hi ${escapeHtml(greeting)},</p><p>Verify your email address to activate your OpenBcon account.</p><p><a href="${escapeHtml(input.verificationUrl)}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p></body></html>`

  if (!config.enabled) {
    process.stdout.write(`[email:console] verification email for ${input.email}: ${input.verificationUrl}\n`)
    return { previewUrl: input.verificationUrl }
  }

  await getSmtpTransporter(config).sendMail({
    from: config.from,
    to: input.email,
    subject,
    text,
    html,
  })
  return { previewUrl: null }
}

export async function sendPasswordResetEmail(input: {
  email: string
  fullName: string
  resetUrl: string
}, config: RuntimeSMTPConfig = getEnvironmentSMTPConfig()) {
  const subject = 'Reset your OpenBcon password'
  const greeting = input.fullName.trim() || 'there'
  const text = [
    `Hi ${greeting},`,
    '',
    'Use the link below to reset your OpenBcon password:',
    input.resetUrl,
    '',
    'This link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.',
  ].join('\n')
  const html = `<!doctype html><html><body><p>Hi ${escapeHtml(greeting)},</p><p>Use the link below to reset your OpenBcon password.</p><p><a href="${escapeHtml(input.resetUrl)}">Reset password</a></p><p>This link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.</p></body></html>`

  if (!config.enabled) {
    process.stdout.write(`[email:console] password reset email for ${input.email}: ${input.resetUrl}\n`)
    return { previewUrl: input.resetUrl }
  }

  await getSmtpTransporter(config).sendMail({
    from: config.from,
    to: input.email,
    subject,
    text,
    html,
  })
  return { previewUrl: null }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}
