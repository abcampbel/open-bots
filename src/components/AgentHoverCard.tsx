import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AgentConfig } from '../types';
import { ArrowUp } from 'lucide-react';
import { AgentAvatar } from './AgentAvatar';
import { paletteFor } from '../lib/palette';

interface AgentHoverCardProps {
  agent: AgentConfig;
  onSelect: (agent: AgentConfig, initialPrompt?: string) => void;
  side?: 'left' | 'right';
}

export const AgentHoverCard: React.FC<AgentHoverCardProps> = ({ agent, onSelect, side = 'right' }) => {
  const [miniPrompt, setMiniPrompt] = useState('');
  const palette = paletteFor(agent);

  const handleInputTrigger = () => {
    onSelect(agent, miniPrompt.trim() || undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(agent, miniPrompt.trim() || undefined);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: side === 'right' ? -10 : 10, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: side === 'right' ? -6 : 6, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 460, damping: 32 }}
      className="relative w-[320px] p-4 rounded-[20px] text-left select-text pointer-events-auto backdrop-blur-xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(27,29,36,0.94), rgba(18,19,24,0.96))',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: `0 30px 60px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.4), 0 0 50px -20px ${palette.glow}66`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Agent-colored light along the top edge */}
      <div
        className="absolute inset-x-6 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${palette.glow}, transparent)` }}
      />

      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `radial-gradient(circle at 50% 30%, ${palette.glow}26, transparent 70%)` }}
        >
          <AgentAvatar type={agent.avatarType} avatarUrl={agent.avatarUrl} size="sm" alt={agent.name} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-[14px] font-semibold tracking-[0.04em] text-fg">{agent.name}</span>
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </span>
          </div>
          <p className="text-[12px] text-fg-3 truncate">{agent.role}</p>
        </div>
      </div>

      <p className="text-[13.5px] text-fg leading-snug mb-1.5">{agent.personality.greeting}</p>
      <p className="text-[12.5px] text-fg-2 leading-relaxed line-clamp-2 mb-3">{agent.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3.5">
        {agent.specialties.slice(0, 3).map((spec, idx) => (
          <span
            key={idx}
            className="text-[11px] px-2 py-[3px] rounded-full"
            style={{ color: palette.text, background: `${palette.glow}14`, border: `1px solid ${palette.glow}26` }}
          >
            {spec}
          </span>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={miniPrompt}
          onChange={(e) => setMiniPrompt(e.target.value)}
          onClick={handleInputTrigger}
          onFocus={handleInputTrigger}
          placeholder={`Ask ${agent.name} anything…`}
          className="w-full h-10 pl-4 pr-11 text-[13px] rounded-full bg-black/40 border border-white/10 text-fg placeholder:text-fg-3 focus:outline-none focus:border-white/25 cursor-pointer transition-colors hover:border-white/20"
        />
        <button
          type="submit"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-ink transition-transform hover:scale-105"
          style={{ background: palette.glow }}
          title="Open chat and send"
          aria-label="Open chat and send"
        >
          <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </form>

      <div className="flex items-center justify-between mt-2.5 px-1 text-[11.5px] text-fg-3">
        <button type="button" onClick={handleInputTrigger} className="hover:text-fg-2 transition-colors">
          Click to open the full chat
        </button>
        <span>Agnes 2.5 Pro</span>
      </div>
    </motion.div>
  );
};
