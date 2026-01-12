import { SignedIn, SignedOut, RedirectToSignIn, useAuth } from "@clerk/clerk-react"
import { Outlet } from "react-router-dom"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useEffect, useState } from "react"

function AccountLinker({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth()
  const linkAccount = useMutation(api.users.linkClerkAccount)
  const [linking, setLinking] = useState(false)
  const [linked, setLinked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isSignedIn && !linked && !linking && !error) {
      setLinking(true)
      linkAccount()
        .then(() => {
          setLinked(true)
          setLinking(false)
        })
        .catch((err) => {
          // If already linked or other non-critical error, continue
          if (err.message?.includes("Already linked")) {
            setLinked(true)
          } else {
            setError(err.message || "Unknown error occurred")
          }
          setLinking(false)
        })
    }
  }, [isSignedIn, linked, linking, linkAccount, error])

  if (linking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p>Setting up your account...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Account Setup Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-sm text-gray-600">
            Please contact your administrator to be added to the system.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function ProtectedRoute() {
  return (
    <>
      <SignedIn>
        <AccountLinker>
          <Outlet />
        </AccountLinker>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}
