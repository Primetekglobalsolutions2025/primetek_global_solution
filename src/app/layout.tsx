import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

import PWAStandaloneGuard from '@/components/pwa/PWAStandaloneGuard';
import PWAInstallPrompt from '@/components/pwa/PWAInstallPrompt';
import { ToastProvider } from '@/components/ui/Toast';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
});

export const metadata: Metadata = {
  title: {
    default: 'Primetek Global Solutions | Staffing & Consulting',
    template: '%s | Primetek Global Solutions',
  },
  description:
    'Leading staffing and consulting firm specializing in IT, Healthcare, Finance, and Manufacturing.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Primetek Portal',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased overflow-x-hidden ${inter.variable} ${playfair.variable}`}>
      <body className="min-h-full flex flex-col overflow-x-hidden w-full">
        <ToastProvider>
          {children}
        </ToastProvider>
        <PWAStandaloneGuard />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
