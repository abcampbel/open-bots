import { describe, it, expect } from 'vitest';
import { INITIAL_AGENTS } from '../src/lib/agents';
import { PALETTES, paletteFor } from '../src/lib/palette';

describe('agent roster', () => {
  it('has four agents with unique, stable ids', () => {
    expect(INITIAL_AGENTS.map((a) => a.id)).toEqual(['vex', 'byte', 'pulse', 'morph']);
  });

  it('uses the Greek-god names everywhere in the persona', () => {
    const names = ['PLUTUS', 'HEPHAESTUS', 'HERMES', 'PROTEUS'];
    INITIAL_AGENTS.forEach((a, i) => {
      expect(a.name).toBe(names[i]);
      expect(a.systemPrompt).toContain(`**${a.name}**`);
      expect(a.personality.greeting).toContain(a.name);
      expect(a.systemPrompt).not.toMatch(/\b(VEX|BYTE|PULSE|MORPH)\b/);
    });
  });

  it('gives every agent a palette, avatar and idle phrases', () => {
    for (const a of INITIAL_AGENTS) {
      expect(PALETTES[a.avatarType]).toBeDefined();
      expect(paletteFor(a).glow).toMatch(/^#[0-9a-f]{6}$/i);
      expect(a.avatarUrl).toMatch(/^\/avatars\//);
      expect(a.personality.idlePhrases.length).toBeGreaterThan(2);
      expect(a.specialties.length).toBeGreaterThan(2);
    }
  });

  it('falls back to the neutral palette for unknown avatar types', () => {
    expect(paletteFor({ avatarType: 'unknown' as any })).toBe(PALETTES.forge);
  });
});
