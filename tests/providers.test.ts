import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { processChat, callLocalModel, getApiKeys } from '../api/chat';
import { mockFetch, json, bodyOf } from './helpers';

const ENV_KEYS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'LOCAL_MODEL_BASE_URL', 'LOCAL_MODEL_NAME', 'LOCAL_MODEL_API_KEY', 'XAI_API_KEY', 'GROK_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'API_KEY'];
const saved: Record<string, string | undefined> = {};

const marketRoutes = [
  { match: (u: string) => u.includes('open.er-api.com'), respond: () => json({ rates: { RUB: 82.5, EUR: 0.9, CNY: 7.1, KZT: 450 } }) },
  { match: (u: string) => u.includes('coingecko'), respond: () => json({ bitcoin: { usd: 82000 }, ethereum: { usd: 2400 }, solana: { usd: 100 } }) },
];

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getApiKeys', () => {
  it('defaults the hosted model and normalises the local base URL', () => {
    process.env.LOCAL_MODEL_BASE_URL = 'http://localhost:11434/v1///';
    const k = getApiKeys();
    expect(k.anthropicModel).toBe('claude-haiku-5-5');
    expect(k.localBaseUrl).toBe('http://localhost:11434/v1');
    expect(k.anthropicKey).toBeNull();
  });
});

describe('callLocalModel', () => {
  it('speaks the OpenAI-compatible chat completions protocol', async () => {
    const { calls } = mockFetch([
      { match: (u) => u === 'http://localhost:11434/v1/chat/completions', respond: () => json({ model: 'llama3.1', choices: [{ message: { content: ' local hi ' } }] }) },
    ]);
    const r = await callLocalModel('http://localhost:11434/v1', 'llama3.1', null, 'sys', [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'again' },
    ]);
    expect(r).toEqual({ reply: 'local hi', model: 'llama3.1' });
    const body = bodyOf(calls[0].init);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(body.messages.map((m: any) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect((calls[0].init!.headers as any).authorization).toBeUndefined();
  });

  it('sends a bearer token when configured and reports server errors', async () => {
    const { calls } = mockFetch([{ match: () => true, respond: () => json({ error: { message: 'model not found' } }, 404) }]);
    await expect(callLocalModel('http://x/v1', 'nope', 'secret', 's', [{ role: 'user', content: 'hi' }])).rejects.toThrow(/404.*model not found/);
    expect((calls[0].init!.headers as any).authorization).toBe('Bearer secret');
  });
});

describe('processChat provider routing', () => {
  const payload = { agentId: 'byte', agentName: 'HEPHAESTUS', systemPrompt: 'You are HEPHAESTUS.', messages: [{ role: 'user', content: 'hi' }] };

  it('validates input', async () => {
    expect(await processChat({ messages: [] } as any)).toEqual({ error: 'Messages array is required' });
  });

  it('uses the hosted agent runtime first and injects live market data + tool instructions', async () => {
    const { calls } = mockFetch([
      ...marketRoutes,
      { match: (u) => u.includes('api.anthropic.com'), respond: () => json({ model: 'claude-haiku-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'hosted' }] }) },
    ]);
    process.env.ANTHROPIC_API_KEY = 'k';
    const r = await processChat(payload);
    expect(r).toMatchObject({ reply: 'hosted', provider: 'anthropic', toolsUsed: [] });
    const sys = bodyOf(calls.find((c) => c.url.includes('anthropic'))!.init).system as string;
    expect(sys).toContain('You are HEPHAESTUS.');
    expect(sys).toContain('BTC: $82,000');
    expect(sys).toContain('TOOLS YOU CAN USE');
  });

  it('falls back to the local model when the hosted runtime fails', async () => {
    mockFetch([
      ...marketRoutes,
      { match: (u) => u.includes('api.anthropic.com'), respond: () => json({ error: { message: 'overloaded' } }, 529) },
      { match: (u) => u.startsWith('http://localhost:1234/v1'), respond: () => json({ choices: [{ message: { content: 'from local' } }] }) },
    ]);
    process.env.ANTHROPIC_API_KEY = 'k';
    process.env.LOCAL_MODEL_BASE_URL = 'http://localhost:1234/v1';
    const r = await processChat(payload);
    expect(r).toMatchObject({ reply: 'from local', provider: 'local' });
  });

  it('runs fully local with no hosted key', async () => {
    mockFetch([...marketRoutes, { match: (u) => u.startsWith('http://localhost:11434'), respond: () => json({ choices: [{ message: { content: 'offline ok' } }] }) }]);
    process.env.LOCAL_MODEL_BASE_URL = 'http://localhost:11434/v1';
    expect(await processChat(payload)).toMatchObject({ reply: 'offline ok', provider: 'local' });
  });

  it('answers with the built-in template when nothing is configured, even if market data is unreachable', async () => {
    mockFetch([{ match: () => true, respond: () => Promise.reject(new Error('offline')) }]);
    const r = await processChat(payload);
    expect(r.provider).toBe('local-fallback');
    expect(r.reply).toContain('HEPHAESTUS');
  });
});
