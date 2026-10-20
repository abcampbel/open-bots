import { describe, it, expect, vi, beforeEach } from 'vitest';

const lookup = vi.fn(async () => [{ address: '93.184.216.34' }]);
vi.mock('node:dns', () => ({ default: { promises: { lookup } }, promises: { lookup } }));

import { runClaudeAgent, toAnthropicTurns } from '../api/chat';
import { mockFetch, json, bodyOf } from './helpers';

const ANTHROPIC = (u: string) => u === 'https://api.anthropic.com/v1/messages';

describe('toAnthropicTurns', () => {
  it('drops leading assistant turns and merges consecutive roles', () => {
    const turns = toAnthropicTurns([
      { role: 'assistant', content: 'stale error' },
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'c' },
      { role: 'user', content: '   ' },
    ]);
    expect(turns).toEqual([
      { role: 'user', content: 'a\n\nb' },
      { role: 'assistant', content: 'c' },
    ]);
  });

  it('never sends an empty conversation', () => {
    expect(toAnthropicTurns([])).toEqual([{ role: 'user', content: 'Hello' }]);
  });
});

describe('runClaudeAgent', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('returns a direct answer and sends tools + beta headers', async () => {
    const { calls } = mockFetch([
      { match: ANTHROPIC, respond: () => json({ model: 'claude-haiku-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hi!' }] }) },
    ]);
    const r = await runClaudeAgent('key', 'claude-haiku-5-5', 'sys', [{ role: 'user', content: 'hello' }]);
    expect(r.reply).toBe('Hi!');
    expect(r.toolsUsed).toEqual([]);
    const headers = calls[0].init!.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('key');
    expect(headers['anthropic-beta']).toContain('code-execution');
    const body = bodyOf(calls[0].init);
    expect(body.tools.map((t: any) => t.name)).toEqual(['web_search', 'web_fetch', 'code_execution', 'http_request']);
    expect(body.system).toBe('sys');
  });

  it('executes the custom http_request tool and feeds the result back', async () => {
    let step = 0;
    const { calls } = mockFetch([
      {
        match: ANTHROPIC,
        respond: () =>
          ++step === 1
            ? json({
                stop_reason: 'tool_use',
                content: [
                  { type: 'text', text: 'Checking the API…' },
                  { type: 'tool_use', id: 'tu_1', name: 'http_request', input: { url: 'https://api.example.com/price' } },
                ],
              })
            : json({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Price is 42.' }] }),
      },
      { match: (u) => u.startsWith('https://api.example.com'), respond: () => json({ price: 42 }) },
    ]);

    const r = await runClaudeAgent('key', 'm', 'sys', [{ role: 'user', content: 'price?' }]);
    expect(r.reply).toBe('Price is 42.');
    expect(r.toolsUsed).toEqual([expect.objectContaining({ id: 'tu_1', name: 'API call', status: 'completed' })]);

    const second = bodyOf(calls[2].init);
    const toolResult = second.messages.at(-1).content[0];
    expect(toolResult).toMatchObject({ type: 'tool_result', tool_use_id: 'tu_1', is_error: false });
    expect(JSON.parse(toolResult.content).body).toContain('42');
  });

  it('tracks server tools, continues after pause_turn and reuses the sandbox container', async () => {
    let step = 0;
    const { calls } = mockFetch([
      {
        match: ANTHROPIC,
        respond: () =>
          ++step === 1
            ? json({
                stop_reason: 'pause_turn',
                container: { id: 'cont_1' },
                content: [{ type: 'server_tool_use', id: 'st_1', name: 'web_search', input: { query: 'btc price' } }],
              })
            : json({
                stop_reason: 'end_turn',
                content: [
                  { type: 'text', text: 'Let me compute…' },
                  { type: 'server_tool_use', id: 'st_2', name: 'bash_code_execution', input: { command: 'python3 -c "print(2500/82000)"' } },
                  { type: 'bash_code_execution_tool_result', tool_use_id: 'st_2', content: { type: 'bash_code_execution_result', stdout: '0.0304' } },
                  { type: 'text', text: 'About 0.0304 BTC.' },
                ],
              }),
      },
    ]);
    const r = await runClaudeAgent('key', 'm', 'sys', [{ role: 'user', content: 'how much btc for $2500' }]);
    expect(r.reply).toBe('About 0.0304 BTC.'); // narration before the tool is dropped
    expect(r.toolsUsed.map((t) => t.name)).toEqual(['Web search', 'Sandbox']);
    expect(bodyOf(calls[1].init).container).toBe('cont_1');
  });

  it('marks failed server tools', async () => {
    mockFetch([
      {
        match: ANTHROPIC,
        respond: () =>
          json({
            stop_reason: 'end_turn',
            content: [
              { type: 'server_tool_use', id: 'st_1', name: 'web_fetch', input: { url: 'https://down.example' } },
              { type: 'web_fetch_tool_result', tool_use_id: 'st_1', content: { type: 'web_fetch_tool_error', error_code: 'url_not_accessible' } },
              { type: 'text', text: 'The page is down.' },
            ],
          }),
      },
    ]);
    const r = await runClaudeAgent('key', 'm', 'sys', [{ role: 'user', content: 'read it' }]);
    expect(r.toolsUsed[0]).toMatchObject({ name: 'Read page', status: 'failed' });
  });

  it('surfaces API errors with the status code', async () => {
    mockFetch([{ match: ANTHROPIC, respond: () => json({ error: { message: 'invalid x-api-key' } }, 401) }]);
    await expect(runClaudeAgent('bad', 'm', 'sys', [{ role: 'user', content: 'hi' }])).rejects.toThrow(/401.*invalid x-api-key/);
  });

  it('stops after the step limit instead of looping forever', async () => {
    const { calls } = mockFetch([
      {
        match: ANTHROPIC,
        respond: () => json({ stop_reason: 'pause_turn', content: [{ type: 'text', text: 'still working' }] }),
      },
    ]);
    const r = await runClaudeAgent('key', 'm', 'sys', [{ role: 'user', content: 'loop' }]);
    expect(calls.length).toBe(8);
    expect(r.reply).toBe('still working');
  });
});
