import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, Github, ChevronDown, Terminal, Container, CircleCheck, Cpu } from 'lucide-react';
import { REPO_URL, X_URL } from '../lib/links';

interface RunLocallyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Runtime = 'node' | 'docker' | 'local';
type Platform = 'unix' | 'windows';

interface Step {
  title: string;
  body?: React.ReactNode;
  code?: string;
}

const XIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.33l4.38 5.79L17.75 3Zm-1.08 16.17h1.7L7.4 4.73H5.58l11.09 14.44Z" />
  </svg>
);

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="px-1.5 py-0.5 rounded-md bg-white/[0.07] text-fg text-[0.88em] font-mono">{children}</code>
);

function buildSteps(runtime: Runtime, platform: Platform): Step[] {
  const win = platform === 'windows';
  const clone: Step = {
    title: 'Clone the repository',
    code: `git clone ${REPO_URL}.git openbots\ncd openbots`,
  };
  const env: Step = {
    title: 'Configure your environment',
    body: (
      <>
        Create a local <Code>.env</Code> from the template, then open it and paste your model provider API key. The file
        stays on your machine and is ignored by Git.
      </>
    ),
    code: win ? 'Copy-Item .env.example .env\nnotepad .env' : 'cp .env.example .env\nnano .env',
  };

  if (runtime === 'local') {
    return [
      {
        title: 'Install a local model runtime',
        body: (
          <>
            Download Ollama from <Code>ollama.com</Code> and pull an open-weight model. LM Studio, vLLM and llama.cpp work too:
            any server with an OpenAI-compatible API.
          </>
        ),
        code: 'ollama pull llama3.1',
      },
      clone,
      { title: 'Install dependencies', code: 'npm ci' },
      {
        title: 'Point OpenBots at your model',
        body: <>No cloud keys needed. Conversations stay on your machine.</>,
        code: win
          ? 'Copy-Item .env.example .env\nAdd-Content .env "LOCAL_MODEL_BASE_URL=http://localhost:11434/v1"\nAdd-Content .env "LOCAL_MODEL_NAME=llama3.1"'
          : "cp .env.example .env\necho 'LOCAL_MODEL_BASE_URL=http://localhost:11434/v1' >> .env\necho 'LOCAL_MODEL_NAME=llama3.1' >> .env",
      },
      {
        title: 'Start the server',
        body: <>Open <Code>http://localhost:3000</Code>. All four agents now answer from your local model.</>,
        code: 'npm run dev',
      },
    ];
  }

  if (runtime === 'node') {
    return [
      clone,
      {
        title: 'Install dependencies',
        body: <>Installs the exact versions pinned in <Code>package-lock.json</Code>.</>,
        code: 'npm ci',
      },
      env,
      {
        title: 'Start the server',
        body: (
          <>
            Runs the API and the web app together with hot reload. Open <Code>http://localhost:3000</Code> when you see{' '}
            <Code>OpenBots Server running</Code>.
          </>
        ),
        code: 'npm run dev',
      },
      {
        title: 'Build for production (optional)',
        body: <>Compiles an optimized bundle and serves it from <Code>dist/</Code> on the same port.</>,
        code: 'npm run build\nnpm start',
      },
    ];
  }

  return [
    clone,
    env,
    {
      title: 'Build the image',
      body: <>Multi-stage build on Node 20 Alpine. The first build takes a couple of minutes.</>,
      code: 'docker build -t openbots .',
    },
    {
      title: 'Run the container',
      body: (
        <>
          Starts in the background and reads keys from your <Code>.env</Code>. Then open <Code>http://localhost:3000</Code>.
        </>
      ),
      code: 'docker run -d --name openbots -p 3000:3000 --env-file .env openbots',
    },
    {
      title: 'Follow logs, stop and remove',
      code: 'docker logs -f openbots\ndocker stop openbots\ndocker rm openbots',
    },
  ];
}

