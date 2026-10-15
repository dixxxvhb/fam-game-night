/** Drawn glyphs for the board (no emoji anywhere). */

export function Skull({ size = 24, color = '#fff', bg = '#000' }: { size?: number; color?: string; bg?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden style={{ display: 'block' }}>
      <path d="M12 2.5c-5 0-8.5 3.4-8.5 8 0 2.7 1.2 4.6 3 5.7V20a1.5 1.5 0 0 0 1.5 1.5h8A1.5 1.5 0 0 0 17.5 20v-3.8c1.8-1.1 3-3 3-5.7 0-4.6-3.5-8-8.5-8Z" fill={color} />
      <circle cx="8.6" cy="11.2" r="2.3" fill={bg} />
      <circle cx="15.4" cy="11.2" r="2.3" fill={bg} />
      <path d="M12 13.6l-1.4 2.6h2.8Z" fill={bg} />
      <path d="M9.5 21.5v-3M12 21.5v-3M14.5 21.5v-3" stroke={bg} strokeWidth="1.3" />
    </svg>
  )
}

export function StarGlyph({ size = 24, color = '#FFD25A', stroke = '#7A4E10' }: { size?: number; color?: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden style={{ display: 'block' }}>
      <path d="M12 2l2.9 6.2 6.8.8-5 4.6 1.4 6.7L12 16.9 5.9 20.3l1.4-6.7-5-4.6 6.8-.8Z" fill={color} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function Crown({ size = 24, color = '#FFD25A', stroke = '#7A4E10' }: { size?: number; color?: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 32 24" width={size * (32 / 24)} height={size} aria-hidden style={{ display: 'block' }}>
      <path d="M3 8l6.5 5L16 3l6.5 10L29 8l-2.5 13h-21Z" fill={color} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="3" cy="8" r="2" fill={color} stroke={stroke} strokeWidth="1.2" />
      <circle cx="16" cy="3" r="2" fill={color} stroke={stroke} strokeWidth="1.2" />
      <circle cx="29" cy="8" r="2" fill={color} stroke={stroke} strokeWidth="1.2" />
    </svg>
  )
}

export function HomeGlyph({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden style={{ display: 'block' }}>
      <path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" fill={color} />
    </svg>
  )
}
