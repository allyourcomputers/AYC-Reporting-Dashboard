import { createBrowserRouter } from "react-router-dom"
import { SignInPage } from "@/components/auth/SignInPage"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { AppLayout } from "@/components/layout/AppLayout"
import { DashboardPage } from "@/pages/DashboardPage"
import { ReportsPage } from "@/pages/ReportsPage"
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage"
import { AdminCompaniesPage } from "@/pages/admin/AdminCompaniesPage"
import { AdminDomainAssignmentPage } from "@/pages/admin/AdminDomainAssignmentPage"

// Placeholder pages - will be implemented later

function ServersPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Servers</h1></div>
}

function WorkstationsPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Workstations</h1></div>
}

function DomainsPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Domains</h1></div>
}

export const router = createBrowserRouter([
  {
    path: "/sign-in",
    element: <SignInPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
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
          { path: "/admin/domain-assignments", element: <AdminDomainAssignmentPage /> },
        ],
      },
    ],
  },
])
