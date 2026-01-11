import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function CompanySwitcher() {
  const user = useQuery(api.users.me)
  const companies = useQuery(api.companies.list)
  const switchCompany = useMutation(api.users.switchCompany)

  if (!user || user.role !== "super_admin") {
    return null
  }

  const handleChange = (value: string) => {
    if (value === "all") {
      switchCompany({ companyId: undefined })
    } else {
      switchCompany({ companyId: value as any })
    }
  }

  return (
    <Select
      value={user.activeCompanyId ?? "all"}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="All Companies" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Companies</SelectItem>
        {companies?.filter(Boolean).map((company) => (
          <SelectItem key={company!._id} value={company!._id}>
            {company!.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
