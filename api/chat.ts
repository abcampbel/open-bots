// Chat processor for /api/chat: agent personas, provider routing, tool loop and safety layer

export interface ChatMessagePayload {
  role: string;
  content: string;
}

export interface ChatRequestPayload {
  agentId?: string;
  agentName?: string;
  systemPrompt?: string;
  customPrompt?: string;
  messages: ChatMessagePayload[];
}

export interface ChatResponsePayload {
  reply?: string;
  toolsUsed?: AgentToolAction[];
  model?: string;
  provider?: string;
  error?: string;
  details?: string;
}

// Helper to get sanitized API keys from any supported environment variable
export function getApiKeys() {
  const rawXai = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
  const xaiKey = rawXai.trim() !== '' && rawXai !== 'YOUR_SECRET_KEY' && rawXai !== 'MY_XAI_KEY' ? rawXai.trim() : null;

  const rawGemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || '';
  const geminiKey = rawGemini.trim() !== '' && rawGemini !== 'MY_GEMINI_API_KEY' ? rawGemini.trim() : null;

  const rawModel = (process.env.XAI_MODEL || '').trim();
  let xaiModel = 'grok-4.6';
  if (rawModel && !rawModel.startsWith('grok-2') && rawModel !== 'grok-beta') {
    xaiModel = rawModel;
  }

  const rawAnthropic = (process.env.ANTHROPIC_API_KEY || '').trim();
  const anthropicKey = rawAnthropic !== '' ? rawAnthropic : null;
  const anthropicModel = (process.env.ANTHROPIC_MODEL || '').trim() || 'claude-haiku-5-5';

  // Local / self-hosted open-weight model via any OpenAI-compatible server (Ollama, LM Studio, vLLM, llama.cpp)
  const localBaseUrl = (process.env.LOCAL_MODEL_BASE_URL || '').trim().replace(/\/+$/, '') || null;
  const localModel = (process.env.LOCAL_MODEL_NAME || '').trim() || 'llama3.1';
  const localApiKey = (process.env.LOCAL_MODEL_API_KEY || '').trim() || null;

  return { xaiKey, geminiKey, xaiModel, anthropicKey, anthropicModel, localBaseUrl, localModel, localApiKey };
}

// Call a local/self-hosted model through the OpenAI-compatible /chat/completions endpoint
export async function callLocalModel(
  baseUrl: string,
  model: string,
  apiKey: string | null,
  fullSystemPrompt: string,
  messages: ChatMessagePayload[],
  timeoutMs = 90000
): Promise<{ reply: string; model: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        stream: false,
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...messages
            .filter((m) => m.content && m.content.trim())
            .map((m) => ({ role: m.role === 'agent' || m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        ],
      }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new Error(`Local model error (${res.status}): ${data?.error?.message || data?.error || 'request failed'}`);
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply || typeof reply !== 'string') throw new Error('Local model returned an empty response');
    return { reply: reply.trim(), model: data.model || model };
  } finally {
    clearTimeout(timer);
  }
}

// Helper: fetch live currency and crypto market snapshot to ground all agent responses
async function fetchLiveMarketContext(): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const [fiatRes, cryptoRes] = await Promise.allSettled([
      fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal }),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd,rub', { signal: controller.signal })
    ]);
    clearTimeout(timeoutId);

    const parts: string[] = [];

    if (fiatRes.status === 'fulfilled' && fiatRes.value.ok) {
      const fiatData = await fiatRes.value.json() as any;
      const rub = fiatData.rates?.RUB ? Number(fiatData.rates.RUB).toFixed(2) : null;
      const eur = fiatData.rates?.EUR ? Number(1 / fiatData.rates.EUR).toFixed(4) : null;
      const cny = fiatData.rates?.CNY ? Number(fiatData.rates.CNY).toFixed(2) : null;
      const kzt = fiatData.rates?.KZT ? Number(fiatData.rates.KZT).toFixed(2) : null;
      const time = fiatData.time_last_update_utc || new Date().toISOString();
      
      parts.push(`[LIVE FIAT FX SNAPSHOT as of ${time}]: 1 USD = ${rub} RUB | 1 EUR = ${eur} USD | 1 USD = ${cny} CNY | 1 USD = ${kzt} KZT.`);
    }

    if (cryptoRes.status === 'fulfilled' && cryptoRes.value.ok) {
      const cData = await cryptoRes.value.json() as any;
      const btc = cData.bitcoin?.usd ? `$${cData.bitcoin.usd.toLocaleString()}` : null;
      const eth = cData.ethereum?.usd ? `$${cData.ethereum.usd.toLocaleString()}` : null;
      const sol = cData.solana?.usd ? `$${cData.solana.usd.toLocaleString()}` : null;
      parts.push(`[LIVE CRYPTO SNAPSHOT]: BTC: ${btc} | ETH: ${eth} | SOL: ${sol}.`);
    }

    return parts.join('\n');
  } catch (err) {
    return '';
  }
}

