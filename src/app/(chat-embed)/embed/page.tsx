import ChatWidget from '../../components/ChatWidget';

export const dynamic = 'force-dynamic';

export default function ChatEmbedPage() {
  return (
    <div style={{ margin: 0, padding: 0, background: '#fff8f2', minHeight: '100vh' }}>
      <style>{`
        .chat-fab { display: none !important; }
        .chat-window {
          position: relative !important;
          bottom: auto !important;
          left: auto !important;
          right: auto !important;
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
          max-height: 100% !important;
          border-radius: 0 !important;
          z-index: 0 !important;
        }
      `}</style>
      <ChatWidget embedded={true} />
    </div>
  );
}