const TROUBLESHOOTING: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Port 3000 is already in use',
    a: (
      <>
        Stop whatever is using it (<Code>lsof -i :3000</Code> on macOS/Linux, <Code>netstat -ano | findstr :3000</Code> on
        Windows). With Docker you can map a different host port instead: <Code>-p 8080:3000</Code>, then open{' '}
        <Code>http://localhost:8080</Code>.
      </>
    ),
  },
  {
    q: 'Agents reply with a short template instead of a full answer',
    a: (
      <>
        The server did not find a valid API key. Check the values in <Code>.env</Code>, save the file and restart the server
        (or recreate the container). <Code>/api/status</Code> shows whether a key was loaded.
      </>
    ),
  },
  {
    q: 'npm ci fails or the server will not start',
    a: (
      <>
        Run <Code>node -v</Code> and make sure it prints 18 or newer (20 LTS recommended). Then delete{' '}
        <Code>node_modules</Code> and run <Code>npm ci</Code> again.
      </>
    ),
  },
  {
    q: 'The chat works but the 3D agents do not appear',
    a: <>Your browser has WebGL turned off. Enable hardware acceleration in the browser settings; until then the app shows 2D avatars.</>,
  },
];

export const RunLocallyModal: React.FC<RunLocallyModalProps> = ({ isOpen, onClose }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<Runtime>('node');
  const [platform, setPlatform] = useState<Platform>(() =>
    typeof navigator !== 'undefined' && /Win/i.test(navigator.platform || navigator.userAgent) ? 'windows' : 'unix'
  );
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const steps = buildSteps(runtime, platform);
  const verify = platform === 'windows' ? 'Invoke-RestMethod http://localhost:3000/api/status' : 'curl http://localhost:3000/api/status';

  const CodeBlock = ({ id, code }: { id: string; code: string }) => (
    <div className="group relative mt-2.5 rounded-xl border border-white/[0.07] bg-[#0a0b0e]">
      <pre className="pl-4 pr-12 py-3 font-mono text-[12.5px] text-fg/90 overflow-x-auto leading-relaxed">
        <code>
          {code.split('\n').map((line, i) => (
            <span key={i} className="block">
              <span className="select-none text-fg-3 mr-3">{platform === 'windows' ? '>' : '$'}</span>
              {line}
            </span>
          ))}
        </code>
      </pre>
      <button
        onClick={() => copyText(code, id)}
        className="absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center text-fg-3 hover:text-fg hover:bg-white/[0.07] transition-colors"
        aria-label="Copy command"
        title="Copy"
      >
        {copiedSection === id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );

  const Segmented = <T extends string>({
    value,
    onChange,
    options,
    label,
  }: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: string; icon?: React.ReactNode }[];
    label: string;
  }) => (
    <div role="tablist" aria-label={label} className="inline-flex p-1 rounded-full bg-white/[0.04] border border-white/[0.07]">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[13px] font-medium transition-colors ${
            value === o.value ? 'bg-fg text-ink' : 'text-fg-2 hover:text-fg'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Run OpenBots locally"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="relative w-full max-w-3xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col sm:rounded-[28px] bg-ink border border-white/[0.08] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] z-10 overflow-hidden"
          >
            <div
              className="absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[260px] pointer-events-none opacity-70"
              style={{
                background:
                  'radial-gradient(closest-side, rgba(97,165,53,0.16), transparent), radial-gradient(closest-side at 70% 50%, rgba(61,126,170,0.18), transparent), radial-gradient(closest-side at 30% 60%, rgba(204,117,117,0.14), transparent)',
              }}
            />

            {/* Header */}
            <div className="relative shrink-0 px-5 sm:px-8 pt-5 sm:pt-7 pb-5 border-b border-white/[0.06]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <img src="/brand/logo-mark-128.png" alt="" className="w-11 h-11" />
                  <div>
                    <h3 className="font-display text-[20px] sm:text-[22px] font-medium tracking-[-0.02em] text-fg">Run OpenBots locally</h3>
                    <p className="text-[13px] text-fg-2 mt-0.5">Self-host the full app and API on your own machine in about five minutes.</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] text-fg-2 hover:text-fg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Segmented
                  label="Runtime"
                  value={runtime}
                  onChange={(v) => setRuntime(v as Runtime)}
                  options={[
                    { value: 'node', label: 'Node.js', icon: <Terminal className="w-3.5 h-3.5" /> },
                    { value: 'docker', label: 'Docker', icon: <Container className="w-3.5 h-3.5" /> },
                    { value: 'local', label: 'Local model', icon: <Cpu className="w-3.5 h-3.5" /> },
                  ]}
                />
                <Segmented
                  label="Operating system"
                  value={platform}
                  onChange={(v) => setPlatform(v as Platform)}
                  options={[
                    { value: 'unix', label: 'macOS / Linux' },
                    { value: 'windows', label: 'Windows' },
                  ]}
                />
              </div>
            </div>

            {/* Body */}
            <div className="relative flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-6">
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.07] mb-7">
                {(runtime === 'local'
                  ? [
                      { k: 'Runtime', v: 'Node.js 20 + Ollama' },
                      { k: 'Memory', v: '8 GB+ RAM' },
                      { k: 'Disk', v: '~6 GB with a model' },
                      { k: 'OS', v: 'macOS, Linux, Windows' },
                    ]
                  : runtime === 'node'
                  ? [
                      { k: 'Runtime', v: 'Node.js 20 LTS' },
                      { k: 'Tools', v: 'Git, npm' },
                      { k: 'Disk', v: '~1 GB' },
                      { k: 'OS', v: 'macOS, Linux, Windows' },
                    ]
                  : [
                      { k: 'Runtime', v: 'Docker 24+' },
                      { k: 'Tools', v: 'Git' },
                      { k: 'Disk', v: '~1.5 GB' },
                      { k: 'OS', v: 'macOS, Linux, Windows' },
                    ]
                ).map((s) => (
                  <div key={s.k} className="bg-ink-2 px-4 py-3">
                    <dt className="text-[11.5px] text-fg-3">{s.k}</dt>
                    <dd className="mt-0.5 text-[13.5px] font-medium text-fg">{s.v}</dd>
                  </div>
                ))}
              </dl>

              <ol className="relative">
                {steps.map((step, i) => (
                  <li key={`${runtime}-${i}`} className="relative pl-11 pb-7 last:pb-2">
                    {i < steps.length - 1 && <span className="absolute left-[13px] top-8 bottom-1 w-px bg-white/[0.08]" aria-hidden />}
                    <span className="absolute left-0 top-0 w-7 h-7 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/[0.1] text-[12.5px] font-semibold text-fg">
                      {i + 1}
                    </span>
                    <h4 className="text-[15px] font-semibold text-fg leading-7">{step.title}</h4>
                    {step.body && <p className="mt-1 text-[13.5px] text-fg-2 leading-relaxed">{step.body}</p>}
                    {step.code && <CodeBlock id={`${runtime}-${platform}-${i}`} code={step.code} />}
                  </li>
                ))}
              </ol>

              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 sm:p-5">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                  <CircleCheck className="w-4 h-4 text-emerald-400" />
                  Check that it is running
                </div>
                <p className="mt-1 text-[13.5px] text-fg-2">
                  The status endpoint should answer with <Code>"status": "online"</Code>.
                </p>
                <CodeBlock id={`verify-${platform}`} code={verify} />
              </div>

              <h4 className="mt-8 mb-2 text-[15px] font-semibold text-fg">If something goes wrong</h4>
              <div className="rounded-2xl border border-white/[0.07] divide-y divide-white/[0.06] overflow-hidden">
                {TROUBLESHOOTING.map((item, i) => (
                  <div key={item.q}>
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      aria-expanded={openFaq === i}
                      className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left text-[13.5px] text-fg hover:bg-white/[0.03] transition-colors"
                    >
                      {item.q}
                      <ChevronDown className={`w-4 h-4 shrink-0 text-fg-3 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {openFaq === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <p className="px-4 pb-4 text-[13px] text-fg-2 leading-relaxed">{item.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="relative shrink-0 px-5 sm:px-8 py-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-9 px-3 rounded-full text-[13px] text-fg-2 hover:text-fg hover:bg-white/[0.06] transition-colors"
                >
                  <Github className="w-4 h-4" />
                  Source on GitHub
                </a>
                <a
                  href={X_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-9 px-3 rounded-full text-[13px] text-fg-2 hover:text-fg hover:bg-white/[0.06] transition-colors"
                >
                  <XIcon className="w-3.5 h-3.5" />
                  X (Twitter)
                </a>
              </div>
              <button
                onClick={onClose}
                className="h-10 px-5 rounded-full bg-fg text-ink text-[13.5px] font-semibold hover:bg-white transition-colors"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
