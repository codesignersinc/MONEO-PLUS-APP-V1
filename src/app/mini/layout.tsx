import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/Toast';

// MONEO Mini: its own installable app (public/mini.webmanifest) so it opens in a small
// window on the laptop, next to the full MONEO.
export const metadata: Metadata = {
  title: 'MONEO Mini',
  manifest: '/mini.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MONEO Mini' },
};

export default function MiniLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
