import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/tailwind.css';
import { AuthProvider } from '@/contexts/AuthContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a1a2e',
};

export const metadata: Metadata = {
  title: 'Finanzas — Control financiero personal',
  description:
    'Controla tus finanzas diarias, presupuesto mensual, ahorros, deudas e inversiones en un solo lugar.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Finanzas',
  },
  icons: {
    icon: [{ url: '/assets/images/app_logo.png', type: 'image/png' }],
    apple: [{ url: '/assets/images/app_logo.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <meta name="application-name" content="Finanzas" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Finanzas" />
        <meta name="msapplication-TileColor" content="#1a1a2e" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="apple-touch-icon" href="/assets/images/app_logo.png" />
        <link rel="apple-touch-startup-image" href="/assets/images/app_logo.png" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <script src="/register-sw.js" defer />
      </body>
    </html>
  );
}
