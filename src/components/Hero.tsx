import React from 'react';
import { REPO_URL } from '../lib/links';
import { motion } from 'motion/react';
import { Terminal, Github } from 'lucide-react';

interface HeroProps {
  onOpenRunLocally: () => void;
}

const ease = [0.2, 0.8, 0.2, 1] as const;

export const Hero: React.FC<HeroProps> = ({ onOpenRunLocally }) => {
  return (
    <section className="relative z-10 shrink-0 text-center px-4 sm:px-6 pt-2 sm:pt-4">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="inline-flex items-center gap-2.5 h-8 pl-2.5 pr-3.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[12.5px] text-fg-2 mb-4 sm:mb-5"
      >
        <span className="grid grid-cols-2 gap-[2px]" aria-hidden>
          <span className="w-[5px] h-[5px] rounded-full bg-hephaestus" />
          <span className="w-[5px] h-[5px] rounded-full bg-hermes" />
          <span className="w-[5px] h-[5px] rounded-full bg-proteus" />
          <span className="w-[5px] h-[5px] rounded-full bg-plutus" />
        </span>
        Powered by <span className="text-fg font-medium">Agnes 2.5 Pro</span>
      </motion.div>

      <h1 className="font-display font-medium text-fg tracking-[-0.035em] leading-[1.02] text-[clamp(30px,4.3vw,60px)] max-w-[15ch] mx-auto">
        {['AI that does', 'more than chat.'].map((line, i) => (
          <span key={line} className="block overflow-hidden pb-[0.06em]">
            <motion.span
              className="block"
              initial={{ y: '105%' }}
              animate={{ y: 0 }}
              transition={{ duration: 0.9, delay: 0.08 + i * 0.1, ease }}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.45 }}
        className="mt-3 sm:mt-4 text-fg-2 text-[13.5px] sm:text-[16px] leading-relaxed max-w-[46ch] mx-auto"
      >
        An open-source agent-native system. Hover over any agent to inspect its capabilities, or click to send it a task.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.55 }}
        className="mt-5 flex flex-wrap items-center justify-center gap-2.5"
      >
        <button
          onClick={onOpenRunLocally}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-fg text-ink text-[14px] font-semibold hover:bg-white transition-colors shadow-[0_8px_30px_-8px_rgba(255,255,255,0.35)]"
        >
          <Terminal className="w-4 h-4" />
          Run locally
        </button>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/10 bg-white/[0.03] text-[14px] font-medium text-fg hover:bg-white/[0.08] hover:border-white/20 transition-colors"
        >
          <Github className="w-4 h-4 text-fg-2" />
          View on GitHub
        </a>
      </motion.div>
    </section>
  );
};
