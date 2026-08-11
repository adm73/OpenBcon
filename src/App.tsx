import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { getCurrentAuthUser, hasActiveSession } from './auth/session'
import { PlatformConfigProvider } from './config/PlatformConfigContext'
import { LanguageProvider } from './i18n'
import { AdminPage } from './pages/AdminPage'
import { DashboardPage, ProgramsPage } from './pages/DashboardPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LandingPage } from './pages/LandingPage'
import { LegalDocumentPage } from './pages/LegalDocumentPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SignupPage } from './pages/SignupPage'
import { PersistenceProvider } from './persistence/PersistenceProvider'
import { dashboardHref, isDashboardHost, isWorkspacePath, publicSiteHref } from './lib/domainRouting'

function RequireAuthRoute({ children }: { children: ReactNode }) {
  const location = useLocation()

  if (hasActiveSession()) {
    return <>{children}</>
  }

  const next = `${location.pathname}${location.search}${location.hash}`
  return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
}

function GuestOnlyRoute({ children }: { children: ReactNode }) {
  return hasActiveSession() ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

function AdminRoute() {
  const location = useLocation()

  if (!hasActiveSession()) {
    const next = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  return getCurrentAuthUser()?.role === 'admin' ? <AdminPage /> : <Navigate to="/dashboard" replace />
}

function DomainBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  const dashboardHost = isDashboardHost()
  const currentPath = `${location.pathname}${location.search}${location.hash}`
  let target = ''

  if (dashboardHost && location.pathname === '/') {
    target = dashboardHref('/dashboard')
  } else if (dashboardHost && location.pathname === '/programs') {
    target = publicSiteHref(currentPath)
  } else if (!dashboardHost && isWorkspacePath(location.pathname)) {
    target = dashboardHref(currentPath)
  }

  if (target && target !== `${window.location.origin}${currentPath}`) {
    window.location.replace(target)
    return null
  }

  return <>{children}</>
}

function App() {
  return (
    <PersistenceProvider>
      <BrowserRouter>
        <LanguageProvider>
          <PlatformConfigProvider>
            <DomainBoundary>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route
                  path="/privacy-policy"
                  element={<LegalDocumentPage documentType="privacyPolicy" />}
                />
                <Route
                  path="/terms-of-service"
                  element={<LegalDocumentPage documentType="termsOfService" />}
                />
                <Route path="/login" element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
                <Route path="/signup" element={<GuestOnlyRoute><SignupPage /></GuestOnlyRoute>} />
                <Route
                  path="/forgot-password"
                  element={<GuestOnlyRoute><ForgotPasswordPage /></GuestOnlyRoute>}
                />
                <Route
                  path="/reset-password"
                  element={<GuestOnlyRoute><ResetPasswordPage /></GuestOnlyRoute>}
                />
                <Route path="/admin" element={<AdminRoute />} />
                <Route path="/dashboard" element={<RequireAuthRoute><DashboardPage /></RequireAuthRoute>} />
                <Route path="/programs" element={<ProgramsPage />} />
                <Route path="/404" element={<NotFoundPage />} />
                <Route path="/:sectionId" element={<RequireAuthRoute><DashboardPage /></RequireAuthRoute>} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
            </DomainBoundary>
          </PlatformConfigProvider>
        </LanguageProvider>
      </BrowserRouter>
    </PersistenceProvider>
  )
}

export default App
