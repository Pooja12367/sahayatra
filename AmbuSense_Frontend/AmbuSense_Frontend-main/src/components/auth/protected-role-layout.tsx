"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useMe } from "@/hooks/use-auth";
import { getRoleHomePath } from "@/lib/auth-redirect";
import { useAuthStore } from "@/stores/auth-store";
import type { UserRole } from "@/types/auth";

type ProtectedRoleLayoutProps = {
  allowedRole: UserRole;
  children: ReactNode;
};

export function ProtectedRoleLayout({
  allowedRole,
  children,
}: ProtectedRoleLayoutProps) {
  const router = useRouter();
  const { data, isLoading, isFetching, isError } = useMe();
  const storedRole = useAuthStore((state) => state.role);
  const storedIsAuthenticated = useAuthStore(
    (state) => state.isAuthenticated,
  );
  const role = data?.user.role ?? storedRole;
  const isAuthenticated = Boolean(data?.user) || storedIsAuthenticated;
  const isCheckingAuth = isLoading || isFetching;

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    if (isError || !isAuthenticated || !role) {
      router.replace("/login");
      return;
    }

    if (role !== allowedRole) {
      router.replace(getRoleHomePath(role));
    }
  }, [allowedRole, isAuthenticated, isCheckingAuth, isError, role, router]);

  if (isCheckingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm font-medium">Checking access...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Please wait while we verify your session.
          </p>
        </div>
      </main>
    );
  }

  if (isError || !isAuthenticated || !role || role !== allowedRole) {
    return null;
  }

  return <>{children}</>;
}
