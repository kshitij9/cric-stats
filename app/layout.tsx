import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CoverageNote from "@/components/CoverageNote";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'CricIntell – Era-Aware Cricket Profiles',
  description: 'Explore player matchups, era-adjusted performance, and multi-player comparisons powered by Postgres.',
  openGraph: {
    title: 'CricIntell – Era-Aware Cricket Profiles',
    description: 'Compare cricket greats across eras with advanced stats and visuals.',
    url: 'https://cric-stats-one.vercel.app',
    siteName: 'CricIntell',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CricIntell – Era-Aware Cricket Profiles',
    description: 'Compare players, matchups, and era index at a glance.',
  },
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
        <CoverageNote />
        {children}
      </body>
    </html>
  );
}
