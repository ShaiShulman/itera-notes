"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface UseAuthProtectionOptions {
  redirectTo?: string;
  requireAuth?: boolean;
}

export function useAuthProtection(options: UseAuthProtectionOptions = {}) {
  const { redirectTo = "/", requireAuth = true } = options;
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return; // Wait for session to load
    
    if (requireAuth && !session) {
      router.push(redirectTo);
      return;
    }
  }, [session, status, router, redirectTo, requireAuth]);

  return {
    session,
    status,
    isLoading: status === "loading",
    isAuthenticated: !!session,
    isProtected: requireAuth && !session,
  };
}