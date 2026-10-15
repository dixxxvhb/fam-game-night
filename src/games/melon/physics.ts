import Matter from 'matter-js'
import {
  DANGER_Y,
  DROP_Y,
  fruit,
  JUNK_MAX_TIER,
  OVER_MS,
  pointsForPair,
  TIERS,
  WORLD_H,
  WORLD_W,
} from './fruits'

/**
 * One phone's jar: a matter-js world in fixed world units (600 x 860), stepped at a
 * fixed 60 Hz no matter the frame rate. Runs only on the phone that plays it.
 */

const { Engine, Bodies, Composite, Body, Events } = Matter

const STEP = 1000 / 60
const MAX_STEPS = 4
export const MAX_BODIES = 100
/** A dropped or merged fruit gets this long before it can count toward topping out. */
const GRACE_MS = 1000
const SETTLED_SPEED = 0.9
const JUNK_GAP_MS = 140

/** Everything that decides how the jar feels. Tuned against Suika; see UNDERWATER below. */
export interface Tuning {
  /** Gravity (matter-js units, scale 0.001). */
  gravity: number
  /** Bounciness of fruit (0 dead, 1 superball). */
  bounce: number
  /** Fruit-on-fruit grip: higher rolls, lower slides. */
  friction: number
  frictionStatic: number
  /** Drag through the air. Also damps spin, so low keeps fruit rolling. */
  air: number
  wallFriction: number
  /** A merged fruit pops in from this fraction of its size... */
  growFrom: number
  /** ...over this many 60 Hz steps. Faster pop = bigger shove on the neighbours. */
  growSteps: number
}

/** The first version (Oct 14): heavy air drag, slidey, soft merge pop. */
export const ORIGINAL: Tuning = {
  gravity: 1.7, bounce: 0.12, friction: 0.12, frictionStatic: 0.4, air: 0.012, wallFriction: 0.25, growFrom: 0.6, growSteps: 7,
}

/**
 * Underwater, like the Netflix version: water drag slows every fall to a readable sink, fruit
 * lands with no bounce and drifts into place, and merges swell in over a fifth of a second so
 * you can watch them happen. The jar is drawn full of water to match (draw.ts).
 */
export const UNDERWATER: Tuning = {
  gravity: 1.6, bounce: 0.08, friction: 0.3, frictionStatic: 0.1, air: 0.05, wallFriction: 0.05, growFrom: 0.4, growSteps: 12,
}

export interface FruitBody {
  body: Matter.Body
  tier: number
  /** Sim ms when it entered the jar. */
  born: number
  /** Continuous ms spent settled above the danger line. */
  over: number
  /** Steps left to grow in after a merge. */
  grow: number
  junk: boolean
  /** Made by a merge (the presentation gives it a pop). */
  merged: boolean
}

export interface MergeEvent { tier: number; made: number | null; points: number; x: number; y: number }

export class Jar {
  readonly engine: Matter.Engine
  readonly fruits = new Map<number, FruitBody>()
  score = 0
  over = false
  /** 0..1, how close the worst fruit is to topping you out. */
  danger = 0
  /** Sim clock, ms. */
  time = 0
  onMerge: ((m: MergeEvent) => void) | null = null
  private acc = 0
  private pending: [FruitBody, FruitBody][] = []
  private claimed = new Set<number>()
  private junkQueue: { tier: number; x: number; at: number }[] = []
  private rand: () => number

  readonly tune: Tuning

  constructor(startScore = 0, rand: () => number = Math.random, tune: Tuning = UNDERWATER) {
    this.score = startScore
    this.rand = rand
    this.tune = tune
    this.engine = Engine.create({
      gravity: { x: 0, y: tune.gravity, scale: 0.001 },
      positionIterations: 10,
      velocityIterations: 8,
      enableSleeping: false,
    })
    const T = 200
    const wall = { isStatic: true, friction: tune.wallFriction, restitution: 0.1, label: 'wall' }
    Composite.add(this.engine.world, [
      Bodies.rectangle(WORLD_W / 2, WORLD_H + T / 2, WORLD_W + T * 2, T, wall),
      Bodies.rectangle(-T / 2, WORLD_H / 2 - WORLD_H, T, WORLD_H * 4, wall),
      Bodies.rectangle(WORLD_W + T / 2, WORLD_H / 2 - WORLD_H, T, WORLD_H * 4, wall),
    ])
    Events.on(this.engine, 'collisionStart', this.onPairs)
    Events.on(this.engine, 'collisionActive', this.onPairs)
  }

