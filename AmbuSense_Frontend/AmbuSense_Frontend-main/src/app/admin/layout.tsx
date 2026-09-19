import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ProtectedRoleLayout } from "@/components/auth/protected-role-layout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "AmbuSense Administration and Resource Management",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoleLayout allowedRole="admin">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_32%),linear-gradient(135deg,#ffffff_0%,#f4f6f9_48%,#eef3fb_100%)] pl-20 lg:flex lg:pl-0">
        <AdminSidebar />
        <div className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto lg:overflow-x-hidden">
          {children}
        </div>
      </div>
    </ProtectedRoleLayout>
  );
}
