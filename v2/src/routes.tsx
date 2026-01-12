import { createBrowserRouter } from "react-router-dom"
import { SignInPage } from "@/components/auth/SignInPage"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { AppLayout } from "@/components/layout/AppLayout"
import { DashboardPage } from "@/pages/DashboardPage"
import { ReportsPage } from "@/pages/ReportsPage"
import { ServersPage } from "@/pages/ServersPage"
import { ServerDetailPage } from "@/pages/ServerDetailPage"
import { WorkstationsPage } from "@/pages/WorkstationsPage"
import { WorkstationDetailPage } from "@/pages/WorkstationDetailPage"
import { DomainsPage } from "@/pages/DomainsPage"
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage"
import { AdminCompaniesPage } from "@/pages/admin/AdminCompaniesPage"
import { AdminDomainAssignmentPage } from "@/pages/admin/AdminDomainAssignmentPage"
import { AdminSyncPage } from "@/pages/admin/AdminSyncPage"

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
          { path: "/servers/:deviceId", element: <ServerDetailPage /> },
          { path: "/workstations", element: <WorkstationsPage /> },
          { path: "/workstations/:deviceId", element: <WorkstationDetailPage /> },
          { path: "/domains", element: <DomainsPage /> },
          { path: "/admin/users", element: <AdminUsersPage /> },
          { path: "/admin/companies", element: <AdminCompaniesPage /> },
          { path: "/admin/domain-assignments", element: <AdminDomainAssignmentPage /> },
          { path: "/admin/sync", element: <AdminSyncPage /> },
        ],
      },
    ],
  },
])
