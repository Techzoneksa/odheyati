'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import ChatWidget from './ChatWidget';

export default function ChatWidgetWrapper() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/settings/chat')
      .then(r => r.json())
      .then(d => setEnabled(d.enabled))
      .catch(() => setEnabled(true));
  }, []);

  if (pathname?.startsWith('/dashboard')) return null;
  if (!enabled) return null;
  return <ChatWidget />;
}
