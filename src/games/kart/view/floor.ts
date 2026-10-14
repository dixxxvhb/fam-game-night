/**
 * The Mode 7 floor. One WebGL canvas behind every pane: per pane, a full-pane triangle whose
 * fragment shader turns each pixel row into a depth (z = H * f / (row - horizon)), walks out to the
 * ground point and samples the painted ground (mipmapped, anisotropic when available), with the
 * sky gradient above the horizon, fog toward the haze, a night tint with a headlight pool, and a
 * shimmer on water. Falls back to a 2D-canvas renderer (one affine strip per few rows) when
 * WebGL is not there.
 */
import type { TrackLook } from '../contract'
import type { Cam } from './camera'
import { CHECK, type GroundTex } from './ground'
import { GROUND } from './look'

export interface PanePx { x: number; y: number; w: number; h: number }

const VS = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`

const FS = `
precision highp float;
uniform vec2 uOrigin;   // pane bottom-left in GL px
uniform vec2 uSize;     // pane size in GL px
uniform float uPx;      // GL px per CSS px
uniform vec2 uCam;
uniform vec2 uFwd;
uniform float uH;
uniform float uF;       // CSS px
uniform float uHy;      // CSS px from the pane top
uniform vec2 uTexO;
uniform vec2 uTexS;     // uv per world unit
uniform sampler2D uTex;
uniform vec3 uSkyTop;
uniform vec3 uSkyBot;
uniform vec3 uHaze;
uniform vec3 uG0;
uniform vec3 uG1;
uniform vec2 uFog;
uniform float uNight;
uniform float uTime;
uniform float uCheck;
void main() {
  vec2 q = (gl_FragCoord.xy - uOrigin) / uPx;
  float sy = uSize.y / uPx - q.y;
  float sx = q.x - uSize.x / uPx * 0.5;
  float dy = sy - uHy;
  if (dy <= 0.0) {
    float t = clamp(sy / max(uHy, 1.0), 0.0, 1.0);
    vec3 sky = mix(uSkyTop, uSkyBot, t * t);
    gl_FragColor = vec4(sky, 1.0);
    return;
  }
  float z = uH * uF / dy;
  float lat = sx * z / uF;
  vec2 w = uCam + uFwd * z + vec2(-uFwd.y, uFwd.x) * lat;
  vec2 uv = (w - uTexO) * uTexS;
  vec3 c;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
    vec2 cell = floor(w / uCheck);
    c = mod(cell.x + cell.y, 2.0) > 0.5 ? uG1 : uG0;
  } else {
    c = texture2D(uTex, uv).rgb;
  }
  // water shimmer: blue-dominant texels sparkle a little
  float water = step(c.r + 0.25, c.b) * step(c.g, c.b);
  float sh = sin(w.x * 0.045 + uTime * 2.1) * sin(w.y * 0.05 - uTime * 1.7);
  c += water * smoothstep(0.75, 1.0, sh) * 0.22;
  if (uNight > 0.0) {
    float pool = exp(-pow(lat / (40.0 + z * 0.35), 2.0)) * smoothstep(900.0, 120.0, z);
    c *= mix(1.0, 0.42 + 0.75 * pool, uNight);
  }
  float fog = smoothstep(uFog.x, uFog.y, z);
  gl_FragColor = vec4(mix(c, uHaze, fog), 1.0);
}
`

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

type Uni = Record<string, WebGLUniformLocation | null>

export class FloorGL {
  gl: WebGLRenderingContext
  prog: WebGLProgram
  u: Uni
  tex: WebGLTexture | null = null
  texKey = ''
  ground: GroundTex | null = null
  lost = false

  canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' })
    if (!gl) throw new Error('no webgl')
    this.gl = gl
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
    this.prog = prog
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const names = ['uOrigin', 'uSize', 'uPx', 'uCam', 'uFwd', 'uH', 'uF', 'uHy', 'uTexO', 'uTexS', 'uTex', 'uSkyTop', 'uSkyBot', 'uHaze', 'uG0', 'uG1', 'uFog', 'uNight', 'uTime', 'uCheck']
    this.u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)]))
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true })
  }

  setGround(g: GroundTex) {
    if (this.texKey === g.key && this.tex) return
    const gl = this.gl
    if (this.tex) gl.deleteTexture(this.tex)
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, g.canvas)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const an = gl.getExtension('EXT_texture_filter_anisotropic')
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)))
    this.tex = tex
    this.texKey = g.key
    this.ground = g
  }

  /** Size the drawing buffer (GL px) and clear. */
  begin(w: number, h: number) {
    const gl = this.gl
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    gl.viewport(0, 0, w, h)
    gl.disable(gl.SCISSOR_TEST)
    gl.clearColor(0.118, 0.094, 0.22, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  /** Draw one pane. `px` = GL px per CSS px. Pane rect in CSS px, top-left origin. */
  pane(r: PanePx, px: number, cam: Cam, look: TrackLook, time: number) {
    const gl = this.gl
    const g = this.ground
    if (!g) return
    const H = this.canvas.height
    const x = Math.round(r.x * px)
    const w = Math.round(r.w * px)
    const h = Math.round(r.h * px)
    const yb = H - Math.round(r.y * px) - h
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(x, yb, w, h)
    gl.viewport(x, yb, w, h)
    const u = this.u
    gl.uniform2f(u.uOrigin, x, yb)
    gl.uniform2f(u.uSize, w, h)
    gl.uniform1f(u.uPx, w / cam.w)
    gl.uniform2f(u.uCam, cam.x, cam.y)
    gl.uniform2f(u.uFwd, Math.cos(cam.yaw), Math.sin(cam.yaw))
    gl.uniform1f(u.uH, cam.H)
    gl.uniform1f(u.uF, cam.f)
    gl.uniform1f(u.uHy, cam.hy)
    gl.uniform2f(u.uTexO, g.ox, g.oy)
    gl.uniform2f(u.uTexS, g.scale / g.tw, g.scale / g.th)
    gl.uniform1i(u.uTex, 0)
    gl.uniform3fv(u.uSkyTop, hexRgb(look.skyTop))
    gl.uniform3fv(u.uSkyBot, hexRgb(look.skyBottom))
    gl.uniform3fv(u.uHaze, hexRgb(look.skyBottom))
    const [g0, g1] = GROUND[look.ground]
    gl.uniform3fv(u.uG0, hexRgb(g0))
    gl.uniform3fv(u.uG1, hexRgb(g1))
    gl.uniform2f(u.uFog, cam.fogNear, cam.fogFar)
    gl.uniform1f(u.uNight, look.night ? 1 : 0)
    gl.uniform1f(u.uTime, time)
    gl.uniform1f(u.uCheck, CHECK)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}

/**
 * 2D fallback: sky gradient, then the floor in horizontal bands, each band an affine map of the
 * ground canvas (exact at the band's middle row). Bands are thin near the horizon and thicker
 * near the bottom. Draws into a context already clipped/translated to the pane.
 */
export function floor2D(c: CanvasRenderingContext2D, g: GroundTex, cam: Cam, look: TrackLook) {
  const { w, h } = cam
  const sky = c.createLinearGradient(0, 0, 0, Math.max(1, cam.hy))
  sky.addColorStop(0, look.skyTop)
  sky.addColorStop(1, look.skyBottom)
  c.fillStyle = sky
  c.fillRect(0, 0, w, Math.max(0, cam.hy) + 1)
  c.fillStyle = GROUND[look.ground][0]
  const top = Math.max(0, Math.floor(cam.hy) + 1)
  c.fillRect(0, top, w, h - top)
  const fx = Math.cos(cam.yaw)
  const fy = Math.sin(cam.yaw)
  let y = top
  while (y < h) {
    const dy0 = y - cam.hy
    const band = Math.max(1, Math.min(6, Math.floor(dy0 / 14)))
    const ym = y + band / 2
    const dym = ym - cam.hy
    const z = (cam.H * cam.f) / dym
    // screen = A * (world - cam) + b, linearized at the band's middle
    const k = cam.f / z
    const dzdy = -(cam.H * cam.f) / (dym * dym) // dz per screen row
    // world offset: rel = fwd * z' + right * lat ; sx = w/2 + lat*k ; sy = ym + (z' - z)/dzdy
    // invert: lat = (sx - w/2)/k ; z' = z + (sy - ym) * dzdy
    // screen from world rel (rx, ry): lat = -rx*fy + ry*fx ; zz = rx*fx + ry*fy
    const a = -fy * k
    const b = (fx * k)
    const cc = fx / dzdy
    const d = fy / dzdy
    // sx = a*rx + b*ry + w/2 ; sy = cc*rx + d*ry + (ym - z/dzdy)
    const e0 = w / 2
    const f0 = ym - z / dzdy
    // compose with texel -> world: world = o + t / scale ; rel = world - cam
    const s = 1 / g.scale
    const rx0 = g.ox - cam.x
    const ry0 = g.oy - cam.y
    c.save()
    c.beginPath()
    c.rect(0, y, w, band)
    c.clip()
    c.transform(a * s, cc * s, b * s, d * s, a * rx0 + b * ry0 + e0, cc * rx0 + d * ry0 + f0)
    c.drawImage(g.canvas, 0, 0)
    c.restore()
    y += band
  }
  // haze over the far floor
  const fogRow = cam.hy + (cam.H * cam.f) / cam.fogNear
  const fogEnd = cam.hy + (cam.H * cam.f) / cam.fogFar
  if (fogRow > top) {
    const gr = c.createLinearGradient(0, Math.max(top, fogEnd), 0, fogRow)
    gr.addColorStop(0, look.skyBottom)
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = gr
    c.fillRect(0, top, w, fogRow - top)
  }
}
