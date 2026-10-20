import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SpeechBubbleProps {
  text: string | null;
  agentName: string;
  accentColor?: string;
  glow?: string;
  isVisible: boolean;
  compact?: boolean;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ text, isVisible, glow = '#ffffff', compact = false }) => {
  return (
    <AnimatePresence>
      {isVisible && text && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          className={`pointer-events-none origin-bottom ${compact ? 'w-[190px]' : 'whitespace-nowrap'}`}
        >
          <div
            className={`relative flex items-center gap-2 pl-3 pr-3.5 py-2 rounded-2xl text-fg backdrop-blur-md ${compact ? 'text-[11.5px] leading-snug' : 'text-[12.5px]'}`}
            style={{
              background: 'rgba(21, 23, 29, 0.88)',
              border: `1px solid ${glow}33`,
              boxShadow: `0 10px 30px -10px rgba(0,0,0,0.8), 0 0 24px -8px ${glow}55`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: glow, boxShadow: `0 0 8px ${glow}` }} />
            {text}
            <span
              className={`absolute -bottom-[5px] -translate-x-1/2 w-2.5 h-2.5 rotate-45 ${compact ? 'hidden' : 'left-1/2'}`}
              style={{ background: 'rgba(21, 23, 29, 0.95)', borderRight: `1px solid ${glow}33`, borderBottom: `1px solid ${glow}33` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
