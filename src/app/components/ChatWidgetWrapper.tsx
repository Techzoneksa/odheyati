'use client';

import { usePathname } from 'next/navigation';
import ChatWidget from './ChatWidget';

export default function ChatWidgetWrapper() {
  const pathname = usePathname();

  if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/api') || pathname?.startsWith('/proof')) {
    return null;
  }

  return <ChatWidget />;
}