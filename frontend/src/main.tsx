import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import { TermsOfService } from './pages/TermsOfService'
import { PrivacyPolicy } from './pages/PrivacyPolicy'
import { AdminDashboard } from './components/AdminDashboard'
import { AdminAudit } from './pages/AdminAudit'
import './styles/main.css'
import { ToastProvider } from './hooks/useToast'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/terms-of-service', element: <TermsOfService /> },
  { path: '/terms-of-service.html', element: <TermsOfService /> },
  { path: '/privacy-policy', element: <PrivacyPolicy /> },
  { path: '/privacy-policy.html', element: <PrivacyPolicy /> },
  { path: '/admin', element: <AdminDashboard /> },
  { path: '/admin/audit', element: <AdminAudit /> }
])

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </React.StrictMode>
)
