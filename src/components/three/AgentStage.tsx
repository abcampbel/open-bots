import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { AnimatePresence } from 'motion/react';
import type { AgentConfig } from '../../types';
import { paletteFor } from '../../lib/palette';
import { AgentFigure, AgentMood, FIGURE_HEIGHT } from './AgentFigure';
import { StageLights, CameraRig, configureRenderer, usePrefersReducedMotion, useCanHover } from './StageCommon';
import { AgentHoverCard } from '../AgentHoverCard';
import { SpeechBubble } from '../SpeechBubble';

interface AgentStageProps {
  agents: AgentConfig[];
  speech: { agentId: string; text: string } | null;
  onSelect: (agent: AgentConfig, initialPrompt?: string) => void;
  paused?: boolean;
}

const LOOK_TARGET: [number, number, number] = [0, 2.5, 0];
const CAMERA_BASE: [number, number, number] = [0, 3.1, 19];

interface SceneProps extends AgentStageProps {
  hovered: string | null;
  setHover: (id: string | null) => void;
  holdHover: () => void;
  canHover: boolean;
  reducedMotion: boolean;
  portal: React.MutableRefObject<HTMLElement>;
}

const Scene: React.FC<SceneProps> = ({ agents, speech, onSelect, hovered, setHover, holdHover, canHover, reducedMotion, portal }) => {
  const { size, viewport, camera } = useThree();
  const n = agents.length;
  const narrow = size.width < 680 || size.width / size.height < 1.15;

  const layout = useMemo(() => {
    const S = 4.75;
    const rows = Math.ceil(n / 2);
    const pos: [number, number, number][] = agents.map((_, i) =>
      narrow ? [((i % 2) - 0.5) * 4.6, (rows - 1 - Math.floor(i / 2)) * 7.6, 0] : [(i - (n - 1) / 2) * S, 0, 0]
    );
    const w = narrow ? 4.6 + 4.0 : (n - 1) * S + 4.0;
    const top = (narrow ? (rows - 1) * 7.6 : 0) + FIGURE_HEIGHT + 1.4;
    const bottom = narrow ? -1.0 : -1.25;
    const vp = viewport.getCurrentViewport(camera, LOOK_TARGET as any);
    const scale = Math.min(1.3, (vp.width * 0.94) / w, (vp.height * 0.94) / (top - bottom));
    const offsetY = LOOK_TARGET[1] - ((top + bottom) / 2) * scale;
    return { pos, scale, offsetY };
  }, [agents, n, narrow, viewport, camera]);

  return (
    <group position={[0, layout.offsetY, 0]} scale={layout.scale}>
      {agents.map((agent, i) => {
        const palette = paletteFor(agent);
        const isHovered = hovered === agent.id;
        const isSpeaking = speech?.agentId === agent.id;
        const mood: AgentMood = isHovered ? 'attention' : isSpeaking ? 'speaking' : 'idle';
        const col = narrow ? i % 2 : i < n / 2 ? 0 : 1;
        const side = col === 0 ? 'right' : 'left';

        return (
          <group key={agent.id}>
            <AgentFigure
              palette={palette}
              mood={mood}
              position={layout.pos[i]}
              enterDelay={0.25 + i * 0.16}
              reducedMotion={reducedMotion}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHover(agent.id);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHover(null);
                document.body.style.cursor = '';
              }}
              onClick={(e) => {
                e.stopPropagation();
                document.body.style.cursor = '';
                onSelect(agent);
              }}
            >
              {/* Idle speech bubble above the head */}
              <Html position={[0, FIGURE_HEIGHT + 0.25, 0]} portal={portal} zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
                <div style={{ transform: narrow ? `translate(${(i % 2 === 0 ? -22 : -78)}%, -100%)` : 'translate(-50%, -100%)' }}>
                  <SpeechBubble text={!isHovered && isSpeaking ? speech!.text : null} agentName={agent.name} glow={palette.glow} isVisible={!isHovered && isSpeaking} compact={narrow} />
                </div>
              </Html>

              {/* Hover card beside the agent */}
              {canHover && (
                <Html position={[side === 'right' ? 2.3 : -2.3, 2.9, 0]} portal={portal} zIndexRange={[40, 31]}>
                  <div
                    style={{ transform: side === 'right' ? 'translate(0, -50%)' : 'translate(-100%, -50%)' }}
                    onMouseEnter={holdHover}
                    onMouseLeave={() => setHover(null)}
                  >
                    <AnimatePresence>
                      {isHovered && <AgentHoverCard agent={agent} onSelect={onSelect} side={side} />}
                    </AnimatePresence>
                  </div>
                </Html>
              )}
            </AgentFigure>

            {/* Name plate under the figure */}
            <Html position={[layout.pos[i][0], layout.pos[i][1] - 0.45, 0]} portal={portal} zIndexRange={[19, 10]}>
              <button
                type="button"
                onClick={() => onSelect(agent)}
                onMouseEnter={() => setHover(agent.id)}
                onMouseLeave={() => setHover(null)}
                className="stage-label"
                style={{ ['--agent-glow' as any]: palette.glow, ['--agent-text' as any]: palette.text, animationDelay: `${0.7 + i * 0.16}s` }}
                data-active={isHovered || undefined}
                data-compact={narrow || undefined}
              >
                <span className="stage-label-name">{agent.name}</span>
                {!narrow && <span className="stage-label-role">{agent.role}</span>}
              </button>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

export const AgentStage: React.FC<AgentStageProps> = (props) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const overlay = useRef<HTMLDivElement>(null!);
  const reducedMotion = usePrefersReducedMotion();
  const canHover = useCanHover();

  const setHover = (id: string | null) => {
    window.clearTimeout(closeTimer.current);
    if (id) setHovered(id);
    else closeTimer.current = window.setTimeout(() => setHovered(null), 220);
  };
  const holdHover = () => window.clearTimeout(closeTimer.current);

  return (
    <div className="absolute inset-0 isolate">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: CAMERA_BASE, fov: 30, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={configureRenderer}
        frameloop={props.paused ? 'never' : 'always'}
        style={{ position: 'absolute', inset: 0 }}
        aria-label="Interactive 3D agents"
      >
        <StageLights />
        <CameraRig target={LOOK_TARGET} base={CAMERA_BASE} strength={reducedMotion ? 0 : 0.9} />
        <Scene
          {...props}
          hovered={hovered}
          setHover={setHover}
          holdHover={holdHover}
          canHover={canHover}
          reducedMotion={reducedMotion}
          portal={overlay as React.MutableRefObject<HTMLElement>}
        />
      </Canvas>
      <div ref={overlay} className="pointer-events-none absolute inset-0 [&>*]:pointer-events-auto" />
    </div>
  );
};
