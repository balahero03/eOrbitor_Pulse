import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'eOrbitor Pulse - CRM Platform',
  description: 'Enterprise CRM Platform for Local Deployment',
  icons: {
    icon: '/eOrbitor_logo.jpg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}
