import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportReportPDF, exportReportCSV } from "@/lib/export";
import { FileText, Download, Ticket, CheckCircle, AlertCircle } from "lucide-react";

export function ReportsPage() {
  const user = useQuery(api.users.me);
  const companies = useQuery(api.companies.list);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [selectedCompany, setSelectedCompany] = useState<string | undefined>();
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [showResults, setShowResults] = useState(false);

  const reportData = useQuery(
    api.reports.monthlyStats,
    showResults
      ? {
          companyId: selectedCompany as Id<"companies"> | undefined,
          startMonth,
          endMonth,
        }
      : "skip"
  );

  const handleGenerateReport = () => {
    if (startMonth > endMonth) {
      alert("Start month must be before or equal to end month");
      return;
    }
    setShowResults(true);
  };

  // Filter out null companies (from Promise.all in the query)
  const validCompanies = companies?.filter((c): c is NonNullable<typeof c> => c !== null) ?? [];

  const selectedCompanyName =
    selectedCompany && validCompanies.length > 0
      ? validCompanies.find((c) => c._id === selectedCompany)?.name ?? "All Companies"
      : "All Companies";

  const dateRange = `${startMonth} to ${endMonth}`;

  const totalTickets = reportData?.reduce((sum, r) => sum + r.totalTickets, 0) ?? 0;
  const totalClosed = reportData?.reduce((sum, r) => sum + r.closedTickets, 0) ?? 0;
  const totalOpen = reportData?.reduce((sum, r) => sum + r.openTickets, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ticket Reports</h1>
        <p className="text-muted-foreground">View ticket statistics and monthly usage reports</p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.role === "super_admin" && validCompanies.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Company</label>
              <Select value={selectedCompany ?? "all"} onValueChange={(v) => setSelectedCompany(v === "all" ? undefined : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {validCompanies.map((company) => (
                    <SelectItem key={company._id} value={company._id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DateRangePicker
            startMonth={startMonth}
            endMonth={endMonth}
            onStartChange={(value) => { setStartMonth(value); setShowResults(false); }}
            onEndChange={(value) => { setEndMonth(value); setShowResults(false); }}
          />

          <Button onClick={handleGenerateReport}>
            <FileText className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </CardContent>
      </Card>

      {/* Loading */}
      {showResults && !reportData && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Results */}
      {showResults && reportData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Results</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => exportReportCSV(reportData, selectedCompanyName, dateRange)}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => exportReportPDF(reportData, selectedCompanyName, dateRange)}>
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Total Tickets</span>
                  </div>
                  <p className="text-2xl font-bold">{totalTickets}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Closed Tickets</span>
                  </div>
                  <p className="text-2xl font-bold">{totalClosed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Open Tickets</span>
                  </div>
                  <p className="text-2xl font-bold">{totalOpen}</p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Breakdown Table */}
            <div>
              <h3 className="font-semibold mb-4">Monthly Breakdown</h3>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Month</th>
                      <th className="p-3 text-left font-medium">Total Tickets</th>
                      <th className="p-3 text-left font-medium">Closed</th>
                      <th className="p-3 text-left font-medium">Open</th>
                      <th className="p-3 text-left font-medium">Close Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row) => (
                      <tr key={row.month} className="border-b">
                        <td className="p-3">{row.monthLabel}</td>
                        <td className="p-3">{row.totalTickets}</td>
                        <td className="p-3">{row.closedTickets}</td>
                        <td className="p-3">{row.openTickets}</td>
                        <td className="p-3">{row.closeRate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
