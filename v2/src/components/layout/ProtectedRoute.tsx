import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import { Outlet, Navigate } from "react-router-dom"

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p>Loading...</p>
      </div>
    </div>
  )
}

export function ProtectedRoute() {
  return (
    <>
      <AuthLoading>
        <LoadingSpinner />
      </AuthLoading>
      <Unauthenticated>
        <Navigate to="/sign-in" replace />
      </Unauthenticated>
      <Authenticated>
        <Outlet />
      </Authenticated>
    </>
  )
}
