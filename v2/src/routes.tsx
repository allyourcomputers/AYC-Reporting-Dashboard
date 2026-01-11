import { createBrowserRouter } from "react-router-dom"
import { SignInPage } from "@/components/auth/SignInPage"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"

// Placeholder pages - will be implemented later
function DashboardPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Dashboard</h1></div>
}

function ReportsPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Reports</h1></div>
}

function ServersPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Servers</h1></div>
}

function WorkstationsPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Workstations</h1></div>
}

function DomainsPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Domains</h1></div>
}

function AdminUsersPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Admin Users</h1></div>
}

function AdminCompaniesPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Admin Companies</h1></div>
}

export const router = createBrowserRouter([
  {
    path: "/sign-in",
    element: <SignInPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/reports", element: <ReportsPage /> },
      { path: "/servers", element: <ServersPage /> },
      { path: "/servers/:deviceId", element: <div>Server Detail</div> },
      { path: "/workstations", element: <WorkstationsPage /> },
      { path: "/workstations/:deviceId", element: <div>Workstation Detail</div> },
      { path: "/domains", element: <DomainsPage /> },
      { path: "/admin/users", element: <AdminUsersPage /> },
      { path: "/admin/companies", element: <AdminCompaniesPage /> },
      { path: "/admin/domain-assignments", element: <div>Domain Assignments</div> },
    ],
  },
])
