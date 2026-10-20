# Security policy

## Supported versions

Only the latest release on `main` receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through
[GitHub Security Advisories](https://github.com/alexvladimirovich888/agnes123/security/advisories/new).
Include steps to reproduce and the impact you observed. You will get an acknowledgement within 72 hours
and a fix or mitigation plan within 14 days for confirmed issues.

## Security model

OpenBots runs untrusted model output against real tools, so the server enforces limits that do not depend
on the model behaving well.

| Area | Guarantee | Where |
|---|---|---|
| Outbound API calls (`http_request`) | Only `http`/`https`; `GET`/`HEAD` only; loopback, private, link-local, CGNAT, multicast and cloud-metadata addresses are refused, both as IP literals and after DNS resolution; redirects are not followed automatically; responses are truncated to 20 KB; 15 s timeout | `api/chat.ts` → `assertPublicUrl`, `runHttpRequest` |
| Request headers | `Authorization`, `Cookie` and `Host` supplied by the model are dropped | `runHttpRequest` |
| Payments (x402) | `402 Payment Required` responses are parsed and reported. **No payment is ever signed or sent.** | `parseX402` |
| Code execution | Runs in Anthropic's isolated code-execution container, never on the OpenBots server | server tool `code_execution` |
| Agent loop | At most 8 model steps and a 100 s budget per request | `runClaudeAgent` |
| Secrets | API keys are read from environment variables on the server only and never sent to the browser. `.env` files are git- and docker-ignored. `/api/status` reports only whether a key is present. | `getApiKeys`, `.gitignore`, `.dockerignore` |

All of the above is covered by tests in `tests/ssrf.test.ts`, `tests/x402.test.ts` and `tests/agent-loop.test.ts`.

## Deployment hardening checklist

- Set provider keys as environment variables in your host (`.env`, Docker `--env-file`), never in code.
- Rotate any key that has been pasted into a chat, issue or screenshot.
- If you expose a self-hosted instance publicly, put it behind authentication or rate limiting: every chat
  request spends model credits.
