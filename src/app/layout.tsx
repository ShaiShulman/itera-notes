import type { Metadata } from "next";
import { Geist, Geist_Mono, Righteous } from "next/font/google";
import "./globals.css";
import MainLayout from "@/components/layout/MainLayout";
import { ItineraryProvider } from "@/contexts/ItineraryContext";
import { LastItineraryProvider } from "@/contexts/LastItineraryContext";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const righteous = Righteous({
  variable: "--font-righteous",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "BreadCrumbs | Your Intelligent Travel Planner",
  description:
    "Plan your travel itineraries with our intelligent, places-aware notebook and interactive map visualization.",
  keywords: [
    "travel",
    "itinerary",
    "planner",
    "map",
    "places",
    "vacation",
    "trip",
  ],
  authors: [{ name: "Shai Shulman" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${righteous.variable} antialiased h-full`}
      >
        <SessionProvider>
          <AuthProvider>
            <LastItineraryProvider>
              <ItineraryProvider>
                <MainLayout>{children}</MainLayout>
              </ItineraryProvider>
            </LastItineraryProvider>
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
