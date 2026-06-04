import ChatWidget from '../../components/ChatWidget';

export const dynamic = 'force-dynamic';

export default function ChatEmbedPage() {
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999 }}>
      <ChatWidget />
    </div>
  );
}