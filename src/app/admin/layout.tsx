import type { ReactNode } from "react";
import { AdminApp } from "@/components/admin/admin-app";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminApp>{children}</AdminApp>;
}
