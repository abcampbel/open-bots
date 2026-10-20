# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [2.5.0] - 2026-10-20

### Added
- Agent runtime with tool use: web search, page reading, isolated code sandbox (bash and Python) and
  `http_request` for public REST APIs.
- x402 support: `402 Payment Required` responses are parsed (v1 body and v2 header) and the price is reported.
- Fully local mode with any OpenAI-compatible server (Ollama, LM Studio, vLLM, llama.cpp).
- Tool trail in chat showing every step an agent took.
- Real-time 3D agents with idle, attention, speaking, thinking, answering and error states.
- New brand: logo, favicon set and social image.
- Step-by-step Run locally guide for Node.js and Docker; multi-stage `Dockerfile`.
- Test suite (Vitest), ESLint, CI on Node.js 20/22, Docker build check, CodeQL, OpenSSF Scorecard, Dependabot.

### Changed
- Agents renamed: VEX → PLUTUS, BYTE → HEPHAESTUS, PULSE → HERMES, MORPH → PROTEUS (ids unchanged).
- Markdown tables render in chat.

### Security
- SSRF guard for outbound API calls, including IP literals and DNS-resolved private addresses.
