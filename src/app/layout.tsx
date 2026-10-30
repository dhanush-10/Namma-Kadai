import type { Metadata, Viewport } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n/provider';
import { RegisterSW } from '@/components/layout/RegisterSW';

export const metadata: Metadata = {
  title: { default: 'NAMMA KADAI', template: '%s · NAMMA KADAI' },
  description: 'Smart Shop. Simple Accounts. — grocery credit ledger',
  applicationName: 'NAMMA KADAI',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'நம்ம கடை', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#0b6347', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ta">
      <body>
        <I18nProvider>{children}</I18nProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
