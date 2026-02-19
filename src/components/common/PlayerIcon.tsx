// Custom SVG icons for each core player
// Defaults: Johnnyboy = Lightning, Dixxx = Crown, Torii = Star, Malikk = Flame
// Overrides stored in app_settings under key 'player_icons'

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

function ShieldIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
    </svg>
  )
}

function TrophyIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M7 2v2H5C3.9 4 3 4.9 3 6v2c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0011 15.9V18H9v2h6v-2h-2v-2.1a5.01 5.01 0 003.61-2.96C19.08 12.63 21 10.55 21 8V6c0-1.1-.9-2-2-2h-2V2H7zm0 4h2v6c-1.66 0-3-1.34-3-3V6h1zm10 3c0 1.66-1.34 3-3 3V6h2v3z" />
    </svg>
  )
}

function RocketIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z" />
    </svg>
  )
}

function DiamondIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19 3H5L2 9l10 12L22 9l-3-6zm-8.5 5l1.5-3 1.5 3h-3zM12 17.5L5.5 9H9l3 6 3-6h3.5L12 17.5z" />
    </svg>
  )
}

function SwordIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M15.5 2.1L11 6.6 8.4 4 3 9.4l2.6 2.6L2 15.6 8.4 22l3.6-3.6 2.6 2.6L20 15.6 17.4 13 22 8.4 15.5 2.1zM9.8 18.6L5.4 14.2l1.4-1.4 4.4 4.4-1.4 1.4zm9.8-9.8l-4.4 4.4-1.4-1.4 4.4-4.4 1.4 1.4z" />
    </svg>
  )
}

function MusicIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
    </svg>
  )
}

// All icons available for players to pick from
export const AVAILABLE_ICONS: Record<string, React.FC<IconProps>> = {
  lightning: LightningIcon,
  crown: CrownIcon,
  star: StarIcon,
  flame: FlameIcon,
  shield: ShieldIcon,
  trophy: TrophyIcon,
  rocket: RocketIcon,
  diamond: DiamondIcon,
  sword: SwordIcon,
  music: MusicIcon,
}

// Default assignments by player name — overridden by app_settings 'player_icons'
const PLAYER_ICON_DEFAULTS: Record<string, string> = {
  Johnnyboy: 'lightning',
  Dixxx: 'crown',
  Torii: 'star',
  Malikk: 'flame',
}

// Mutable overrides loaded from app_settings
let playerIconOverrides: Record<string, string> = {}

export function setPlayerIconOverrides(overrides: Record<string, string>) {
  playerIconOverrides = overrides
}

export const PLAYER_ICONS: Record<string, React.FC<IconProps>> = new Proxy({} as Record<string, React.FC<IconProps>>, {
  get(_target, name: string) {
    const iconKey = playerIconOverrides[name] ?? PLAYER_ICON_DEFAULTS[name]
    return iconKey ? AVAILABLE_ICONS[iconKey] : undefined
  },
})

export function getPlayerIcon(name: string): React.FC<IconProps> | null {
  return PLAYER_ICONS[name] || null
}

export function getIconKey(name: string): string {
  return playerIconOverrides[name] ?? PLAYER_ICON_DEFAULTS[name] ?? 'lightning'
}
