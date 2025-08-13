import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = [
    "/",
    "/auth/signin",
    "/api/auth",
  ]

  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => 
    pathname.startsWith(route) || pathname === "/"
  )

  // Allow access to API auth routes
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next()
  }

  // If user is not authenticated and trying to access protected route
  if (!req.auth && !isPublicRoute) {
    const signInUrl = new URL("/auth/signin", req.url)
    signInUrl.searchParams.set("callbackUrl", req.url)
    return NextResponse.redirect(signInUrl)
  }

  // If user is authenticated and trying to access signin page, redirect to home
  if (req.auth && pathname === "/auth/signin") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}