import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';
import './ChatPanel.css';

export function ChatPanel() {
  const messages = useChatStore(s => s.messages);
  const isOpen = useChatStore(s => s.isOpen);
  const generationStatus = useChatStore(s => s.generationStatus);
  const toggleChat = useChatStore(s => s.toggleChat);
  const addMessage = useChatStore(s => s.addMessage);
  const appendToMessage = useChatStore(s => s.appendToMessage);
  const setMessageStreaming = useChatStore(s => s.setMessageStreaming);
  const setGenerationStatus = useChatStore(s => s.setGenerationStatus);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    addMessage({ role: 'user', content: text });
    setIsLoading(true);

    const assistantId = addMessage({ role: 'assistant', content: '', isStreaming: true });

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages.map(m => ({ role: m.role, content: m.content })) }),
      });

      if (!response.ok) throw new Error('API error');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'text') {
                appendToMessage(assistantId, parsed.content);
              } else if (parsed.type === 'status') {
                setGenerationStatus({ step: parsed.step, message: parsed.message });
              } else if (parsed.type === 'pattern_ready') {
                setGenerationStatus({ step: 'done', message: 'Pattern loaded onto canvas!' });
                // TODO: signal canvas to load pattern
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      appendToMessage(assistantId, 'Sorry, something went wrong. Please try again.');
      setGenerationStatus({ step: 'error', message: 'Connection error' });
    } finally {
      setMessageStreaming(assistantId, false);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const STATUS_ICONS: Record<string, string> = {
    refining: '🧠',
    'generating-image': '🎨',
    converting: '🔄',
    done: '✅',
    error: '❌',
  };

  return (
    <>
      {/* Toggle button */}
      <button
        className="chat-toggle"
        onClick={toggleChat}
        title="AI Design Assistant"
      >
        <span>✨</span>
        <span className="chat-toggle-label">AI Designer</span>
      </button>

      {isOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <div className="chat-title">
              <span>✨</span>
              <span>AI Needlepoint Designer</span>
            </div>
            <button className="chat-close" onClick={toggleChat}>✕</button>
          </div>

          {/* Generation status bar */}
          {generationStatus.step !== 'idle' && (
            <div className={`status-bar status-${generationStatus.step}`}>
              <span>{STATUS_ICONS[generationStatus.step] ?? '⏳'}</span>
              <span>{generationStatus.message}</span>
            </div>
          )}

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <div className="welcome-icon">🧵</div>
                <div className="welcome-title">Hello! I'm your AI needlepoint designer.</div>
                <div className="welcome-body">
                  Tell me what you'd like to stitch and I'll generate a pattern for you. You can also ask me about stitching techniques, thread colors, or canvas types.
                </div>
                <div className="welcome-examples">
                  <div className="example-label">Try asking:</div>
                  {[
                    'Design a golden retriever in autumn colors',
                    'Create a simple floral border pattern',
                    'Make a geometric diamond pattern in navy and gold',
                    'What stitch should I use for fine detail work?',
                  ].map(ex => (
                    <button
                      key={ex}
                      className="example-btn"
                      onClick={() => setInput(ex)}
                    >
                      "{ex}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '✨'}
                </div>
                <div className="message-content">
                  {msg.content}
                  {msg.isStreaming && <span className="cursor">▋</span>}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Describe a needlepoint design or ask a question..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={isLoading}
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
