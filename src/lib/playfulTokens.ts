/**
 * Playful Geometric Design System Tokens
 * Philosophy: "Stable Grid, Wild Decoration"
 * Memphis Group-inspired modern digital palette, tactile shapes & hard pop shadows.
 */

export const PLAYFUL_COLORS = {
  background: '#FFFDF5',      // Warm Cream / Off-White (Paper feel)
  foreground: '#1E293B',      // Slate 800 (Softer than black)
  muted: '#F1F5F9',           // Slate 100
  mutedForeground: '#64748B', // Slate 500
  accent: '#8B5CF6',          // Vivid Violet (Primary Brand)
  accentForeground: '#FFFFFF',
  secondary: '#F472B6',       // Hot Pink (Playful pop)
  tertiary: '#FBBF24',        // Amber/Yellow (Optimism)
  quaternary: '#34D399',      // Emerald/Mint (Freshness)
  border: '#1E293B',          // Chunky dark border
  borderLight: '#E2E8F0',     // Slate 200
  card: '#FFFFFF',
  ring: '#8B5CF6'
};

// Aliases for backwards compatibility with any component references
export const COLORS = {
  ...PLAYFUL_COLORS,
  paperBg: PLAYFUL_COLORS.background,
  paperMuted: PLAYFUL_COLORS.borderLight,
  pencil: PLAYFUL_COLORS.foreground,
  pencilLight: PLAYFUL_COLORS.mutedForeground,
  markerRed: PLAYFUL_COLORS.secondary,
  penBlue: PLAYFUL_COLORS.accent,
  postitYellow: PLAYFUL_COLORS.tertiary,
  postitAmber: PLAYFUL_COLORS.tertiary,
  postitGreen: PLAYFUL_COLORS.quaternary
};

export const RADII = {
  sm: '8px',
  md: '16px',
  lg: '24px',
  full: '9999px',
  // Speech bubble style ("blob" radius)
  speechBubble: '16px 16px 16px 2px',
  arch: '9999px 9999px 16px 16px',
  leaf: '24px 8px 24px 8px'
};

// For backward compatibility with WOBBLY imports
export const WOBBLY = {
  container: '24px',
  medium: '16px',
  pill: '9999px',
  note: '16px',
  badge: '9999px',
  card: '20px'
};

export function getPlayfulColorForIndex(index: number): { bg: string; text: string; shadow: string } {
  const rotation = [
    { bg: 'bg-[#8B5CF6]', text: 'text-white', shadow: 'shadow-pop-violet' },
    { bg: 'bg-[#F472B6]', text: 'text-white', shadow: 'shadow-pop-pink' },
    { bg: 'bg-[#FBBF24]', text: 'text-[#1E293B]', shadow: 'shadow-pop-yellow' },
    { bg: 'bg-[#34D399]', text: 'text-[#1E293B]', shadow: 'shadow-pop-mint' }
  ];
  return rotation[index % rotation.length];
}

export function getRandomRotation(index: number): string {
  // Playful slight tilt rotation
  const rotList = ['hover:-rotate-1', 'hover:rotate-1', 'hover:-rotate-0.5', 'hover:rotate-0.5'];
  return rotList[index % rotList.length];
}
