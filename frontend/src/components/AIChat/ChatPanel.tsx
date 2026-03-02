import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useCanvasStore } from '../../store/canvasStore';
import type { StitchCell } from '../../types';
import './ChatPanel.css';

interface PendingPattern {
  cells: Record<string, StitchCell>;
  width: number;
  height: number;
  colors: { number: string; name: string; hex: string; r: number; g: number; b: number }[];
}

const STYLE_PRESETS = [
  'Victorian',
  'Modern',
  'Geometric',
  'Floral',
  'Abstract',
  'Holiday',
];

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
  const [usePaletteOnly, setUsePaletteOnly] = useState(false);
  const [pendingPattern, setPendingPattern] = useState<PendingPattern | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    if (!overrideText) setInput('');
    setLastPrompt(text);
    setPendingPattern(null);
    addMessage({ role: 'user', content: text });
    setIsLoading(true);

    const assistantId = addMessage({ role: 'assistant', content: '', isStreaming: true });

    // Gather canvas context
    const canvasState = useCanvasStore.getState();
    const { config, palette } = canvasState;
    const paletteConstraint = usePaletteOnly && palette.length > 0
      ? palette.map(c => c.number)
      : undefined;

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          canvasWidth: config.width,
          canvasHeight: config.height,
          colorCount: Math.max(palette.length, 25),
          dithering: true,
          paletteConstraint: paletteConstraint ?? null,
        }),
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
              } else if (parsed.type === 'pattern_ready' && parsed.pattern) {
                setGenerationStatus({ step: 'done', message: 'Pattern ready! Click "Load to Canvas" to apply.' });
                // Parse the pattern but don't auto-load — let user choose
                const patternData = parsed.pattern;
                const grid = patternData.Pattern ?? patternData.pattern;
                if (grid) {
                  const cells: Record<string, StitchCell> = {};
                  const gridCells = grid.Cells ?? grid.cells ?? {};
                  for (const [key, cell] of Object.entries(gridCells)) {
                    const c = cell as { Color?: string; color?: string; DmcNumber?: string; dmcNumber?: string; StitchType?: string; stitchType?: string };
                    cells[key] = {
                      color: c.Color ?? c.color ?? null,
                      dmcNumber: c.DmcNumber ?? c.dmcNumber ?? null,
                      stitchType: (c.StitchType ?? c.stitchType ?? 'tent') as StitchCell['stitchType'],
                    };
                  }
                  const w = grid.Width ?? grid.width;
                  const h = grid.Height ?? grid.height;

                  // Parse colors
                  const rawColors = patternData.Colors ?? patternData.colors ?? [];
                  const parsedColors = rawColors.map((uc: { DmcNumber?: string; dmcNumber?: string; Name?: string; name?: string; Hex?: string; hex?: string }) => {
                    const dmcNum = uc.DmcNumber ?? uc.dmcNumber ?? '';
                    const name = uc.Name ?? uc.name ?? '';
                    const hex = uc.Hex ?? uc.hex ?? '';
                    const r = parseInt(hex.slice(1, 3), 16) || 0;
                    const g = parseInt(hex.slice(3, 5), 16) || 0;
                    const b = parseInt(hex.slice(5, 7), 16) || 0;
                    return { number: dmcNum, name, hex, r, g, b };
                  });

                  setPendingPattern({ cells, width: w, height: h, colors: parsedColors });
                }
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

  const loadPatternToCanvas = () => {
    if (!pendingPattern) return;
    const canvasStore = useCanvasStore.getState();
    if (pendingPattern.width && pendingPattern.height) {
      canvasStore.setConfig({ width: pendingPattern.width, height: pendingPattern.height });
    }
    canvasStore.loadCells(pendingPattern.cells);
    for (const c of pendingPattern.colors) {
      if (c.number && c.hex) {
        canvasStore.addToPalette(c);
      }
    }
    setPendingPattern(null);
    setGenerationStatus({ step: 'done', message: 'Pattern loaded onto canvas!' });
  };

  const regeneratePattern = () => {
    if (!lastPrompt) return;
    sendMessage(lastPrompt + ' (generate a different variation)');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleStylePreset = (style: string) => {
    setInput(prev => {
      const trimmed = prev.trim();
      if (trimmed) return `${style} style: ${trimmed}`;
      return `Create a ${style.toLowerCase()} needlepoint design`;
    });
    inputRef.current?.focus();
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

            {/* Pattern preview with load/regenerate buttons */}
            {pendingPattern && (
              <div className="pattern-preview">
                <div className="pattern-preview-header">
                  Pattern Ready — {pendingPattern.width}x{pendingPattern.height}, {pendingPattern.colors.length} colors
                </div>
                <div className="pattern-preview-swatches">
                  {pendingPattern.colors.slice(0, 12).map(c => (
                    <div
                      key={c.number}
                      className="preview-swatch"
                      style={{ background: c.hex }}
                      title={`DMC ${c.number} - ${c.name}`}
                    />
                  ))}
                  {pendingPattern.colors.length > 12 && (
                    <span className="preview-more">+{pendingPattern.colors.length - 12}</span>
                  )}
                </div>
                <div className="pattern-preview-actions">
                  <button className="preview-btn preview-btn-primary" onClick={loadPatternToCanvas}>
                    Load to Canvas
                  </button>
                  <button
                    className="preview-btn preview-btn-secondary"
                    onClick={regeneratePattern}
                    disabled={isLoading}
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Style presets */}
          <div className="style-presets">
            {STYLE_PRESETS.map(style => (
              <button
                key={style}
                className="style-preset-btn"
                onClick={() => handleStylePreset(style)}
              >
                {style}
              </button>
            ))}
          </div>

          <div className="chat-input-area">
            <div className="chat-input-row">
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
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? '⏳' : '➤'}
              </button>
            </div>
            <label className="palette-constraint">
              <input
                type="checkbox"
                checked={usePaletteOnly}
                onChange={e => setUsePaletteOnly(e.target.checked)}
              />
              Use only my palette colors
            </label>
          </div>
        </div>
      )}
    </>
  );
}
