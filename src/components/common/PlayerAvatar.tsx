import { PLAYER_COLORS } from '../../lib/constants'

interface PlayerAvatarProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
}

export function PlayerAvatar({ name, color, size = 'md' }: PlayerAvatarProps) {
  const bgColor = color || PLAYER_COLORS[name] || '#6b7280'
  const initial = name.charAt(0).toUpperCase()
  const textColor = bgColor === '#171717' ? '#ffffff' : isLightColor(bgColor) ? '#000000' : '#ffffff'

  return (
    <div
      className={`${sizeClasses[size]} rounded-xl flex items-center justify-center font-black shrink-0 border-2 shadow-md`}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        borderColor: bgColor === '#171717' ? '#505050' : adjustBrightness(bgColor, -30),
        boxShadow: `0 3px 8px ${bgColor}40`,
      }}
    >
      {initial}
    </div>
  )
}

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

function adjustBrightness(hex: string, amount: number): string {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
