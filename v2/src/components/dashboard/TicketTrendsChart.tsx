import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TrendData {
  date: string
  opened: number
  resolved: number
}

interface TicketTrendsChartProps {
  data: TrendData[]
}

export function TicketTrendsChart({ data }: TicketTrendsChartProps) {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Ticket Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })
              }
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) =>
                new Date(value).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="opened"
              stroke="#3b82f6"
              name="Opened"
            />
            <Line
              type="monotone"
              dataKey="resolved"
              stroke="#22c55e"
              name="Resolved"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
