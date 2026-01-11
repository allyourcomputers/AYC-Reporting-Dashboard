import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export function ImpersonationBanner() {
  const user = useQuery(api.users.me)
  const stopImpersonation = useMutation(api.users.stopImpersonation)

  if (!user?.isImpersonating) {
    return null
  }

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">
          Viewing as: {user.name} ({user.email})
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => stopImpersonation()}
        className="bg-amber-600 border-amber-700 text-amber-950 hover:bg-amber-700"
      >
        Stop Impersonating
      </Button>
    </div>
  )
}
