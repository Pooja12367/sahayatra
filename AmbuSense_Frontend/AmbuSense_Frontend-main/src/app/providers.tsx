"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { SessionExpiryHandler } from "@/components/auth/session-expiry-handler";
import { createQueryClient } from "@/lib/query-client";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SessionExpiryHandler />
      {children}
      <Toaster richColors closeButton />
    </QueryClientProvider>
  );
}
