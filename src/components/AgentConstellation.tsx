import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AgentConfig } from '../types';
import { AgentNode } from './AgentNode';
import { hasWebGL, WebGLBoundary } from './three/support';

const AgentStage = lazy(() => import('./three/AgentStage').then((m) => ({ default: m.AgentStage })));

interface AgentConstellationProps {
  agents: AgentConfig[];
  onSelectAgent: (agent: AgentConfig, initialPrompt?: string) => void;
  paused?: boolean;
}

export const AgentConstellation: React.FC<AgentConstellationProps> = ({ agents, onSelectAgent, paused = false }) => {
  const [activeSpeech, setActiveSpeech] = useState<{
    agentId: string;
    text: string;
  } | null>(null);

  // Dynamic subtle speech bubble engine
  useEffect(() => {
    // Initial random greeting from an agent after 1.5s
    const initialTimer = setTimeout(() => {
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      if (randomAgent && randomAgent.personality.idlePhrases.length > 0) {
        const phrase = randomAgent.personality.idlePhrases[0];
        setActiveSpeech({ agentId: randomAgent.id, text: phrase });

        // Auto-dismiss after 4 seconds
        setTimeout(() => {
          setActiveSpeech(null);
        }, 4000);
      }
    }, 1500);

    // Periodic organic speech triggers (every 9 to 14 seconds)
    const interval = setInterval(() => {
      if (agents.length === 0) return;
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      const phrases = randomAgent.personality.idlePhrases;
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];

      setActiveSpeech({ agentId: randomAgent.id, text: phrase });

      // Auto fade out after 4.5 seconds
      setTimeout(() => {
        setActiveSpeech((current) => (current?.agentId === randomAgent.id ? null : current));
      }, 4500);
    }, 10000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [agents]);

  const fallback = (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="max-w-4xl w-full mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-10 justify-items-center">
          {agents.map((agent, i) => (
            <AgentNode
              key={agent.id}
              agent={agent}
              side={i % 2 === 0 ? 'right' : 'left'}
              currentSpeech={activeSpeech?.agentId === agent.id ? activeSpeech.text : null}
              onSelect={onSelectAgent}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <section id="agents-canvas" className="relative flex-1 min-h-[360px]" aria-label="Agents">
      <div className="stage-floor" />
      {hasWebGL() ? (
        <WebGLBoundary fallback={fallback}>
          <Suspense fallback={null}>
            <AgentStage agents={agents} speech={activeSpeech} onSelect={onSelectAgent} paused={paused} />
          </Suspense>
        </WebGLBoundary>
      ) : (
        fallback
      )}
    </section>
  );
};
