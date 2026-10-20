export type AgentId = 'vex' | 'byte' | 'pulse' | 'morph' | string;

export interface AgentPersonality {
  traits: string[];
  tone: string;
  greeting: string;
  idlePhrases: string[];
}

export interface AgentConfig {
  id: AgentId;
  name: string;
  role: string;
  tagline: string;
  description: string;
  avatarType: 'portfolio' | 'coder' | 'researcher' | 'forge' | 'custom';
  avatarUrl?: string;
  accentColor: string; // 'cyan' | 'amber' | 'emerald' | 'purple' | 'rose'
  personality: AgentPersonality;
  specialties: string[];
  systemPrompt: string;
  customPrompt?: string;
  isCustom?: boolean;
  status: 'online' | 'active' | 'standby';
  samplePrompts: string[];
}

export interface ToolAction {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  detail?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  agentId: string;
  text: string;
  timestamp: number;
  toolsUsed?: ToolAction[];
  error?: boolean;
}

export interface ChatRequestPayload {
  agentId: string;
  agentName: string;
  systemPrompt: string;
  customPrompt?: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
}

export interface ChatResponsePayload {
  reply: string;
  toolsUsed?: ToolAction[];
  model?: string;
  error?: string;
  code?: string;
}
