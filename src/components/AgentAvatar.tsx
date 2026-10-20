import React from 'react';

interface AgentAvatarProps {
  type?: 'portfolio' | 'coder' | 'researcher' | 'forge' | 'custom' | string;
  avatarUrl?: string;
  accentColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isHovered?: boolean;
  className?: string;
  alt?: string;
}

export const AgentAvatar: React.FC<AgentAvatarProps> = ({
  type = 'portfolio',
  avatarUrl,
  size = 'md',
  isHovered = false,
  className = '',
  alt = 'Agent Avatar'
}) => {
  const sizeMap = {
    xs: 'w-7 h-7',
    sm: 'w-8 h-8 sm:w-9 sm:h-9',
    md: 'w-16 h-16 sm:w-20 sm:h-20',
    lg: 'w-24 h-24 sm:w-28 sm:h-28',
    xl: 'w-32 h-32 sm:w-36 sm:h-36'
  };

  // Determine avatar image path
  const defaultAvatars: Record<string, string> = {
    portfolio: '/avatars/Asset%206redagentv2agent.png',
    coder: '/avatars/Asset%203greenagent.png',
    researcher: '/avatars/Asset%204blueagent.png',
    forge: '/avatars/Asset%205customagent.png',
    custom: '/avatars/Asset%205customagent.png',
    vex: '/avatars/Asset%206redagentv2agent.png',
    byte: '/avatars/Asset%203greenagent.png',
    pulse: '/avatars/Asset%204blueagent.png',
    morph: '/avatars/Asset%205customagent.png'
  };

  const imageSrc = avatarUrl || defaultAvatars[type] || '/avatars/Asset%206redagentv2agent.png';

  return (
    <div
      className={`relative flex items-center justify-center select-none ${sizeMap[size]} ${className}`}
      id={`avatar-${type}`}
    >
      <img
        src={imageSrc}
        alt={alt}
        className={`w-full h-full object-contain select-none transition-transform duration-200 ${
          isHovered ? 'scale-105' : 'scale-100'
        }`}
        referrerPolicy="no-referrer"
        loading="eager"
      />
    </div>
  );
};
