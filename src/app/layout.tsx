import type { Metadata } from 'next';
import './globals.css';
import ChatWidgetWrapper from './components/ChatWidgetWrapper';

export const metadata: Metadata = {
  title: 'توثيقات أضحيتي',
  description: 'نظام توثيق طلبات متجر أضحيتي',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-background-cream">
        {children}
        <ChatWidgetWrapper />
      </body>
    </html>
  );
}