// Discover available xAI models
async function fetchAvailableXaiModels(xaiKey: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://api.x.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${xaiKey}`
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json() as any;
      if (Array.isArray(data?.data)) {
        const ids = data.data.map((m: any) => m.id).filter(Boolean);
        if (ids.length > 0) {
          return ids;
        }
      }
    }
  } catch (e) {
    // Ignore timeout / error
  }
  return [];
}

// Call xAI Chat Completions API with fallback to web/responses
async function callXai(
  xaiKey: string,
  preferredModel: string,
  fullSystemPrompt: string,
  messages: ChatMessagePayload[]
): Promise<{ reply: string; model: string }> {
  const discoveredModels = await fetchAvailableXaiModels(xaiKey);

  const candidateModels = [
    preferredModel || 'grok-4.6',
    'grok-4.6',
    'grok-4.5',
    'grok-4.20-0309-reasoning',
    'grok-4.20',
    'grok-4.3',
    'grok-4.20-0309-non-reasoning',
    'grok-build-0.1',
    ...discoveredModels,
    'grok-3',
    'grok-3-mini'
  ];

  const modelsToTry = candidateModels.filter(
    (v, i, a) => Boolean(v) && a.indexOf(v) === i
  );

  let lastStatus = 0;
  let lastErrorText = '';

  const formattedMessages = [
    { role: 'system', content: fullSystemPrompt },
    ...messages.map((m) => ({
      role: m.role === 'agent' || m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  ];

  for (const model of modelsToTry) {
    // 1. Try standard Chat Completions
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${xaiKey}`
        },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          temperature: 0.7
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        const reply = data.choices?.[0]?.message?.content;
        if (reply && typeof reply === 'string') {
          return { reply: reply.trim(), model: `xAI ${model}` };
        }
      } else {
        lastStatus = response.status;
        lastErrorText = await response.text();
        if (response.status === 401 || response.status === 403) {
          throw new Error(`xAI Authentication Error (${response.status}): Check your XAI_API_KEY.`);
        }
      }
    } catch (err: any) {
      if (err.message?.includes('Authentication Error')) {
        throw err;
      }
      lastErrorText = err?.message || String(err);
    }
  }

  throw new Error(`xAI API returned status ${lastStatus || 500}: ${lastErrorText || 'Failed to get response'}`);
}

// ---------------------------------------------------------------------------
// Anthropic Claude agent loop with tools
//   server tools (run by Anthropic): web_search, web_fetch, code_execution sandbox
//   custom tool (run here):          http_request — GET public APIs, detects x402 payment requests
// ---------------------------------------------------------------------------

export interface AgentToolAction {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  detail?: string;
}

const ANTHROPIC_BETAS = 'web-fetch-2025-09-10,code-execution-2025-08-25';
const MAX_AGENT_STEPS = 8;

const AGENT_TOOLS = [
  { type: 'web_search_20250305', name: 'web_search', max_uses: 5 },
  { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 5 },
  { type: 'code_execution_20250825', name: 'code_execution' },
  {
    name: 'http_request',
    description:
      'Call a public HTTP/JSON API with GET or HEAD and return status, headers and body (first 20 KB). ' +
      'Use it for REST APIs (prices, weather, blockchain explorers, GitHub, etc.). ' +
      'If the endpoint answers 402 Payment Required (x402 protocol), the result lists the payment options (amount, asset, network, recipient); ' +
      'payments are NOT executed automatically — report the price to the user instead.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Absolute http(s) URL, including query string.' },
        method: { type: 'string', enum: ['GET', 'HEAD'], description: 'Defaults to GET.' },
        headers: { type: 'object', additionalProperties: { type: 'string' }, description: 'Optional request headers, e.g. Accept.' },
      },
      required: ['url'],
    },
  },
];

export const AGENT_CAPABILITIES_PROMPT = `

### TOOLS YOU CAN USE
You are an agent, not just a chat model. Use tools whenever they make the answer better or more current:
- web_search: search the live web (news, prices not in the snapshot, documentation, people, events).
- web_fetch: open and read a specific web page or document by URL.
- code_execution: an isolated sandbox with bash and Python — run code, do exact calculations, analyse data, produce and test scripts.
- http_request: call public REST/JSON APIs directly (GET/HEAD). It recognises x402 "402 Payment Required" responses and returns the price; you cannot pay automatically, so tell the user what it would cost.
Rules: prefer tools over guessing for anything current or numeric; cite the sources you used briefly; never invent data a tool did not return; keep the final answer in the user's language.`;

/* ---------- SSRF-safe http_request ---------- */

export function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const v = ip.toLowerCase();
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https URLs are allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Private hosts are not allowed');
  const net = await import('node:net');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Private network addresses are not allowed');
    return url;
  }
  const dns = await import('node:dns');
  const addrs = await dns.promises.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('Private network addresses are not allowed');
  return url;
}

export function parseX402(status: number, headers: Headers, bodyText: string) {
  if (status !== 402) return null;
  let requirements: any = null;
  try {
    requirements = JSON.parse(bodyText);
  } catch {
    /* not JSON */
  }
  const headerReq = headers.get('payment-required') || headers.get('x-payment-required');
  if (!requirements && headerReq) {
    try {
      requirements = JSON.parse(Buffer.from(headerReq, 'base64').toString('utf8'));
    } catch {
      requirements = headerReq;
    }
  }
  const accepts = Array.isArray(requirements?.accepts) ? requirements.accepts : [];
  return {
    protocol: 'x402',
    version: requirements?.x402Version ?? null,
    options: accepts.map((o: any) => ({
      scheme: o.scheme,
      network: o.network,
      amount: o.maxAmountRequired ?? o.amount,
      asset: o.asset,
      payTo: o.payTo,
      description: o.description,
      resource: o.resource,
    })),
    raw: accepts.length ? undefined : requirements,
    note: 'Payment was not executed. Automatic payments are disabled.',
  };
}

export async function runHttpRequest(input: any): Promise<{ content: string; isError: boolean; detail: string; x402: boolean }> {
  const method = input?.method === 'HEAD' ? 'HEAD' : 'GET';
  try {
    const url = await assertPublicUrl(String(input?.url || ''));
    const headers: Record<string, string> = { 'user-agent': 'OpenBots-Agent/1.0', accept: 'application/json, text/plain;q=0.9, */*;q=0.5' };
    if (input?.headers && typeof input.headers === 'object') {
      for (const [k, v] of Object.entries(input.headers)) {
        if (typeof v === 'string' && !/^(host|cookie|authorization)$/i.test(k)) headers[k] = v;
      }
    }
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(url, { method, headers, redirect: 'manual', signal: controller.signal });
    } finally {
      clearTimeout(t);
    }
    let body = '';
    if (method !== 'HEAD') {
      const buf = Buffer.from(await res.arrayBuffer());
      body = buf.subarray(0, 20000).toString('utf8') + (buf.length > 20000 ? '\n…[truncated]' : '');
    }
    const x402 = parseX402(res.status, res.headers, body);
    const pickHeaders = ['content-type', 'location', 'retry-after', 'x-ratelimit-remaining'];
    const result = {
      status: res.status,
      headers: Object.fromEntries(pickHeaders.map((h) => [h, res.headers.get(h)]).filter(([, v]) => v)),
      ...(x402 ? { x402 } : { body }),
    };
    return {
      content: JSON.stringify(result),
      isError: false,
      detail: `${method} ${url.host}${url.pathname} → ${res.status}${x402 ? ' (x402 payment required)' : ''}`,
      x402: !!x402,
    };
  } catch (err: any) {
    return { content: `Request failed: ${err?.message || String(err)}`, isError: true, detail: `${method} ${input?.url || ''} failed`, x402: false };
  }
}

/* ---------- Agent loop ---------- */

function describeServerTool(block: any): { name: string; detail: string } {
  const input = block.input || {};
  switch (block.name) {
    case 'web_search':
      return { name: 'Web search', detail: String(input.query || '') };
    case 'web_fetch':
      return { name: 'Read page', detail: String(input.url || '') };
    case 'bash_code_execution':
      return { name: 'Sandbox', detail: String(input.command || '').slice(0, 140) };
    case 'text_editor_code_execution':
      return { name: 'Sandbox file', detail: `${input.command || 'edit'} ${input.path || ''}`.trim() };
    case 'code_execution':
      return { name: 'Sandbox', detail: String(input.code || '').split('\n')[0].slice(0, 140) };
    default:
      return { name: block.name || 'Tool', detail: '' };
  }
}

export function toAnthropicTurns(messages: { role: string; content: string }[]) {
  const turns: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of messages) {
    const content = (m.content || '').trim();
    if (!content) continue;
    const role: 'user' | 'assistant' = m.role === 'agent' || m.role === 'assistant' ? 'assistant' : 'user';
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) prev.content += `\n\n${content}`;
    else turns.push({ role, content });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (turns.length === 0) turns.push({ role: 'user', content: 'Hello' });
  return turns;
}

export async function runClaudeAgent(
  apiKey: string,
  model: string,
  system: string,
  history: { role: string; content: string }[],
  deadlineMs = 100000
): Promise<{ reply: string; model: string; toolsUsed: AgentToolAction[] }> {
  const started = Date.now();
  const convo: any[] = toAnthropicTurns(history);
  const toolsUsed: AgentToolAction[] = [];
  let container: string | undefined;
  let usedModel = model;
  let textOut = '';

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const remaining = deadlineMs - (Date.now() - started);
    if (remaining < 5000) break;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), remaining);
    let data: any;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': ANTHROPIC_BETAS,
        },
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          system,
          tools: AGENT_TOOLS,
          messages: convo,
          ...(container ? { container } : {}),
        }),
        signal: controller.signal,
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Anthropic API error (${res.status}): ${data?.error?.message || 'request failed'}`);
    } finally {
      clearTimeout(t);
    }

    usedModel = data.model || usedModel;
    if (data.container?.id) container = data.container.id;
    const content: any[] = Array.isArray(data.content) ? data.content : [];

    // Track tools that ran on Anthropic's side
    for (const b of content) {
      if (b.type === 'server_tool_use') {
        const d = describeServerTool(b);
        toolsUsed.push({ id: b.id, name: d.name, status: 'completed', detail: d.detail });
      } else if (typeof b.type === 'string' && b.type.endsWith('_tool_result') && b.content?.type?.endsWith('_error')) {
        const t = toolsUsed.find((x) => x.id === b.tool_use_id);
        if (t) t.status = 'failed';
      }
    }

    // Final answer = text after the last tool block (drops "let me search…" narration)
    let lastTool = -1;
    content.forEach((b, i) => {
      if (b.type !== 'text' && b.type !== 'thinking' && b.type !== 'redacted_thinking') lastTool = i;
    });
    const tail = content.slice(lastTool + 1).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const text = tail.trim() ? tail : content.filter((b) => b.type === 'text').map((b) => b.text).join('\n\n');
    if (text.trim()) textOut = text;

    if (data.stop_reason === 'pause_turn') {
      convo.push({ role: 'assistant', content });
      continue;
    }

    if (data.stop_reason === 'tool_use') {
      convo.push({ role: 'assistant', content });
      const results: any[] = [];
      for (const b of content) {
        if (b.type !== 'tool_use') continue;
        if (b.name === 'http_request') {
          const r = await runHttpRequest(b.input);
          toolsUsed.push({ id: b.id, name: r.x402 ? 'x402 payment request' : 'API call', status: r.isError ? 'failed' : 'completed', detail: r.detail });
          results.push({ type: 'tool_result', tool_use_id: b.id, content: r.content, is_error: r.isError });
        } else {
          results.push({ type: 'tool_result', tool_use_id: b.id, content: `Unknown tool ${b.name}`, is_error: true });
        }
      }
      convo.push({ role: 'user', content: results });
      continue;
    }

    break; // end_turn / max_tokens / refusal
  }

  const reply = textOut.trim();
  if (!reply) throw new Error('Agent finished without a text answer');
  return { reply, model: usedModel, toolsUsed };
}

// Call Google Gemini API using native REST fetch
async function callGemini(
  geminiKey: string,
  fullSystemPrompt: string,
  messages: ChatMessagePayload[]
): Promise<{ reply: string; model: string }> {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  const contents = messages
    .filter(m => m.content && m.content.trim())
    .map(m => ({
      role: m.role === 'agent' || m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  }

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: fullSystemPrompt }] },
          contents,
          generationConfig: { temperature: 0.7 }
        })
      });

      if (res.ok) {
        const data = await res.json() as any;
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply && typeof reply === 'string') {
          return { reply: reply.trim(), model: `Gemini ${model}` };
        }
      }
    } catch (e) {
      // Continue to next model
    }
  }

  throw new Error('Gemini API call failed across all fallback models.');
}

// In-character autonomous fallback
function generateAutonomousFallback(payload: ChatRequestPayload, liveMarketInfo?: string): string {
  const agentId = payload.agentId || 'vex';
  const agentName = payload.agentName || 'OpenBot Agent';
  const lastUserMsg = [...payload.messages].reverse().find(m => m.role === 'user')?.content || 'Hello';
  const marketNote = liveMarketInfo ? `\n\n📊 **Current market data:**\n${liveMarketInfo}` : '';
  const offlineNote = '\n\n*(OpenBots offline mode: add a provider key or a local model in `.env` to enable full answers.)*';

  switch (agentId) {
    case 'vex':
      return `**[PLUTUS — Market analysis mode]**\n\nRequest: *"${lastUserMsg}"*\n${marketNote}\n\n1. **Liquidity**: major currency and crypto pairs are trading actively. Account for spread and volatility when converting or hedging.\n2. **Risk management**: keep exposure diversified across hard currency, gold and liquid instruments.${offlineNote}`;

    case 'byte':
      return `**[HEPHAESTUS — Code & automation]**\n\nTask: *"${lastUserMsg}"*\n\n\`\`\`typescript\n// Fetch a live exchange rate\nasync function getUsdEurRate() {\n  const res = await fetch('https://open.er-api.com/v6/latest/USD');\n  const data = await res.json();\n  console.log(\`USD/EUR: \${data.rates.EUR}\`);\n  return data.rates.EUR;\n}\n\`\`\`\n${marketNote}\n\nReady to drop into any service or bot.${offlineNote}`;

    case 'pulse':
      return `**[HERMES — Research & monitoring]**\n\nMonitoring the information space for: *"${lastUserMsg}"*\n\n- **Signal**: strong public interest in currency moves and macroeconomic news.\n- **Media backdrop**: interest rates and trade balances remain the main drivers across social and analyst channels.\n${marketNote}${offlineNote}`;

    case 'morph':
    default:
      return `**[${agentName}]**\n\nResponse to your request: *"${lastUserMsg}"*.\n${marketNote}\n\nAll OpenBots systems are online.${offlineNote}`;
  }
}

