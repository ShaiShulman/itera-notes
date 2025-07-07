"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

const navigationItems = [
  {
    name: "Create Itinerary",
    href: "/create-itinerary",
    icon: PlusIcon,
    primary: true,
  },
  {
    name: "Itinerary Planner",
    href: "/",
    icon: MapIcon,
  },
  {
    name: "My Itineraries",
    href: "/itineraries",
    icon: ListBulletIcon,
  },
  {
    name: "Place Explorer",
    href: "/places",
    icon: MagnifyingGlassIcon,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Cog6ToothIcon,
  },
  {
    name: "Help",
    href: "/help",
    icon: QuestionMarkCircleIcon,
  },
];

export default function TopNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-slate-900 border-b border-slate-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-white">
                Smart Travel Planner
              </h1>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-2">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2
                      ${
                        item.primary
                          ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                          : isActive
                          ? "bg-slate-700 text-white"
                          : "text-slate-300 hover:bg-slate-700 hover:text-white"
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
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
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

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
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
