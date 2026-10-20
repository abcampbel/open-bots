import { describe, it, expect } from 'vitest';
import { parseX402 } from '../api/chat';

describe('parseX402', () => {
  it('ignores non-402 responses', () => {
    expect(parseX402(200, new Headers(), '{}')).toBeNull();
    expect(parseX402(401, new Headers(), '{}')).toBeNull();
  });

  it('parses x402 v1 payment requirements from the JSON body', () => {
    const body = JSON.stringify({
      x402Version: 1,
      accepts: [
        {
          scheme: 'exact',
          network: 'base',
          maxAmountRequired: '10000',
          asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          payTo: '0x1111111111111111111111111111111111111111',
          resource: 'https://api.example.com/weather',
          description: 'Weather data',
        },
      ],
    });
    const r = parseX402(402, new Headers(), body)!;
    expect(r.protocol).toBe('x402');
    expect(r.version).toBe(1);
    expect(r.options).toHaveLength(1);
    expect(r.options[0]).toMatchObject({ scheme: 'exact', network: 'base', amount: '10000' });
    expect(r.note).toMatch(/not executed/i);
  });

  it('parses x402 v2 requirements from a base64 PAYMENT-REQUIRED header', () => {
    const header = Buffer.from(
      JSON.stringify({ x402Version: 2, accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '5000', asset: 'USDC', payTo: '0xdef' }] })
    ).toString('base64');
    const r = parseX402(402, new Headers({ 'payment-required': header }), 'Payment required')!;
    expect(r.version).toBe(2);
    expect(r.options[0]).toMatchObject({ network: 'eip155:8453', amount: '5000', payTo: '0xdef' });
  });

  it('keeps unknown 402 bodies as raw data instead of throwing', () => {
    const r = parseX402(402, new Headers(), 'pay me')!;
    expect(r.options).toEqual([]);
  });
});
