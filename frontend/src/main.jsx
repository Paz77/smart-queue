import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthProvider'
import { NotificationProvider } from './context/NotificationProvider'
import { OrganizationProvider } from './context/OrganizationProvider'
import { QueueProvider } from './context/QueueProvider'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OrganizationProvider>
          <NotificationProvider>
            <QueueProvider>
              <App />
            </QueueProvider>
          </NotificationProvider>
        </OrganizationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