  private onPairs = (e: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of e.pairs) {
      const a = this.fruits.get(pair.bodyA.id)
      const b = this.fruits.get(pair.bodyB.id)
      if (!a || !b || a.tier !== b.tier) continue
      if (this.claimed.has(a.body.id) || this.claimed.has(b.body.id)) continue
      this.claimed.add(a.body.id)
      this.claimed.add(b.body.id)
      this.pending.push([a, b])
    }
  }

  get count() { return this.fruits.size }

  /** Clamp an aim x so a fruit of `tier` fits inside the walls. */
  clampX(x: number, tier: number): number {
    const r = fruit(tier).r
    return Math.max(r + 1, Math.min(WORLD_W - r - 1, x))
  }

  private add(tier: number, x: number, y: number, opts: { grow?: boolean; junk?: boolean; vx?: number; vy?: number } = {}): FruitBody | null {
    if (this.fruits.size >= MAX_BODIES) return null
    const f = fruit(tier)
    const t = this.tune
    const r = opts.grow ? f.r * t.growFrom : f.r
    const body = Bodies.circle(x, y, r, {
      restitution: t.bounce,
      friction: t.friction,
      frictionStatic: t.frictionStatic,
      frictionAir: t.air,
      density: 0.001,
      slop: 0.04,
      label: 'fruit',
    })
    if (opts.vx || opts.vy) Body.setVelocity(body, { x: opts.vx ?? 0, y: opts.vy ?? 0 })
    const fb: FruitBody = { body, tier, born: this.time, over: 0, grow: opts.grow ? t.growSteps : 0, junk: Boolean(opts.junk), merged: Boolean(opts.grow) }
    this.fruits.set(body.id, fb)
    Composite.add(this.engine.world, body)
    return fb
  }

  private remove(fb: FruitBody) {
    this.fruits.delete(fb.body.id)
    Composite.remove(this.engine.world, fb.body)
  }

  /** Drop a fruit from the top at aim x. False if the jar is done or full. */
  drop(x: number, tier: number): boolean {
    if (this.over) return false
    return Boolean(this.add(tier, this.clampX(x, tier), DROP_Y))
  }

  /** Queue `n` junk fruit (tiers 1-3) to rain in from the top, a beat apart. */
  queueJunk(n: number) {
    let at = Math.max(this.time, this.junkQueue.at(-1)?.at ?? 0)
    for (let i = 0; i < n; i++) {
      const tier = 1 + Math.floor(this.rand() * JUNK_MAX_TIER)
      const r = fruit(tier).r
      const x = r + 4 + this.rand() * (WORLD_W - 2 * r - 8)
      at += JUNK_GAP_MS
      this.junkQueue.push({ tier, x, at })
    }
  }

  get junkPending() { return this.junkQueue.length }

  /** Advance by real elapsed ms (fixed steps inside). */
  step(ms: number) {
    if (this.over) return
    this.acc += Math.min(ms, 250)
    let steps = 0
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.fixedStep()
      this.acc -= STEP
      steps += 1
      if (this.over) break
    }
    // Way behind (tab was asleep): drop the backlog instead of spiraling.
    if (this.acc > STEP * MAX_STEPS) this.acc = 0
  }

  private fixedStep() {
    this.time += STEP
    while (this.junkQueue.length && this.junkQueue[0].at <= this.time) {
      const j = this.junkQueue.shift()!
      this.add(j.tier, j.x, DROP_Y - 40, { junk: true, vy: 2 })
    }
    for (const fb of this.fruits.values()) {
      if (fb.grow > 0) {
        const target = fruit(fb.tier).r
        const cur = fb.body.circleRadius ?? target
        const next = fb.grow === 1 ? target : cur + (target - cur) / fb.grow
        Body.scale(fb.body, next / cur, next / cur)
        fb.grow -= 1
      }
    }
    Engine.update(this.engine, STEP)
    this.resolveMerges()
    this.checkDanger()
  }

  private resolveMerges() {
    const merges = this.pending
    this.pending = []
    this.claimed.clear()
    for (const [a, b] of merges) {
      if (!this.fruits.has(a.body.id) || !this.fruits.has(b.body.id)) continue
      const x = (a.body.position.x + b.body.position.x) / 2
      const y = (a.body.position.y + b.body.position.y) / 2
      const points = pointsForPair(a.tier)
      this.remove(a)
      this.remove(b)
      this.score += points
      let made: number | null = null
      if (a.tier < TIERS) {
        made = a.tier + 1
        const vx = (a.body.velocity.x + b.body.velocity.x) / 2
        const vy = (a.body.velocity.y + b.body.velocity.y) / 2
        this.add(made, this.clampX(x, made), Math.min(y, WORLD_H - fruit(made).r), { grow: true, vx, vy })
      }
      this.onMerge?.({ tier: a.tier, made, points, x, y })
    }
  }

  private checkDanger() {
    let worst = 0
    for (const fb of this.fruits.values()) {
      const r = fb.body.circleRadius ?? fruit(fb.tier).r
      const above = fb.body.position.y - r < DANGER_Y
      const settled = this.time - fb.born > GRACE_MS && fb.body.speed < SETTLED_SPEED
      fb.over = above && settled ? fb.over + STEP : 0
      if (fb.over > worst) worst = fb.over
    }
    this.danger = Math.min(1, worst / OVER_MS)
    if (worst >= OVER_MS) this.over = true
  }

  /** Every fruit, for drawing and the stream. */
  list(): { id: number; born: number; merged: boolean; tier: number; x: number; y: number; r: number; angle: number; junk: boolean }[] {
    const out = []
    for (const fb of this.fruits.values()) {
      out.push({
        id: fb.body.id,
        born: fb.born,
        merged: fb.merged,
        tier: fb.tier,
        x: fb.body.position.x,
        y: fb.body.position.y,
        r: fb.body.circleRadius ?? fruit(fb.tier).r,
        angle: fb.body.angle,
        junk: fb.junk,
      })
    }
    return out
  }

  destroy() {
    Events.off(this.engine, 'collisionStart', this.onPairs)
    Events.off(this.engine, 'collisionActive', this.onPairs)
    Composite.clear(this.engine.world, false)
    Engine.clear(this.engine)
    this.fruits.clear()
  }
}
