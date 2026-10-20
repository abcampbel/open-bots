import React, { useState, useRef, useEffect, useLayoutEffect, Suspense, lazy } from 'react';
import { motion } from 'motion/react';
import { AgentConfig, ChatMessage } from '../types';
import { AgentAvatar } from './AgentAvatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, ArrowUp, RotateCcw, Copy, Check, AlertCircle, Terminal, Search, Globe, Plug, Coins, Wrench } from 'lucide-react';
import type { ToolAction } from '../types';
import { paletteFor } from '../lib/palette';
import { hasWebGL, WebGLBoundary } from './three/support';
import type { AgentMood } from './three/AgentFigure';

const ChatAgentStage = lazy(() => import('./three/ChatAgentStage').then((m) => ({ default: m.ChatAgentStage })));

interface ChatWindowProps {
  agent: AgentConfig;
  messages: ChatMessage[];
  isLoading: boolean;
  initialPrompt?: string;
  onSendMessage: (text: string) => void;
  onClose: () => void;
  onClearHistory: () => void;
}

const MOOD_LABEL: Record<AgentMood, string> = {
  idle: 'Ready',
  attention: 'Ready',
  speaking: 'Answering',
  talking: 'Answering',
  thinking: 'Thinking',
  error: 'Request failed',
};

/** Derives the 3D agent's mood from chat state: thinking while waiting, talking right after a reply. */
function useAgentMood(messages: ChatMessage[], isLoading: boolean): AgentMood {
  const last = messages[messages.length - 1];
  const firstSeenId = useRef(last?.id);
  const [burst, setBurst] = useState<{ id: string; error: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!last || last.sender !== 'agent' || last.id === firstSeenId.current) return;
    setBurst({ id: last.id, error: !!last.error });
    const t = window.setTimeout(() => setBurst(null), last.error ? 1400 : 3400);
    return () => window.clearTimeout(t);
    // Re-run only when a new message arrives, not on every re-render of the same message
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id]);

  if (isLoading) return 'thinking';
  if (burst) return burst.error ? 'error' : 'talking';
  return 'idle';
}


const toolIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('search')) return Search;
  if (n.includes('page')) return Globe;
  if (n.includes('sandbox')) return Terminal;
  if (n.includes('x402')) return Coins;
  if (n.includes('api')) return Plug;
  return Wrench;
};

const ToolTrail: React.FC<{ tools: ToolAction[]; glow: string }> = ({ tools, glow }) => {
  const [open, setOpen] = useState(false);
  if (!tools.length) return null;
  const shown = open ? tools : tools.slice(0, 3);
  return (
    <div className="mb-3 flex flex-col gap-1.5">
      {shown.map((t) => {
        const Icon = toolIcon(t.name);
        return (
          <div key={t.id} className="flex items-center gap-2 min-w-0 text-[12px]">
            <span
              className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: `${glow}14`, color: t.status === 'failed' ? '#fda4af' : glow }}
            >
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span className="shrink-0 text-fg-2">{t.name}</span>
            {t.detail && <span className="truncate text-fg-3 font-mono text-[11.5px]">{t.detail}</span>}
            {t.status === 'failed' && <span className="shrink-0 text-rose-300">failed</span>}
          </div>
        );
      })}
      {tools.length > 3 && (
        <button type="button" onClick={() => setOpen(!open)} className="self-start text-[11.5px] text-fg-3 hover:text-fg-2 pl-8">
          {open ? 'Show fewer steps' : `Show all ${tools.length} steps`}
        </button>
      )}
    </div>
  );
};

