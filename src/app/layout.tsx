import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

import PWAStandaloneGuard from '@/components/pwa/PWAStandaloneGuard';
import PWAInstallPrompt from '@/components/pwa/PWAInstallPrompt';
import { ToastProvider } from '@/components/ui/Toast';
import SchemaMarkup from '@/components/layout/SchemaMarkup';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  preload: true,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#020617',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.primetekglobalsolutions.com'),
  title: {
    default: 'Primetek Global Solutions | Staffing & Consulting',
    template: '%s | Primetek Global Solutions',
  },
  description:
    'Leading US-based staffing and consulting firm specializing in IT, Healthcare, Finance, Manufacturing, and Talent Acquisition.',
  keywords: [
    'IT Staffing',
    'Recruiting Company',
    'Talent Acquisition',
    'C2C Staffing',
    'Contract Staffing',
    'Contract-to-Hire',
    'Full-Time Recruitment',
    'Consulting Services',
    'Primetek',
    'Primetek Global Solutions',
    'Birmingham Alabama Staffing',
  ],
  authors: [{ name: 'Primetek Global Solutions' }],
  creator: 'Primetek Global Solutions',
  publisher: 'Primetek Global Solutions',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Primetek Portal',
    startupImage: [
      {
        url: '/splash/apple-splash-640-1136.png',
        media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/splash/apple-splash-750-1334.png',
        media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/splash/apple-splash-1170-2532.png',
        media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/splash/apple-splash-1290-2796.png',
        media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)',
      },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.primetekglobalsolutions.com',
    siteName: 'Primetek Global Solutions',
    title: 'Primetek Global Solutions | Staffing & Consulting',
    description: 'Leading US-based staffing and consulting firm specializing in IT, Healthcare, Finance, Manufacturing, and Talent Acquisition.',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Primetek Global Solutions — US-Based IT Staffing & Consulting',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Primetek Global Solutions | Staffing & Consulting',
    description: 'Leading US-based staffing and consulting firm specializing in IT, Healthcare, Finance, Manufacturing, and Talent Acquisition.',
    images: ['/opengraph-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || 'eMOo4ExCO99sPtGufiKsizz5pJcV-8wzTo3BypIuPBE',
    other: {
      'msvalidate.01': [process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || 'bing_verification_code'],
    },
  },
};

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://www.primetekglobalsolutions.com/#organization",
  "name": "Primetek Global Solutions",
  "url": "https://www.primetekglobalsolutions.com",
  "logo": "https://www.primetekglobalsolutions.com/favicon.svg",
  "sameAs": [
    "https://www.linkedin.com/company/primetek-global-solutions-llc"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-219-345-6559",
    "contactType": "HR and Sales Support",
    "areaServed": "US",
    "availableLanguage": "en"
  },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "1680, Unit 2G, 14th Ave S",
    "addressLocality": "Birmingham",
    "addressRegion": "AL",
    "postalCode": "35205",
    "addressCountry": "US"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-1NL15P2C1V';
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

  return (
    <html lang="en" className={`h-full antialiased overflow-x-hidden ${inter.variable} ${playfair.variable}`}>
      <head>
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Google Analytics 4 */}
        {gaId && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaId}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        )}
      </head>
      <body className="h-full flex flex-col overflow-x-hidden w-full">

        {/* Microsoft Clarity */}
        {clarityId && (
          <Script id="microsoft-clarity" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window,document,"clarity","script","${clarityId}");
            `}
          </Script>
        )}

        <SchemaMarkup schema={orgSchema} />
        <ToastProvider>
          {children}
        </ToastProvider>
        <PWAStandaloneGuard />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}


