import type { AgentConfig } from '../types';

// Colors sampled directly from the original agent avatars (base / mid / light),
// plus a glow tone used for light effects and a readable text tint.
export interface AgentPalette {
  base: string;
  mid: string;
  light: string;
  glow: string;
  text: string;
}

export const PALETTES: Record<string, AgentPalette> = {
  portfolio: { base: '#9b5656', mid: '#b26262', light: '#cc7575', glow: '#ff8f84', text: '#f3a59d' },
  coder: { base: '#47702c', mid: '#548732', light: '#61a535', glow: '#93e05f', text: '#a9dd82' },
  researcher: { base: '#234c75', mid: '#2b5f89', light: '#3d7eaa', glow: '#62b3ff', text: '#93c7f3' },
  forge: { base: '#5a5a5c', mid: '#69696c', light: '#808083', glow: '#d3d7de', text: '#c9cdd4' },
};

export const paletteFor = (agent: Pick<AgentConfig, 'avatarType'>): AgentPalette =>
  PALETTES[agent.avatarType] || PALETTES.forge;
