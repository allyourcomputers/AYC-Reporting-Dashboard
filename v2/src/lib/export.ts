import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface MonthlyReportRow {
  month: string;
  monthLabel: string;
  totalTickets: number;
  closedTickets: number;
  openTickets: number;
  closeRate: number;
}

export function exportReportPDF(
  data: MonthlyReportRow[],
  clientName: string,
  dateRange: string
) {
  const doc = new jsPDF();

  const totalTickets = data.reduce((sum, r) => sum + r.totalTickets, 0);
  const totalClosed = data.reduce((sum, r) => sum + r.closedTickets, 0);
  const totalOpen = data.reduce((sum, r) => sum + r.openTickets, 0);

  doc.setFontSize(18);
  doc.text("Ticket Report", 14, 20);

  doc.setFontSize(11);
  doc.text(`Client: ${clientName}`, 14, 30);
  doc.text(`Period: ${dateRange}`, 14, 37);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 44);

  doc.setFontSize(14);
  doc.text("Summary Statistics", 14, 58);

  autoTable(doc, {
    startY: 63,
    head: [["Metric", "Value"]],
    body: [
      ["Total Tickets", totalTickets.toString()],
      ["Closed Tickets", totalClosed.toString()],
      ["Open Tickets", totalOpen.toString()],
    ],
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185] },
    margin: { left: 14 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 63;
  doc.setFontSize(14);
  doc.text("Monthly Breakdown", 14, finalY + 15);

  autoTable(doc, {
    startY: finalY + 20,
    head: [["Month", "Total Tickets", "Closed", "Open", "Close Rate"]],
    body: data.map((row) => [
      row.monthLabel,
      row.totalTickets.toString(),
      row.closedTickets.toString(),
      row.openTickets.toString(),
      `${row.closeRate.toFixed(1)}%`,
    ]),
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185] },
    margin: { left: 14 },
  });

  const fileName = `ticket-report-${clientName.replace(/[^a-z0-9]/gi, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}

export function exportReportCSV(
  data: MonthlyReportRow[],
  clientName: string,
  dateRange: string
) {
  const totalTickets = data.reduce((sum, r) => sum + r.totalTickets, 0);
  const totalClosed = data.reduce((sum, r) => sum + r.closedTickets, 0);
  const totalOpen = data.reduce((sum, r) => sum + r.openTickets, 0);

  let csv = "Ticket Report\n";
  csv += `Client: ${clientName}\n`;
  csv += `Period: ${dateRange}\n`;
  csv += `Generated: ${new Date().toLocaleString()}\n\n`;
  csv += "Summary Statistics\n";
  csv += `Total Tickets,${totalTickets}\n`;
  csv += `Closed Tickets,${totalClosed}\n`;
  csv += `Open Tickets,${totalOpen}\n\n`;
  csv += "Monthly Breakdown\n";
  csv += "Month,Total Tickets,Closed,Open,Close Rate\n";
  data.forEach((row) => {
    csv += `${row.monthLabel},${row.totalTickets},${row.closedTickets},${row.openTickets},${row.closeRate.toFixed(1)}%\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ticket-report-${clientName.replace(/[^a-z0-9]/gi, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
