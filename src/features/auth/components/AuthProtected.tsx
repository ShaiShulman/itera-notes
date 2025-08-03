"use client";

import { ReactNode } from "react";
import { useAuthProtection } from "../hooks/useAuthProtection";

interface AuthProtectedProps {
  children: ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
  fallback?: ReactNode;
}

export function AuthProtected({ 
  children, 
  redirectTo = "/", 
  requireAuth = true,
  fallback 
}: AuthProtectedProps) {
  const { isLoading, isAuthenticated, isProtected } = useAuthProtection({
    redirectTo,
    requireAuth,
  });

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      fallback || (
        <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-500">Loading...</p>
          </div>
        </div>
      )
    );
  }

  // Don't render anything if protection failed (redirect will happen)
  if (isProtected) {
    return null;
  }

  // Render children if authenticated or auth not required
  return <>{children}</>;
}