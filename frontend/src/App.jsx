import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Placeholder } from './components/Placeholder'
import AdminDashboard from './pages/admin/AdminDashboard'
import ServiceManagement from './pages/admin/ServiceManagement'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import History from './pages/user/History'
import QueueStatus from './pages/user/QueueStatus'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/app" element={<Layout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Placeholder title="Dashboard" />} />
        <Route path="join" element={<Placeholder title="Join a queue" />} />
        <Route path="status" element={<QueueStatus />} />
        <Route path="history" element={<History />} />
      </Route>

      <Route path="/admin" element={<Layout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="services" element={<ServiceManagement />} />
        <Route path="queues/:serviceId?" element={<Placeholder title="Queues" />} />
      </Route>

      <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
    </Routes>
  )
}
