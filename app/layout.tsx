import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'eOrbitor Pulse - CRM Platform',
  description: 'Enterprise CRM Platform for Local Deployment',
  // Favicon comes from the app/icon.png file convention (the eOrbitor "e" mark).
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
