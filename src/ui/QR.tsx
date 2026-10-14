import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function QR({ text, size = 200, className }: { text: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0C1130', light: '#E8ECFF' } })
      .then((s) => { if (alive) setSvg(s) })
      .catch(() => {})
    return () => { alive = false }
  }, [text])
  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      role="img"
      aria-label="QR code to join"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
