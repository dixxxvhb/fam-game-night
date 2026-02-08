import { PLAYER_COLORS } from '../../lib/constants'
import { PLAYER_ICONS } from './PlayerIcon'

interface PlayerAvatarProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
  glow?: boolean
}

const sizeClasses = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
}

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
}

const initialSizes = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-xl',
}

export function PlayerAvatar({ name, color, size = 'md', glow = false }: PlayerAvatarProps) {
  const bgColor = color || PLAYER_COLORS[name] || '#6b7280'
  const Icon = PLAYER_ICONS[name]
  const iconColor = bgColor === '#171717' ? '#ffffff' : isLightColor(bgColor) ? '#000000' : '#ffffff'

  return (
    <div
      className={`${sizeClasses[size]} rounded-2xl flex items-center justify-center font-black shrink-0 relative overflow-hidden`}
      style={{
        backgroundColor: bgColor,
        color: iconColor,
        boxShadow: glow
          ? `0 0 16px ${bgColor}60, 0 4px 12px ${bgColor}30`
          : `0 4px 8px ${bgColor}30`,
        border: `2px solid ${bgColor === '#171717' ? '#404040' : adjustBrightness(bgColor, 30)}`,
      }}
    >
      {/* Top-light gradient overlay */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 50%)',
        }}
      />
      {/* Icon or initial fallback */}
      <div className="relative z-10">
        {Icon ? (
          <Icon className={iconSizes[size]} />
        ) : (
          <span className={`${initialSizes[size]} font-black`}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
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