// Core execution handler
export async function processChat(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
  try {
    const { systemPrompt, customPrompt, messages } = payload;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return { error: 'Messages array is required' };
    }

    // 1. Fetch live market & currency context dynamically
    const liveMarketInfo = await fetchLiveMarketContext();

    let fullSystemPrompt = systemPrompt || 'You are an AI agent on the OpenBots platform.';
    if (customPrompt && customPrompt.trim()) {
      fullSystemPrompt += `\n\nUSER CUSTOM SYSTEM INSTRUCTIONS:\n${customPrompt.trim()}`;
    }

    // Inject live market grounding data and explicit knowledge instruction
    fullSystemPrompt += `\n\n### REAL-TIME DATA & KNOWLEDGE DIRECTIVE:
You have access to current financial, market, currency, and real-time knowledge.
${liveMarketInfo ? `Current live market snapshot:\n${liveMarketInfo}\n` : ''}
CRITICAL RULES FOR RESPONDING:
1. NEVER say "I don't have access to real-time data", "I cannot check current prices", or "As an AI I don't know today's rates".
2. If asked for currency rates (e.g. USD/RUB, EUR/USD, crypto, etc.), ALWAYS provide the exact current numbers from the live snapshot above or your latest knowledge base.
3. Be confident, precise, and immediately helpful on all questions regarding prices, rates, world events, and general facts.`;

    const { xaiKey, geminiKey, xaiModel, anthropicKey, anthropicModel, localBaseUrl, localModel, localApiKey } = getApiKeys();
    let anthropicError = '';
    let localError = '';
    let xaiError = '';
    let geminiError = '';

    // 0. Primary: Anthropic Claude
    if (anthropicKey) {
      try {
        const res = await runClaudeAgent(anthropicKey, anthropicModel, fullSystemPrompt + AGENT_CAPABILITIES_PROMPT, messages);
        return {
          reply: res.reply,
          model: res.model,
          provider: 'anthropic',
          toolsUsed: res.toolsUsed
        };
      } catch (err: any) {
        anthropicError = err.message || String(err);
        console.error('[Anthropic Failure]', anthropicError);
      }
    } else {
      anthropicError = 'ANTHROPIC_API_KEY is not configured.';
    }

    // 0b. Local open-weight model (Ollama, LM Studio, vLLM, llama.cpp)
    if (localBaseUrl) {
      try {
        const res = await callLocalModel(localBaseUrl, localModel, localApiKey, fullSystemPrompt, messages);
        return { reply: res.reply, model: res.model, provider: 'local' };
      } catch (err: any) {
        localError = err.message || String(err);
        console.error('[Local model failure]', localError);
      }
    }

    // 1. Try xAI Grok
    if (xaiKey) {
      try {
        const res = await callXai(xaiKey, xaiModel, fullSystemPrompt, messages);
        return {
          reply: res.reply,
          model: res.model,
          provider: 'xai'
        };
      } catch (err: any) {
        xaiError = err.message || String(err);
        console.error('[xAI Failure]', xaiError);
      }
    } else {
      xaiError = 'XAI_API_KEY is not configured.';
    }

    // 2. Fallback to Gemini
    if (geminiKey) {
      try {
        const res = await callGemini(geminiKey, fullSystemPrompt, messages);
        return {
          reply: res.reply,
          model: res.model,
          provider: 'gemini'
        };
      } catch (err: any) {
        geminiError = err.message || String(err);
        console.error('[Gemini Failure]', geminiError);
      }
    } else {
      geminiError = 'GEMINI_API_KEY is not configured.';
    }

    // 3. Autonomous fallback response
    const fallbackReply = generateAutonomousFallback(payload, liveMarketInfo);
    return {
      reply: fallbackReply,
      model: 'OpenBots Autonomous Engine',
      provider: 'local-fallback',
      details: [anthropicError, localError, xaiError, geminiError].filter(Boolean).join(' | ')
    };
  } catch (outerErr: any) {
    const fallbackReply = generateAutonomousFallback(payload || { messages: [] });
    return {
      reply: fallbackReply,
      model: 'OpenBots Autonomous Engine',
      provider: 'local-fallback',
      details: outerErr?.message || String(outerErr)
    };
  }
}
