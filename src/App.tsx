import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { PlatformConfigProvider } from './config/PlatformConfigContext'
import { AdminPage } from './pages/AdminPage'
import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PersistenceProvider } from './persistence/PersistenceProvider'

function App() {
  return (
    <PersistenceProvider>
      <PlatformConfigProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="/:sectionId" element={<DashboardPage />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </BrowserRouter>
      </PlatformConfigProvider>
    </PersistenceProvider>
  )
}

export default App
