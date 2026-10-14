/** The House: neutral gray, a little line-drawn house. Never a player color. */
export const HOUSE_INK = '#A7ABB3'
export const HOUSE_TILE = '#22252B'
export const HOUSE_LINE = '#5E636C'

export function HouseGlyph({ size = 24, color = 'currentColor', stroke = 2.2 }: { size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" aria-hidden className="shrink-0">
      <path d="M2.8 11.6 12 3.8l9.2 7.8" />
      <path d="M5.4 9.6v10.6h13.2V9.6" />
      <path d="M10 20.2v-5.4h4v5.4" />
    </svg>
  )
}

export function HouseAvatar({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: HOUSE_INK }}
    >
      <HouseGlyph size={size * 0.62} color="#15171B" stroke={2.6} />
    </span>
  )
}
