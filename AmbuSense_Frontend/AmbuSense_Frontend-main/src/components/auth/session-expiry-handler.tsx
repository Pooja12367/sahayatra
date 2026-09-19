"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { api, isAuthExpiredError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const ignoredAuthPaths = ["/auth/login", "/auth/signup", "/auth/logout"];

export function SessionExpiryHandler() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const lastToastAtRef = useRef(0);

  useEffect(() => {
    const interceptorId = api.interceptors.response.use(
      (response) => response,
      (error) => {
        const requestUrl = String(error?.config?.url ?? "");
        const shouldIgnore = ignoredAuthPaths.some((path) =>
          requestUrl.includes(path),
        );

        if (isAuthExpiredError(error) && !shouldIgnore) {
          useAuthStore.getState().clearAuth();
          queryClient.removeQueries({ queryKey: ["auth", "me"] });

          const now = Date.now();
          if (now - lastToastAtRef.current > 4000) {
            toast.error("Your session has expired. Please sign in again.");
            lastToastAtRef.current = now;
          }

          if (window.location.pathname !== "/login") {
            router.replace("/login");
          }
        }

        return Promise.reject(error);
      },
    );

    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, [queryClient, router]);

  return null;
}
