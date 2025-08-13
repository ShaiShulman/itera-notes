import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MainLayout from "@/components/layout/MainLayout";
import { ItineraryProvider } from "@/contexts/ItineraryContext";
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

export const metadata: Metadata = {
  title: "Smart Travel Planner",
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
  authors: [{ name: "Smart Travel Planner Team" }],
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <AuthProvider>
            <ItineraryProvider>
              <MainLayout>{children}</MainLayout>
            </ItineraryProvider>
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
