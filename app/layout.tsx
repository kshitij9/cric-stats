import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import AppHeader from '@/components/AppHeader';
import CoverageNote from '@/components/CoverageNote';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CricIntell – player stats and match picks',
  description:
    'Player profiles, side-by-side comparison and matchup-based picks for the IPL and international cricket.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        <AppHeader />
        <main className="mx-auto min-h-[70vh] max-w-6xl space-y-6 px-4 py-6 md:py-8">
          {children}
        </main>
        <CoverageNote />
      </body>
    </html>
  );
}
