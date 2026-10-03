import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import AdminDashboard from './pages/admin/AdminDashboard'
import QueueManagement from './pages/admin/QueueManagement'
import ServiceManagement from './pages/admin/ServiceManagement'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Dashboard from './pages/user/Dashboard'
import History from './pages/user/History'
import JoinQueue from './pages/user/JoinQueue'
import QueueStatus from './pages/user/QueueStatus'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/app" element={<Layout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="join" element={<JoinQueue />} />
        <Route path="status" element={<QueueStatus />} />
        <Route path="history" element={<History />} />
      </Route>

      <Route path="/admin" element={<Layout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="services" element={<ServiceManagement />} />
        <Route path="queues/:serviceId?" element={<QueueManagement />} />
      </Route>

      <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
    </Routes>
  )
}
