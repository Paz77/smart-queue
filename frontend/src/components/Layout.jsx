import { Outlet } from 'react-router-dom'
import { DevTools } from '../dev/DevTools'
import { FogBackdrop } from './FogBackdrop'
import { NotificationToaster } from './NotificationToaster'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function Layout() {
  return (
    <div className="min-h-screen md:pl-12">
      <FogBackdrop />
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </main>
      </div>
      <NotificationToaster />
      {import.meta.env.DEV && <DevTools />}
    </div>
  )
}
