import Login from './Login.jsx'

function App() {
  function handleLogin({ username }) {
    // TODO: send credentials to the backend
    console.log('Logging in as', username)
  }

  return <Login onLogin={handleLogin} />
}

export default App
