import { INK, type CritterId } from '../../board/park/cast'

/**
 * The back of each critter's head and shoulders, for karts seen from behind. Same 120 x 140 box,
 * same shapes and colors as CritterArt (cast.tsx), seen from the other side. `side` (-1..1) is
 * where the kart's nose points on screen, so a beak or snout can peek out on that side.
 */

const o = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`
const BEAN = 'M60 50 C94 50 100 80 98 104 C96 130 80 136 60 136 C40 136 24 130 22 104 C20 80 26 50 60 50 Z'

function tubeD(d: string, w: number, color: string): string {
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 7}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
}

export function critterBack(id: CritterId, side: number): string {
  const sx = (x: number) => 60 + (x - 60) * Math.sign(side || 1)
  const peek = Math.abs(side) > 0.25
  switch (id) {
    case 'chomp': {
      const body = '#58C454'
      const dark = '#3A9A3E'
      return `
        <path d="${BEAN}" fill="${body}" ${o}/>
        <ellipse cx="24" cy="98" rx="8" ry="12" transform="rotate(20 24 98)" fill="${body}" ${o}/>
        <ellipse cx="96" cy="98" rx="8" ry="12" transform="rotate(-20 96 98)" fill="${body}" ${o}/>
        ${peek ? `<ellipse cx="${sx(104)}" cy="58" rx="16" ry="14" fill="${body}" ${o}/>` : ''}
        <circle cx="42" cy="32" r="15" fill="${body}" ${o}/>
        <circle cx="78" cy="32" r="15" fill="${body}" ${o}/>
        <rect x="12" y="38" width="96" height="36" rx="18" fill="${body}" ${o}/>
        <path d="M20 46 Q60 40 100 46" fill="none" stroke="#7BD877" stroke-width="4" stroke-linecap="round"/>
        <g fill="${dark}" stroke="${INK}" stroke-width="2.2">
          <ellipse cx="48" cy="60" rx="5" ry="4"/><ellipse cx="60" cy="58" rx="5" ry="4"/><ellipse cx="72" cy="60" rx="5" ry="4"/>
          <ellipse cx="52" cy="84" rx="5" ry="4"/><ellipse cx="68" cy="84" rx="5" ry="4"/><ellipse cx="60" cy="96" rx="5" ry="4"/>
        </g>`
    }
    case 'mattie': {
      const body = '#93A9C2'
      const dark = '#6F86A1'
      return `
        <ellipse cx="18" cy="100" rx="9" ry="16" transform="rotate(28 18 100)" fill="${dark}" ${o}/>
        <ellipse cx="102" cy="100" rx="9" ry="16" transform="rotate(-28 102 100)" fill="${dark}" ${o}/>
        ${peek ? `<ellipse cx="${sx(98)}" cy="70" rx="14" ry="12" fill="#C6D4E3" ${o}/>` : ''}
        <path d="M60 30 C88 30 102 56 103 90 C104 122 86 136 60 136 C34 136 16 122 17 90 C18 56 32 30 60 30 Z" fill="${body}" ${o}/>
        <path d="M38 46 C46 38 74 38 82 46" fill="none" stroke="#B7C7D8" stroke-width="4" stroke-linecap="round"/>
        <path d="M34 80 C46 86 74 86 86 80" fill="none" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>
        <path d="M30 96 C44 102 76 102 90 96" fill="none" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>`
    }
    case 'pete': {
      const body = '#F7F5EF'
      const shade = '#D8D2C4'
      return `
        <path d="${BEAN}" fill="${body}" ${o}/>
        <ellipse cx="30" cy="92" rx="12" ry="24" transform="rotate(10 30 92)" fill="${shade}" ${o}/>
        <ellipse cx="90" cy="92" rx="12" ry="24" transform="rotate(-10 90 92)" fill="${shade}" ${o}/>
        <path d="M24 110 L30 122 L36 112 Z M96 110 L90 122 L84 112 Z" fill="${INK}"/>
        ${peek ? `<path d="M${sx(70)} 44 L${sx(112)} 48 Q${sx(114)} 54 ${sx(108)} 58 Q${sx(90)} 66 ${sx(72)} 54 Z" fill="#FF8A24" ${o}/>` : ''}
        <path d="M52 12 Q58 2 62 12 Q68 4 70 14" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
        <path d="M52 12 Q58 2 62 12 Q68 4 70 14" fill="none" stroke="#F2C230" stroke-width="4" stroke-linecap="round"/>
        <circle cx="60" cy="36" r="24" fill="${body}" ${o}/>
        <path d="M44 24 Q60 16 76 24" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
        <path d="M50 52 Q60 58 70 52" fill="none" stroke="${shade}" stroke-width="3" stroke-linecap="round"/>`
    }
    case 'pickles': {
      const fur = '#B9B2C4'
      const dark = '#8C84A0'
      return `
        <path d="${BEAN}" fill="${fur}" ${o}/>
        <ellipse cx="26" cy="100" rx="7" ry="11" transform="rotate(20 26 100)" fill="${dark}" ${o}/>
        <ellipse cx="94" cy="100" rx="7" ry="11" transform="rotate(-20 94 100)" fill="${dark}" ${o}/>
        <circle cx="31" cy="28" r="13" fill="#2A2438" ${o}/>
        <circle cx="89" cy="28" r="13" fill="#2A2438" ${o}/>
        ${peek ? `<ellipse cx="${sx(84)}" cy="74" rx="14" ry="9" fill="#F8F4F9" ${o}/>` : ''}
        <path d="M60 22 C86 22 98 40 94 56 C90 70 74 80 60 84 C46 80 30 70 26 56 C22 40 34 22 60 22 Z" fill="${fur}" ${o}/>
        <path d="M60 26 C66 36 66 52 60 70 C54 52 54 36 60 26 Z" fill="${dark}"/>
        <path d="M40 38 Q48 34 52 40 M80 38 Q72 34 68 40" fill="none" stroke="#E6E0EC" stroke-width="3" stroke-linecap="round"/>`
    }
    case 'dillo': {
      const shell = '#C4966A'
      const band = '#9C7048'
      const skin = '#EBC9A2'
      return `
        <ellipse cx="40" cy="22" rx="8" ry="15" transform="rotate(-22 40 22)" fill="${skin}" ${o}/>
        <ellipse cx="80" cy="22" rx="8" ry="15" transform="rotate(22 80 22)" fill="${skin}" ${o}/>
        ${peek ? `<path d="M${sx(70)} 48 L${sx(96)} 60 Q${sx(100)} 66 ${sx(94)} 68 L${sx(68)} 62 Z" fill="${skin}" ${o}/>` : ''}
        <path d="M36 44 C36 28 84 28 84 44 C84 56 76 62 60 62 C44 62 36 56 36 44 Z" fill="${skin}" ${o}/>
        <path d="M44 34 C50 28 70 28 76 34 C70 40 50 40 44 34 Z" fill="${shell}" ${o}/>
        <path d="M12 114 C10 70 34 54 60 54 C86 54 110 70 108 114 C92 120 28 120 12 114 Z" fill="${shell}" ${o}/>
        <g fill="none" stroke="${band}" stroke-width="3.4" stroke-linecap="round">
          <path d="M22 76 C46 68 74 68 98 76"/><path d="M16 90 C44 82 76 82 104 90"/><path d="M13 104 C44 96 76 96 107 104"/>
          <path d="M60 58 V112"/>
        </g>
        <g fill="${band}"><circle cx="34" cy="83" r="1.8"/><circle cx="86" cy="83" r="1.8"/><circle cx="46" cy="97" r="1.8"/><circle cx="74" cy="97" r="1.8"/></g>`
    }
    case 'ibby': {
      const body = '#FBFAF6'
      const shade = '#DCD8CE'
      return `
        <path d="M60 54 C90 54 98 78 96 96 C94 114 78 120 60 120 C42 120 26 114 24 96 C22 78 30 54 60 54 Z" fill="${body}" ${o}/>
        <ellipse cx="30" cy="88" rx="11" ry="20" transform="rotate(10 30 88)" fill="${shade}" ${o}/>
        <ellipse cx="90" cy="88" rx="11" ry="20" transform="rotate(-10 90 88)" fill="${shade}" ${o}/>
        <path d="M24 100 C22 110 28 116 34 110 Z M96 100 C98 110 92 116 86 110 Z" fill="${INK}"/>
        ${peek ? tubeD(`M${sx(70)} 48 C${sx(88)} 54 ${sx(100)} 70 ${sx(106)} 90`, 6, '#EE6E5B') : ''}
        <circle cx="60" cy="36" r="22" fill="${body}" ${o}/>
        <path d="M46 26 Q60 18 74 26" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>`
    }
    case 'shelly': {
      const shell = '#2E9D86'
      const plate = '#4CC1A4'
      const skin = '#A8D876'
      return `
        <ellipse cx="18" cy="96" rx="9" ry="18" transform="rotate(34 18 96)" fill="${skin}" ${o}/>
        <ellipse cx="102" cy="96" rx="9" ry="18" transform="rotate(-34 102 96)" fill="${skin}" ${o}/>
        ${peek ? `<ellipse cx="${sx(80)}" cy="44" rx="10" ry="12" fill="${skin}" ${o}/>` : ''}
        <circle cx="60" cy="40" r="25" fill="${skin}" ${o}/>
        <g fill="#86BE55"><circle cx="48" cy="28" r="3"/><circle cx="70" cy="24" r="2.6"/><circle cx="64" cy="40" r="2.2"/><circle cx="50" cy="44" r="2"/></g>
        <ellipse cx="60" cy="98" rx="40" ry="38" fill="${shell}" ${o}/>
        <path d="M60 66 L76 78 L72 98 L48 98 L44 78 Z" fill="${plate}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
        <g fill="${plate}" stroke="${INK}" stroke-width="2.4"><circle cx="30" cy="92" r="8"/><circle cx="90" cy="92" r="8"/><circle cx="40" cy="116" r="7"/><circle cx="80" cy="116" r="7"/><circle cx="60" cy="120" r="7"/></g>`
    }
    case 'zippy': {
      const body = '#80D63C'
      const dark = '#56AA22'
      return `
        <path d="M60 58 C88 58 94 84 92 106 C90 128 78 136 60 136 C42 136 30 128 28 106 C26 84 32 58 60 58 Z" fill="${body}" ${o}/>
        <ellipse cx="30" cy="100" rx="7" ry="11" transform="rotate(20 30 100)" fill="${dark}" ${o}/>
        <ellipse cx="90" cy="100" rx="7" ry="11" transform="rotate(-20 90 100)" fill="${dark}" ${o}/>
        ${peek ? `<ellipse cx="${sx(84)}" cy="52" rx="12" ry="9" fill="${body}" ${o}/>` : ''}
        <path d="M40 12 l5 -6 l5 6 l5 -6 l5 6 l5 -6 l5 6 l5 -6 l5 6" fill="${dark}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
        <circle cx="34" cy="32" r="12" fill="${body}" ${o}/>
        <circle cx="86" cy="32" r="12" fill="${body}" ${o}/>
        <ellipse cx="60" cy="38" rx="30" ry="25" fill="${body}" ${o}/>
        <path d="M60 16 V60 M60 66 V128" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>
        <g fill="${dark}"><path d="M54 70 l6 -6 l6 6 Z"/><path d="M54 86 l6 -6 l6 6 Z"/><path d="M54 102 l6 -6 l6 6 Z"/></g>`
    }
  }
}

