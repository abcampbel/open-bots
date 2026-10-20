import { describe, it, expect, vi, beforeEach } from 'vitest';

const lookup = vi.fn();
vi.mock('node:dns', () => ({ default: { promises: { lookup } }, promises: { lookup } }));

import { isPrivateIp, assertPublicUrl, runHttpRequest } from '../api/chat';
import { mockFetch, json } from './helpers';

describe('isPrivateIp', () => {
  it.each([
    ['127.0.0.1', true],
    ['10.1.2.3', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['192.168.1.1', true],
    ['169.254.169.254', true],
    ['100.64.0.1', true],
    ['0.0.0.0', true],
    ['224.0.0.1', true],
    ['::1', true],
    ['fd00::1', true],
    ['fe80::1', true],
    ['8.8.8.8', false],
    ['172.32.0.1', false],
    ['140.82.112.3', false],
    ['2606:4700::1111', false],
  ])('%s → %s', (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });
});

describe('assertPublicUrl', () => {
  beforeEach(() => lookup.mockReset());

  it('rejects non-http schemes', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow(/http/);
    await expect(assertPublicUrl('ftp://example.com')).rejects.toThrow(/http/);
  });

  it('rejects localhost-style hostnames without resolving them', async () => {
    await expect(assertPublicUrl('http://localhost:3000')).rejects.toThrow(/Private/);
    await expect(assertPublicUrl('http://printer.local')).rejects.toThrow(/Private/);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('rejects hostnames that resolve to private addresses (DNS rebinding style)', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34' }, { address: '10.0.0.5' }]);
    await expect(assertPublicUrl('https://sneaky.example')).rejects.toThrow(/Private network/);
  });

  it('accepts public hosts', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34' }]);
    const url = await assertPublicUrl('https://api.example.com/v1?q=1');
    expect(url.host).toBe('api.example.com');
  });
});

describe('runHttpRequest', () => {
  beforeEach(() => {
    lookup.mockReset();
    lookup.mockResolvedValue([{ address: '93.184.216.34' }]);
  });

  it('returns status and body for a public JSON API', async () => {
    mockFetch([{ match: (u) => u.startsWith('https://api.example.com'), respond: () => json({ ok: true }) }]);
    const r = await runHttpRequest({ url: 'https://api.example.com/ping' });
    expect(r.isError).toBe(false);
    expect(JSON.parse(r.content)).toMatchObject({ status: 200, body: '{"ok":true}' });
    expect(r.detail).toContain('→ 200');
  });

  it('strips sensitive request headers', async () => {
    const { calls } = mockFetch([{ match: () => true, respond: () => json({}) }]);
    await runHttpRequest({ url: 'https://api.example.com', headers: { Authorization: 'x', Cookie: 'y', Accept: 'text/plain' } });
    const sent = calls[0].init!.headers as Record<string, string>;
    expect(sent.Authorization).toBeUndefined();
    expect(sent.Cookie).toBeUndefined();
    expect(sent.Accept).toBe('text/plain');
  });

  it('flags x402 payment requests without paying', async () => {
    mockFetch([
      {
        match: () => true,
        respond: () => json({ x402Version: 1, accepts: [{ scheme: 'exact', network: 'base', maxAmountRequired: '1000', payTo: '0xabc' }] }, 402),
      },
    ]);
    const r = await runHttpRequest({ url: 'https://paid.example.com/data' });
    expect(r.x402).toBe(true);
    expect(JSON.parse(r.content).x402.options[0].amount).toBe('1000');
  });

  it('only allows GET and HEAD', async () => {
    const { calls } = mockFetch([{ match: () => true, respond: () => json({}) }]);
    await runHttpRequest({ url: 'https://api.example.com', method: 'DELETE' });
    expect(calls[0].init!.method).toBe('GET');
  });

  it('reports blocked targets as tool errors, never throws', async () => {
    const r = await runHttpRequest({ url: 'http://127.0.0.1:8080/admin' });
    expect(r.isError).toBe(true);
    expect(r.content).toMatch(/not allowed/);
  });
});

describe('IP literals', () => {
  it('are checked directly, without trusting DNS', async () => {
    lookup.mockReset();
    lookup.mockResolvedValue([{ address: '93.184.216.34' }]);
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(/Private network/);
    await expect(assertPublicUrl('http://[::1]:3000/')).rejects.toThrow(/Private network/);
    await expect(assertPublicUrl('http://8.8.8.8/')).resolves.toBeInstanceOf(URL);
    expect(lookup).not.toHaveBeenCalled();
  });
});
