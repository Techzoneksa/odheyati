import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'توثيقات أضحيتي',
  description: 'نظام توثيق طلبات متجر أضحيتي',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-background-cream">{children}</body>
    </html>
  );
}