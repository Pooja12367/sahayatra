import type { ReactNode } from "react";
import { ProtectedRoleLayout } from "@/components/auth/protected-role-layout";
import { RoleDashboardShell } from "@/components/dashboard/role-dashboard-sidebar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dispatcher Workspace",
  description: "Monitor patient requests and allocate/dispatch ambulances in real-time.",
};

export default function DispatcherLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoleLayout allowedRole="dispatcher">
      <RoleDashboardShell role="dispatcher">{children}</RoleDashboardShell>
    </ProtectedRoleLayout>
  );
}
