import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'أضحيتي - مساعد الدردشة',
  description: 'مساعد دردشة متجر أضحيتي',
};

export default function ChatEmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, padding: 0, backgroundColor: 'transparent' }}>
        {children}
      </body>
    </html>
  );
}