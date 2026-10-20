import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AgentConfig } from '../types';
import { AgentAvatar } from './AgentAvatar';
import { AgentHoverCard } from './AgentHoverCard';
import { SpeechBubble } from './SpeechBubble';
import { paletteFor } from '../lib/palette';

interface AgentNodeProps {
  agent: AgentConfig;
  currentSpeech: string | null;
  onSelect: (agent: AgentConfig, initialPrompt?: string) => void;
  side?: 'left' | 'right';
}

/** 2D fallback used when WebGL is unavailable. */
export const AgentNode: React.FC<AgentNodeProps> = ({ agent, currentSpeech, onSelect, side = 'right' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const palette = paletteFor(agent);

  return (
    <div
      className={`relative flex flex-col items-center select-none py-2 ${isHovered ? 'z-40' : 'z-10'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`absolute top-1/2 -translate-y-1/2 hidden md:block ${side === 'right' ? 'left-[calc(100%+12px)]' : 'right-[calc(100%+12px)]'}`}
      >
        <AnimatePresence>{isHovered && <AgentHoverCard agent={agent} onSelect={onSelect} side={side} />}</AnimatePresence>
      </div>

      <div className="absolute -top-12 left-1/2 -translate-x-1/2">
        <SpeechBubble text={currentSpeech} agentName={agent.name} glow={palette.glow} isVisible={!isHovered && !!currentSpeech} />
      </div>

      <motion.button
        type="button"
        onClick={() => onSelect(agent)}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="group flex flex-col items-center"
      >
        <div className="relative mb-3">
          <div
            className="absolute inset-x-0 -bottom-3 h-6 rounded-[50%] blur-md transition-opacity"
            style={{ background: palette.glow, opacity: isHovered ? 0.45 : 0.18 }}
          />
          <AgentAvatar type={agent.avatarType} avatarUrl={agent.avatarUrl} size="xl" isHovered={isHovered} alt={agent.name} />
        </div>
        <span className="font-display text-[13px] font-semibold tracking-[0.06em]" style={{ color: isHovered ? palette.text : undefined }}>
          {agent.name}
        </span>
        <span className="text-[11.5px] text-fg-3 mt-0.5">{agent.role}</span>
      </motion.button>
    </div>
  );
};
