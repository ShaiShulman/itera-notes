"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut, signIn } from "next-auth/react";
import { CustomIcon } from "@/components/icons/CustomIcon";

const navigationItems = [
  {
    name: "Create Itinerary",
    href: "/create-itinerary",
    icon: "plus" as const,
    primary: true,
  },
  {
    name: "Itinerary Editor",
    href: "/editor",
    icon: "map" as const,
  },
  {
    name: "My Itineraries",
    href: "/itineraries",
    icon: "clipboard" as const,
  },
  // {
  //   name: "Settings",
  //   href: "/settings",
  //   icon: "settings" as const,
  // },
  // {
  //   name: "Help",
  //   href: "/help",
  //   icon: "help" as const,
  // },
];

export default function TopNavigation() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="bg-slate-900 border-b border-slate-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center space-x-4 mr-8">
              <Image
                src="/brand-sm.png"
                alt="breadcrumbs.ai"
                width={50}
                height={50}
                className="h-13 w-13"
              />
              <h1 className="text-3xl font-bold text-white tracking-tight">
                BreadCrumbs.ai
              </h1>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="md:block flex-1 flex justify-center">
            <div className="flex items-baseline space-x-2">
              {session &&
                navigationItems.map((item) => {
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-1
                      ${
                        item.primary
                          ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                          : isActive
                          ? "bg-slate-700 text-white"
                          : "text-slate-300 hover:bg-slate-700 hover:text-white"
                      }
                    `}
                    >
                      <CustomIcon name={item.icon} className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* User Menu */}
          <div className="hidden md:block">
            <div className="flex items-center space-x-3">
              {session ? (
                <>
                  <div className="flex items-center space-x-2">
                    <CustomIcon
                      name="user"
                      className="h-5 w-5 text-slate-300"
                    />
                    <span className="text-sm text-slate-300">
                      {session.user?.name || session.user?.email}
                    </span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center space-x-1 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                  >
                    <CustomIcon name="logout" className="h-6 w-6" />
                    <span>Sign out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => signIn("google")}
                  className="flex items-center space-x-1 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                >
                  <CustomIcon name="user" className="h-4 w-4" />
                  <span>Sign in</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              type="button"
              className="bg-slate-800 inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-white"
              aria-controls="mobile-menu"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="md:hidden" id="mobile-menu">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-slate-800">
          {session &&
            navigationItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                  flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200
                  ${
                    item.primary
                      ? "bg-blue-600 text-white"
                      : isActive
                      ? "bg-slate-700 text-white"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }
                `}
                >
                  <CustomIcon name={item.icon} className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}

          {/* Mobile user menu */}
          {session ? (
            <div className="border-t border-slate-700 pt-4 mt-4">
              <div className="flex items-center px-3 py-2">
                <CustomIcon name="user" className="h-10 w-10 text-slate-300" />
                <div className="ml-3">
                  <div className="text-base font-medium text-white">
                    {session.user?.name}
                  </div>
                  <div className="text-sm font-medium text-slate-400">
                    {session.user?.email}
                  </div>
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors w-full text-left"
              >
                <CustomIcon name="logout" className="h-5 w-5" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <div className="border-t border-slate-700 pt-4 mt-4">
              <button
                onClick={() => signIn("google")}
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors w-full text-left"
              >
                <CustomIcon name="user" className="h-5 w-5" />
                <span>Sign in</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
