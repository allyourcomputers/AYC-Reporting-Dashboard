import { UserButton } from "@clerk/clerk-react"

export function Header() {
  return (
    <header className="border-b bg-card">
      <div className="flex h-16 items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg">Halo Reporting</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </header>
  )
}
