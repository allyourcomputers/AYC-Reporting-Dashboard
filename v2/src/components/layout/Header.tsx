import { useAuthActions } from "@convex-dev/auth/react"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { CompanySwitcher } from "./CompanySwitcher"
import { Button } from "../ui/button"
import { LogOut, User } from "lucide-react"

export function Header() {
  const { signOut } = useAuthActions()
  const currentUser = useQuery(api.users.me)

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <header className="border-b bg-card">
      <div className="flex h-16 items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg">Halo Reporting</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <CompanySwitcher />
          {currentUser && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{currentUser.email}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
