import { create } from 'zustand';
import type { ChatMessage, PatternGenerationStatus } from '../types';

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  generationStatus: PatternGenerationStatus;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  appendToMessage: (id: string, chunk: string) => void;
  setMessageStreaming: (id: string, streaming: boolean) => void;
  setGenerationStatus: (status: PatternGenerationStatus) => void;
  toggleChat: () => void;
  clearMessages: () => void;
}

let msgCounter = 0;

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isOpen: false,
  generationStatus: { step: 'idle', message: '' },

  addMessage: (msg) => {
    const id = `msg-${++msgCounter}`;
    set(s => ({
      messages: [...s.messages, {
        ...msg,
        id,
        timestamp: new Date().toISOString(),
      }],
    }));
    return id;
  },

  appendToMessage: (id, chunk) => set(s => ({
    messages: s.messages.map(m =>
      m.id === id ? { ...m, content: m.content + chunk } : m
    ),
  })),

  setMessageStreaming: (id, streaming) => set(s => ({
    messages: s.messages.map(m =>
      m.id === id ? { ...m, isStreaming: streaming } : m
    ),
  })),

  setGenerationStatus: (status) => set({ generationStatus: status }),
  toggleChat: () => set(s => ({ isOpen: !s.isOpen })),
  clearMessages: () => set({ messages: [] }),
}));
