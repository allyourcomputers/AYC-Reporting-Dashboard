import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { StatCard } from "@/components/dashboard/StatCard"
import { TicketTrendsChart } from "@/components/dashboard/TicketTrendsChart"
import { Ticket, CheckCircle, ThumbsUp, AlertCircle } from "lucide-react"

export function DashboardPage() {
  // Last 30 days
  const endDate = Date.now()
  const startDate = endDate - 30 * 24 * 60 * 60 * 1000

  const stats = useQuery(api.tickets.stats, { startDate, endDate })
  const trends = useQuery(api.dashboard.trends, { startDate, endDate })
  const topClients = useQuery(api.dashboard.topClients, { startDate, endDate })

  if (!stats || !trends) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tickets Opened"
          value={stats.opened}
          description="Last 30 days"
          icon={Ticket}
        />
        <StatCard
          title="Tickets Resolved"
          value={stats.resolved}
          description="Last 30 days"
          icon={CheckCircle}
        />
        <StatCard
          title="Satisfaction"
          value={
            stats.avgSatisfaction
              ? `${stats.avgSatisfaction.toFixed(1)}%`
              : "N/A"
          }
          description="Average rating"
          icon={ThumbsUp}
        />
        <StatCard
          title="Open Rate"
          value={`${stats.openRate.toFixed(1)}%`}
          description="Currently open"
          icon={AlertCircle}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TicketTrendsChart data={trends} />

        {topClients && topClients.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-4">Top Clients</h3>
            <div className="space-y-3">
              {topClients.map((client, index) => (
                <div
                  key={client.companyId}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">
                    {index + 1}. {client.companyName}
                  </span>
                  <span className="text-sm font-medium">
                    {client.ticketCount} tickets
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
