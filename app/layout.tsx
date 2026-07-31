import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// globals.css names 'Inter' as the app font, but nothing ever actually loaded
// it — no next/font, no <link>, no @font-face — so every browser without
// Inter pre-installed silently fell back to its generic sans-serif, and that
// fallback typically only has true Regular/Bold masters. font-medium (500)
// and font-semibold (600) buttons were rendered as browser-substituted
// weights instead of two weights of one real typeface, which is why
// same-purpose buttons could look like they used different fonts entirely.
// next/font self-hosts the font file at build time (no runtime call to
// Google's CDN), which matches this app's offline/on-premise deployment.
const inter = Inter({ subsets: ['latin'], display: 'swap' });

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
    <html lang="en" className={`${inter.className} overflow-x-hidden max-w-full`}>
      <body className="bg-gray-50 overflow-x-hidden max-w-full min-h-screen">
        {children}
      </body>
    </html>
  );
}
