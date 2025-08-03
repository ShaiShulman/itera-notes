"use client"

import { createContext, useContext, ReactNode } from "react"
import { useSession } from "next-auth/react"
import type { Session } from "next-auth"

interface AuthContextType {
  session: Session | null
  status: "loading" | "authenticated" | "unauthenticated"
  isAuthenticated: boolean
  isLoading: boolean
  userId?: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()

  const value: AuthContextType = {
    session,
    status,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    userId: session?.user?.id,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function useRequireAuth() {
  const auth = useAuth()
  
  if (!auth.isAuthenticated && !auth.isLoading) {
    throw new Error("This hook can only be used in authenticated contexts")
  }
  
  return auth
}