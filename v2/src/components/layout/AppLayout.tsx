import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"
import { ImpersonationBanner } from "./ImpersonationBanner"

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <ImpersonationBanner />
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
