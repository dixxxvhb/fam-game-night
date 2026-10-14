import type { ItemKind } from './sim'

/** Small flat item marks, matching how items look on the track. */
export function ItemIcon({ kind, size = 28 }: { kind: ItemKind | null; size?: number }) {
  if (!kind) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect x="6" y="6" width="20" height="20" rx="5" fill="none" stroke="#6E77A6" strokeWidth="2.5" strokeDasharray="4 4" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      {(kind === 'cafecito' || kind === 'cafecito3' || kind === 'storm') && (
        <g fill="#FF6B3D" stroke="#0C1130" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M6 22 L16 8 L26 22 L21 22 L16 15 L11 22 Z" />
          <path d="M9 28 L16 18 L23 28 L19 28 L16 24 L13 28 Z" fill="#F5C518" />
        </g>
      )}
      {(kind === 'mango' || kind === 'lovebugs') && (
        <g fill="#F5C518" stroke="#7A5A00" strokeWidth="1.6">
          <ellipse cx="16" cy="8.5" rx="4" ry="7" />
          <ellipse cx="16" cy="8.5" rx="4" ry="7" transform="rotate(120 16 16)" />
          <ellipse cx="16" cy="8.5" rx="4" ry="7" transform="rotate(240 16 16)" />
          <circle cx="16" cy="16" r="4.5" />
        </g>
      )}
      {(kind === 'coconut' || kind === 'pelican' || kind === 'hurricane') && (
        <g transform="rotate(-35 16 16)">
          <circle cx="5" cy="16" r="2.5" fill="#FF6B3D" opacity="0.6" />
          <path d="M28 16 L20 10 L8 10 L8 22 L20 22 Z" fill="#FF5A6B" stroke="#0C1130" strokeWidth="1.6" strokeLinejoin="round" />
        </g>
      )}
      {kind === 'floatie' && (
        <g fill="none" stroke="#E8ECFF" strokeWidth="3">
          <circle cx="16" cy="16" r="11" strokeDasharray="6 4" />
          <circle cx="16" cy="16" r="4" fill="#E8ECFF" stroke="none" />
        </g>
      )}
    </svg>
  )
}
