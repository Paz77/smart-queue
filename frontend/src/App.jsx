import { Navigate, Route, Routes } from 'react-router-dom'
import { FogBackdrop } from './components/FogBackdrop'
import { Layout } from './components/Layout'
import { Placeholder } from './components/Placeholder'
import History from './pages/user/History'
import QueueStatus from './pages/user/QueueStatus'

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <div className="mx-auto max-w-md px-4 py-16">
            <FogBackdrop />
            <Placeholder title="Log in" />
          </div>
        }
      />
      <Route
        path="/register"
        element={
          <div className="mx-auto max-w-md px-4 py-16">
            <FogBackdrop />
            <Placeholder title="Create account" />
          </div>
        }
      />

      <Route path="/app" element={<Layout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Placeholder title="Dashboard" />} />
        <Route path="join" element={<Placeholder title="Join a queue" />} />
        <Route path="status" element={<QueueStatus />} />
        <Route path="history" element={<History />} />
      </Route>

      <Route path="/admin" element={<Layout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Placeholder title="Overview" />} />
        <Route path="services" element={<Placeholder title="Services" />} />
        <Route path="queues/:serviceId?" element={<Placeholder title="Queues" />} />
      </Route>

      <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
    </Routes>
  )
}
