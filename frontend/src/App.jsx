import { Navigate, Route, Routes } from 'react-router'
import Login from './Login.jsx'

function App() {
  function handleLogin({ username }) {
    // TODO: send credentials to the backend
    console.log('Logging in as', username)
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login onLogin={handleLogin} />} />
    </Routes>
  )
}

export default App
