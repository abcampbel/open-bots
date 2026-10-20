import { vi } from 'vitest';

export interface MockRoute {
  match: (url: string, init?: RequestInit) => boolean;
  respond: (url: string, init?: RequestInit) => Response | Promise<Response>;
}

/** Replaces global fetch with a router; unmatched URLs fail loudly. */
export function mockFetch(routes: MockRoute[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (input: any, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    const route = routes.find((r) => r.match(url, init));
    if (!route) throw new Error(`Unexpected fetch: ${url}`);
    return route.respond(url, init);
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

export const bodyOf = (init?: RequestInit) => JSON.parse(String(init?.body || '{}'));
