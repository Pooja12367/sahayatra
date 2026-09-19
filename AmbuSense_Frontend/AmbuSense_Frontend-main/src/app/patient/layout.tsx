import type { ReactNode } from "react";
import { ProtectedRoleLayout } from "@/components/auth/protected-role-layout";
import { RoleDashboardShell } from "@/components/dashboard/role-dashboard-sidebar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Patient Dashboard",
  description: "Request an ambulance, choose preferred hospitals, and track live trips.",
};

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoleLayout allowedRole="patient">
      <RoleDashboardShell role="patient">{children}</RoleDashboardShell>
    </ProtectedRoleLayout>
  );
}
