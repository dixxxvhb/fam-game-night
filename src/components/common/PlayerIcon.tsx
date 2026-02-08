// Custom SVG icons for each core player
// Johnnyboy = Lightning, Dixxx = Crown, Torii = Star, Malikk = Flame

interface IconProps {
  className?: string
}

function LightningIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  )
}

function CrownIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M2 8l4 12h12l4-12-5 4-5-6-5 6-5-4zM5 21h14v2H5v-2z" />
    </svg>
  )
}

function StarIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

function FlameIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 23c-4.97 0-7-3.58-7-7 0-2.82 1.73-5.17 3-6.56V8c0-.35.15-.68.4-.9.26-.22.6-.3.93-.24C12.26 7.42 17 9.88 17 16c0 3.42-2.03 7-5 7zm-2-7c0 1.1.9 2 2 2s2-.9 2-2c0-1.73-1.13-3.17-2-4-.87.83-2 2.27-2 4z" />
    </svg>
  )
}

export const PLAYER_ICONS: Record<string, React.FC<IconProps>> = {
  Johnnyboy: LightningIcon,
  Dixxx: CrownIcon,
  Torii: StarIcon,
  Malikk: FlameIcon,
}

export function getPlayerIcon(name: string): React.FC<IconProps> | null {
  return PLAYER_ICONS[name] || null
}
