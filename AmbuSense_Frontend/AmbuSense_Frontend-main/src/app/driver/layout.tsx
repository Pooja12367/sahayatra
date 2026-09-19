import type { ReactNode } from "react";
import { ProtectedRoleLayout } from "@/components/auth/protected-role-layout";
import { RoleDashboardShell } from "@/components/dashboard/role-dashboard-sidebar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Driver Dashboard",
  description: "Update ambulance status, track active emergency routes, and manage trip history.",
};

export default function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoleLayout allowedRole="driver">
      <RoleDashboardShell role="driver">{children}</RoleDashboardShell>
    </ProtectedRoleLayout>
  );
}
