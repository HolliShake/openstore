import type { ReactNode } from "react";
import {
  DefaultLayout,
  type DefaultLayoutProps,
} from "@/components/admin/default.layout";

type DashboardLayoutProps = Omit<DefaultLayoutProps, "children"> & {
  children: ReactNode;
};

export function DashboardLayout({ children, ...layoutProps }: DashboardLayoutProps) {
  return (
    <DefaultLayout {...layoutProps}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </div>
    </DefaultLayout>
  );
}