export const ChatWindow: React.FC<ChatWindowProps> = ({
  agent,
  messages,
  isLoading,
  initialPrompt,
  onSendMessage,
  onClose,
  onClearHistory,
}) => {
  const [inputText, setInputText] = useState(initialPrompt || '');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const palette = paletteFor(agent);
  const mood = useAgentMood(messages, isLoading);
  const webgl = hasWebGL();

  // If initialPrompt was passed, optionally focus or send
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      onSendMessage(initialPrompt.trim());
      setInputText('');
    }
    // Send the prompt from the hover card exactly once when the chat opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (messages.length === 0 && !isLoading) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus textarea on open
  useEffect(() => {
    textareaRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const cssVars = { ['--agent-glow' as any]: palette.glow, ['--agent-text' as any]: palette.text } as React.CSSProperties;
  const statusColor = mood === 'error' ? '#ff6b6b' : mood === 'idle' ? '#4ade80' : palette.glow;

  const avatarFallback = (
    <div className="absolute inset-0 flex items-center justify-center">
      <AgentAvatar type={agent.avatarType} avatarUrl={agent.avatarUrl} size="xl" isHovered alt={agent.name} />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        id={`chat-window-${agent.id}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${agent.name}`}
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 18 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={cssVars}
        className="relative w-full max-w-[1100px] h-full sm:h-[min(88vh,800px)] flex flex-col md:flex-row sm:rounded-[28px] overflow-hidden border border-white/[0.08] bg-ink shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
      >
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 flex items-center gap-1.5">
          <button
            onClick={onClearHistory}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] text-fg-2 hover:text-fg transition-colors"
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] text-fg-2 hover:text-fg transition-colors"
            title="Close (Esc)"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ---------- Agent stage ---------- */}
        <aside className="relative shrink-0 h-[150px] md:h-auto md:w-[320px] overflow-hidden md:border-r border-b md:border-b-0 border-white/[0.06]">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(70% 55% at 50% 62%, ${palette.glow}26, transparent 70%), linear-gradient(180deg, #15171d 0%, #0e0f13 100%)`,
            }}
          />
          <div className="absolute top-0 bottom-0 right-14 left-[42%] md:right-0 md:left-0 md:top-6 md:bottom-[150px]">
            {webgl ? (
              <WebGLBoundary fallback={avatarFallback}>
                <Suspense fallback={avatarFallback}>
                  <ChatAgentStage agent={agent} mood={mood} />
                </Suspense>
              </WebGLBoundary>
            ) : (
              avatarFallback
            )}
          </div>

          <div className="absolute left-5 bottom-5 md:left-6 md:right-6 md:bottom-6">
            <h2 className="font-display text-[22px] md:text-[26px] font-semibold tracking-[0.02em] text-fg leading-none">{agent.name}</h2>
            <p className="text-[12.5px] text-fg-2 mt-1.5">{agent.role}</p>
            <div className="mt-3 inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white/[0.05] border border-white/[0.07] text-[12px] text-fg" aria-live="polite">
              <span className="relative flex w-2 h-2">
                {mood !== 'idle' && <span className="absolute inset-0 rounded-full animate-ping opacity-70" style={{ background: statusColor }} />}
                <span className="relative w-2 h-2 rounded-full" style={{ background: statusColor }} />
              </span>
              {MOOD_LABEL[mood]}
            </div>
            <p className="hidden md:block mt-4 text-[11.5px] text-fg-3">Agnes 2.5 Pro core</p>
          </div>
        </aside>

        {/* ---------- Conversation ---------- */}
        <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-6 md:pt-16 pb-6 space-y-5">
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="max-w-xl mx-auto pt-6 sm:pt-14"
              >
                <p className="font-display text-[18px] sm:text-[26px] font-medium tracking-[-0.02em] leading-[1.2] text-fg">
                  {agent.personality.greeting}
                </p>
                <p className="mt-4 text-[14px] text-fg-2 leading-relaxed">{agent.description}</p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {agent.specialties.map((spec, idx) => (
                    <span
                      key={idx}
                      className="text-[12px] px-2.5 py-1 rounded-full"
                      style={{ color: palette.text, background: `${palette.glow}12`, border: `1px solid ${palette.glow}24` }}
                    >
                      {spec}
                    </span>
                  ))}
                </div>

              </motion.div>
            )}

            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="flex items-start gap-3 max-w-[min(100%,46rem)] group">
                      <div className="shrink-0 pt-0.5">
                        <AgentAvatar type={agent.avatarType} avatarUrl={agent.avatarUrl} size="sm" alt={agent.name} />
                      </div>

                      <div
                        className={`min-w-0 rounded-[20px] rounded-tl-md px-4 py-3.5 sm:px-5 sm:py-4 ${
                          msg.error ? 'bg-rose-950/40 border border-rose-500/30 text-rose-100' : 'bg-ink-2 border border-white/[0.06] text-fg'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1.5">
                          <span className="font-display text-[12px] font-semibold tracking-[0.06em]" style={{ color: msg.error ? '#fda4af' : palette.text }}>
                            {agent.name}
                          </span>
                          <button
                            onClick={() => copyToClipboard(msg.text, msg.id)}
                            className="p-1 -m-1 rounded-md text-fg-3 hover:text-fg opacity-60 group-hover:opacity-100 transition"
                            title="Copy message"
                            aria-label="Copy message"
                          >
                            {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {!msg.error && msg.toolsUsed && msg.toolsUsed.length > 0 && <ToolTrail tools={msg.toolsUsed} glow={palette.glow} />}
                        {msg.error ? (
                          <div className="flex items-start gap-2 text-[14px] text-rose-200">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="whitespace-pre-wrap">{msg.text}</span>
                          </div>
                        ) : (
                          <div className="agent-md text-[14.5px] leading-[1.65] text-fg/90 break-words">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ node: _node, className, children, ...props }) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  const isInline = !match && !String(children).includes('\n');
                                  return !isInline ? (
                                    <div className="my-3 rounded-xl overflow-hidden border border-white/[0.07] bg-[#0a0b0e]">
                                      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] text-[11.5px] text-fg-3">
                                        <span className="flex items-center gap-1.5">
                                          <Terminal className="w-3.5 h-3.5" />
                                          {match ? match[1] : 'code'}
                                        </span>
                                        <button
                                          onClick={() => copyToClipboard(String(children), `code-${Math.random()}`)}
                                          className="hover:text-fg transition-colors"
                                        >
                                          Copy
                                        </button>
                                      </div>
                                      <pre className="p-4 overflow-x-auto text-[12.5px] font-mono text-fg/90 leading-relaxed">
                                        <code>{children}</code>
                                      </pre>
                                    </div>
                                  ) : (
                                    <code className="px-1.5 py-0.5 rounded-md bg-white/[0.07] text-fg text-[0.86em] font-mono" {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                              }}
                            >
                              {msg.text}
                            </ReactMarkdown>
                          </div>
                        )}

                        <div className="mt-2 text-right text-[11px] text-fg-3">{time}</div>
                      </div>
                    </div>
                  )}

                  {isUser && (
                    <div className="max-w-[min(85%,36rem)] rounded-[20px] rounded-tr-md px-4 py-3 bg-fg text-ink">
                      <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{msg.text}</p>
                      <div className="mt-1 text-right text-[11px] text-ink/50">{time}</div>
                    </div>
                  )}
                </motion.div>
              );
            })}

            {isLoading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
                <div className="shrink-0 pt-0.5">
                  <AgentAvatar type={agent.avatarType} avatarUrl={agent.avatarUrl} size="sm" alt={agent.name} />
                </div>
                <div className="px-4 py-3 rounded-[20px] rounded-tl-md bg-ink-2 border border-white/[0.06] flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="think-dot" />
                    <span className="think-dot" />
                    <span className="think-dot" />
                  </span>
                  <span className="text-[13px] text-fg-2">{agent.name} is thinking</span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ---------- Composer ---------- */}
          <div className="px-3 sm:px-8 pb-3 sm:pb-6 pt-2">
            <div
              className="flex items-end gap-2 p-2 pl-4 rounded-[22px] bg-ink-2 border border-white/[0.08] focus-within:border-white/20 transition-colors"
              style={{ boxShadow: `0 0 40px -18px ${palette.glow}55` }}
            >
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${agent.name}…`}
                rows={1}
                className="flex-1 bg-transparent border-0 text-[15px] text-fg placeholder:text-fg-3 focus:ring-0 focus:outline-none resize-none max-h-40 py-2.5 leading-relaxed"
                style={{ minHeight: '44px' }}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isLoading}
                className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-ink transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
                style={{ background: palette.glow }}
                title="Send message"
                aria-label="Send message"
              >
                <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
            <div className="hidden sm:flex items-center justify-between mt-2.5 px-2 text-[11.5px] text-fg-3">
              <span>Enter to send, Shift + Enter for a new line</span>
              <span>OpenBots, powered by Agnes 2.5 Pro</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
