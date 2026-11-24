import { Suspense } from "react";
import { WeeklyReportView } from "@/components/reports/weekly-report-view";

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <WeeklyReportView />
    </Suspense>
  );
}
