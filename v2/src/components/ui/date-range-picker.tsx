import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  startMonth: string; // YYYY-MM format
  endMonth: string;   // YYYY-MM format
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  className?: string;
}

export function DateRangePicker({
  startMonth,
  endMonth,
  onStartChange,
  onEndChange,
  className,
}: DateRangePickerProps) {
  const [error, setError] = useState<string | null>(null);

  const handleStartChange = useCallback(
    (value: string) => {
      if (value > endMonth) {
        setError("Start must be before end");
      } else {
        setError(null);
      }
      onStartChange(value);
    },
    [endMonth, onStartChange]
  );

  const handleEndChange = useCallback(
    (value: string) => {
      if (value < startMonth) {
        setError("End must be after start");
      } else {
        setError(null);
      }
      onEndChange(value);
    },
    [startMonth, onEndChange]
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="date-range-start" className="text-sm font-medium">Start Month</label>
          <input
            id="date-range-start"
            type="month"
            value={startMonth}
            onChange={(e) => handleStartChange(e.target.value)}
            aria-invalid={!!error}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="date-range-end" className="text-sm font-medium">End Month</label>
          <input
            id="date-range-end"
            type="month"
            value={endMonth}
            onChange={(e) => handleEndChange(e.target.value)}
            aria-invalid={!!error}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
