import ChatWidget from '../../components/ChatWidget';

export const dynamic = 'force-dynamic';

export default function ChatEmbedPage() {
  return (
    <div style={{ margin: 0, padding: 0, background: '#fff8f2', minHeight: '100vh' }}>
      <ChatWidget embedded={true} />
    </div>
  );
}