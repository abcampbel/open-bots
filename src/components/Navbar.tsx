import React from 'react';
import { REPO_URL, X_URL } from '../lib/links';
import { Terminal, Github } from 'lucide-react';

interface NavbarProps {
  onOpenRunLocally: () => void;
  onScrollToSection?: (sectionId: string) => void;
}

const XIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.33l4.38 5.79L17.75 3Zm-1.08 16.17h1.7L7.4 4.73H5.58l11.09 14.44Z" />
  </svg>
);

export const Navbar: React.FC<NavbarProps> = ({ onOpenRunLocally }) => {
  return (
    <header className="shrink-0 w-full relative z-30">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-16 sm:h-[72px] flex items-center justify-between">
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="flex items-center gap-2.5 rounded-lg"
          aria-label="OpenBots home"
        >
          <img src="/brand/logo-mark-128.png" alt="" width={32} height={32} className="w-8 h-8 select-none" draggable={false} />
          <span className="font-display text-[17px] tracking-[-0.01em] leading-none">
            <span className="font-normal text-fg-2">Open</span>
            <span className="font-semibold text-fg">Bots</span>
          </span>
        </a>

        <nav className="flex items-center gap-1 sm:gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex w-9 h-9 items-center justify-center rounded-full text-fg-2 hover:text-fg hover:bg-white/[0.06] transition-colors"
            aria-label="GitHub"
          >
            <Github className="w-[18px] h-[18px]" />
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex w-9 h-9 items-center justify-center rounded-full text-fg-2 hover:text-fg hover:bg-white/[0.06] transition-colors"
            aria-label="X (Twitter)"
          >
            <XIcon className="w-4 h-4" />
          </a>
          <button
            onClick={onOpenRunLocally}
            className="ml-1 inline-flex items-center gap-2 h-9 pl-3.5 pr-4 rounded-full border border-white/10 bg-white/[0.03] text-[13px] font-medium text-fg hover:bg-white/[0.08] hover:border-white/20 transition-colors"
          >
            <Terminal className="w-4 h-4 text-fg-2" />
            <span>Run locally</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
