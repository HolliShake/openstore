import { Suspense } from "react";
import { RestockListView } from "@/components/reports/restock-list-view";

export default function RestockListPage() {
  return (
    <Suspense fallback={null}>
      <RestockListView />
    </Suspense>
  );
}
