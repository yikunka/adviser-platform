'use client'

import { useEffect, useRef } from 'react'

type Vec3 = [number, number, number]

// ── Lemniscate of Bernoulli spine ────────────────────────────────────────────
// (x²+y²)² = a²(x²−y²)  →  parametric:
//   x = a·cos(t) / (1+sin²t)
//   y = a·sin(t)·cos(t) / (1+sin²t)
//
// Bernoulli lemniscate in xy; small z = zAmp·sin(t) separates the two branches at the
// self-crossing (they meet at t = π/2 and 3π/2 in xy but at ±zAmp in 3D — reads as over/under).
//
// Minimum radius of curvature ≈ a/3 at the loop tips.
// Keeping rWide < a/3 guarantees the ribbon never folds at any bend.

function scale3(p: Vec3, s: number): Vec3 {
  return [p[0] * s, p[1] * s, p[2] * s]
}

/** Shortest param distance from t {mod 2π} to crossings π/2 or 3π/2. */
function paramDistToCrossings(t: number): number {
  const u = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  return Math.min(Math.abs(u - Math.PI / 2), Math.abs(u - 3 * Math.PI / 2))
}

/** Slight pinch at crossings: thins the tube where branches still crowd in projection. */
function crossingPinch(t: number): number {
  const d = paramDistToCrossings(t)
  return 0.78 + 0.22 * (1 - Math.exp(-((d * 4.2) ** 2)))
}

function spinePoint(t: number, a: number, zAmp: number): Vec3 {
  const s = Math.sin(t), c = Math.cos(t)
  const D = 1 + s * s
  return [a * c / D, a * s * c / D, zAmp * s]
}

function ribbonFrame(
  t: number,
  a: number,
  zAmp: number,
): { C: Vec3; T: Vec3; N: Vec3; B: Vec3 } {
  const eps = 0.0004
  const C = spinePoint(t, a, zAmp)
  const p0 = spinePoint(t - eps, a, zAmp)
  const p1 = spinePoint(t + eps, a, zAmp)
  const T = normalize3(sub3(p1, p0))
  let up: Vec3 = [0, 0, 1]
  if (Math.abs(dot3(T, up)) > 0.92) up = [1, 0, 0]
  let N = cross3(up, T)
  let nlen = Math.hypot(N[0], N[1], N[2])
  if (nlen < 1e-10) {
    up = [0, 1, 0]
    N = cross3(up, T)
    nlen = Math.hypot(N[0], N[1], N[2]) || 1
  }
  N = scale3(N, 1 / nlen)
  const B = normalize3(cross3(T, N))
  return { C, T, N, B }
}

// Elliptic tube (ribbon) along 3D spine using ribbon frame (N,B) ⊥ T.
function tubePoint(
  t: number,
  v: number,
  a: number,
  rWide: number,
  rThin: number,
  zAmp: number,
): Vec3 {
  const { C, N, B } = ribbonFrame(t, a, zAmp)
  const pinch = crossingPinch(t)
  const rw = rWide * pinch
  const rt = rThin * pinch
  const cv = Math.cos(v), sv = Math.sin(v)
  return add3(C, add3(scale3(N, rw * cv), scale3(B, rt * sv)))
}

function tubeNormal(t: number, v: number, a: number, rWide: number, rThin: number, zAmp: number): Vec3 {
  const { N, B } = ribbonFrame(t, a, zAmp)
  const pinch = crossingPinch(t)
  const rw = rWide * pinch
  const rt = rThin * pinch
  const cv = Math.cos(v), sv = Math.sin(v)
  return normalize3(add3(scale3(N, cv / rw), scale3(B, sv / rt)))
}

// ── Rotation helpers ─────────────────────────────────────────────────────────
function rotX(p: Vec3, a: number): Vec3 {
  return [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)]
}
function rotY(p: Vec3, a: number): Vec3 {
  return [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)]
}
function rotZ(p: Vec3, a: number): Vec3 {
  return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]]
}

function project(p: Vec3, fov: number, cx: number, cy: number): [number, number] {
  const z = p[2] + fov
  const s = fov / Math.max(z, 1)
  return [cx + p[0] * s, cy - p[1] * s]
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

/** Unit normal for triangle a→b→c; flip so it matches analytic outward dir when degenerate. */
function triNormalToward(a: Vec3, b: Vec3, c: Vec3, outwardHint: Vec3): Vec3 {
  const e1 = sub3(b, a)
  const e2 = sub3(c, a)
  let n = normalize3(cross3(e1, e2))
  if (dot3(n, outwardHint) < 0) n = [-n[0], -n[1], -n[2]]
  return n
}

function normalize3(p: Vec3): Vec3 {
  const len = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) || 1
  return [p[0] / len, p[1] / len, p[2] / len]
}

/** Slow, asynchronous shimmer per facet (0–1), diamond-like fire without white noise. */
function sparkleShimmer(facetId: number, t: number): number {
  const h = Math.sin(facetId * 127.1 + facetId * 19.3) * 43758.5453
  const w = h - Math.floor(h)
  // Lower oscillation rate so sparkles linger — less busy than ~0.9–2.7 Hz equivalent
  const speed = 0.38 + w * 0.72
  const s = 0.5 + 0.5 * Math.sin(t * speed * Math.PI * 2 + w * 10.995)
  return s * s * s * s
}

/** Inverse of `rotZ(rotX(rotY(p, aY), aX), aZ)` — maps fixed camera +Z into rotated object space. */
function invCameraView(aY: number, aX: number, aZ: number): Vec3 {
  return normalize3(rotY(rotX(rotZ([0, 0, 1], -aZ), -aX), -aY))
}

// ── Three-point crystal lighting ─────────────────────────────────────────────
type Light = { dir: Vec3; rgb: [number, number, number]; s: number }
function L(dx: number, dy: number, dz: number, rgb: [number, number, number], s: number): Light {
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
  return { dir: [dx / len, dy / len, dz / len], rgb, s }
}
const LIGHTS: Light[] = [
  L( 0.40,  0.60,  0.88, [255, 252, 248], 1.00),   // key — crisp showroom
  L(-0.50,  0.20,  0.50, [198, 228, 255], 0.55),  // cool fill
  L( 0.10, -0.70,  0.36, [255, 210, 180], 0.30),  // warm rim
  L( 0.18,  0.85, -0.32, [255, 236, 210], 0.24),  // warm bounce — tray / flesh fill under stone
]

export default function EternityRing() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const t0 = performance.now()

    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas!.width  = canvas!.offsetWidth  * dpr
      canvas!.height = canvas!.offsetHeight * dpr
      ctx!.scale(dpr, dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function draw() {
      const dpr = window.devicePixelRatio || 1
      const CW = canvas!.width  / dpr
      const CH = canvas!.height / dpr
      if (CW === 0 || CH === 0) { animId = requestAnimationFrame(draw); return }

      ctx!.clearRect(0, 0, CW, CH)

      const elapsed = (performance.now() - t0) * 0.001
      const speed = 0.7 // overall motion 30% slower

      // Bounded oscillation (not endless tumble): stay mostly front / ¾-view.
      // Especially caps |aX| so the ribbon rarely turns full edge-on to the camera.
      const w = elapsed * speed
      const aY = Math.sin(w * 0.152) * 0.28 + Math.sin(w * 0.059 * Math.PI) * 0.09
      const aX = Math.sin(w * 0.082) * 0.18 + Math.cos(w * 0.047) * 0.05
      const aZ = Math.sin(w * 0.102) * 0.40 + Math.sin(w * 0.053) * 0.14

      // Eye along +Z (weak perspective); transform into the same space as rotated facet normals.
      const viewDir = invCameraView(aY, aX, aZ)

      const min = Math.min(CW, CH)
      // Lemniscate + ribbon cross-section (uniform scale); rWide < a/3 avoids folding
      const a = min * 0.325
      const rWide = min * 0.03965
      const rThin = min * 0.0247
      // Vertical separation at the lemniscate self-crossing (xy meet at origin twice)
      const zAmp = min * 0.058
      const fov = min * 1.9

      let cx = CW * 0.5
      let cy = CH * 0.5
      const anchor = typeof document !== 'undefined'
        ? document.querySelector('[data-sfs-hero-eternity-anchor]')
        : null
      if (anchor instanceof HTMLElement && canvas) {
        const cr = canvas.getBoundingClientRect()
        const er = anchor.getBoundingClientRect()
        cx = er.right - cr.left
        cy = er.top + er.height * 0.52 - cr.top
      }

      // Triangle mesh, coarser than quad grid — reads more like jewel facets than a UV rectangle
      const U = 46
      const V = 13

      type Face = { pts: [number, number][]; z: number; n: Vec3; facetId: number }
      const faces: Face[] = []

      const rot = (p: Vec3) => rotZ(rotX(rotY(p, aY), aX), aZ)

      for (let i = 0; i < U; i++) {
        for (let j = 0; j < V; j++) {
          const t1 = (i       / U) * 2 * Math.PI
          const t2 = ((i + 1) / U) * 2 * Math.PI
          const v1 = (j       / V) * 2 * Math.PI
          const v2 = ((j + 1) / V) * 2 * Math.PI

          const p00 = rot(tubePoint(t1, v1, a, rWide, rThin, zAmp))
          const p10 = rot(tubePoint(t2, v1, a, rWide, rThin, zAmp))
          const p11 = rot(tubePoint(t2, v2, a, rWide, rThin, zAmp))
          const p01 = rot(tubePoint(t1, v2, a, rWide, rThin, zAmp))

          const hint = rot(
            tubeNormal((t1 + t2) * 0.5, (v1 + v2) * 0.5, a, rWide, rThin, zAmp),
          )

          const cell = i * V + j
          const nA = triNormalToward(p00, p10, p11, hint)
          const zA = (p00[2] + p10[2] + p11[2]) / 3
          const ptsA = [p00, p10, p11].map(p => project(p, fov, cx, cy)) as [number, number][]
          faces.push({ pts: ptsA, z: zA, n: nA, facetId: cell * 2 })

          const nB = triNormalToward(p00, p11, p01, hint)
          const zB = (p00[2] + p11[2] + p01[2]) / 3
          const ptsB = [p00, p11, p01].map(p => project(p, fov, cx, cy)) as [number, number][]
          faces.push({ pts: ptsB, z: zB, n: nB, facetId: cell * 2 + 1 })
        }
      }

      // Painter's algorithm — back to front for correct transparency layering
      faces.sort((a, b) => a.z - b.z)

      for (const f of faces) {
        const L0 = LIGHTS[0]
        const n = f.n
        const pd = Math.max(0, dot3(n, L0.dir))
        const pv = Math.max(0, dot3(n, viewDir))

        const H = normalize3(add3(L0.dir, viewDir))
        const ph = Math.max(0, dot3(n, H))

        const specTight = ph ** 118
        const specMed = ph ** 34 * 0.62
        const specWide = ph ** 11 * 0.16
        const specPin = ph ** 168 * 0.42
        let spec = (specTight + specMed + specWide + specPin) * L0.s

        const edgePow = Math.max(0, 1 - pv)
        const fresnelBoost = edgePow ** 3.2 * (0.24 + ph * 0.58)
        spec += fresnelBoost

        const rimGlint = pv ** 9 * (ph ** 6) * 0.38
        const shimmer = sparkleShimmer(f.facetId, elapsed) * (ph ** 12) * 0.5
        spec += rimGlint + shimmer

        const steps = 6
        const body = (Math.floor(pd * steps) / Math.max(1, steps - 1)) * L0.s * 0.24

        let fill = 0
        for (let li = 1; li < LIGHTS.length; li++) {
          const L = LIGHTS[li]
          fill += Math.max(0, dot3(n, L.dir)) * L.s * 0.18
        }

        const env = edgePow ** 2 * 0.15 * pd
        const envR = 210 * env
        const envG = 228 * env
        const envB = 252 * env

        const sparkle = spec
        const hot = shimmer > 0.52 && ph > 0.52

        let iR = (body + fill + sparkle) * L0.rgb[0] + envR * 0.4
        let iG = (body + fill + sparkle) * L0.rgb[1] + envG * 0.38
        let iB = (body + fill + sparkle) * L0.rgb[2] + envB * 0.48

        const disp = (f.facetId * 0.6180339887 + elapsed * 0.19) % (Math.PI * 2)
        const fireW = Math.min(1, sparkle * 1.1) * (hot ? 0.15 : 0.085)
        iR += fireW * (16 + 10 * Math.sin(disp))
        iG += fireW * (7 + 5 * Math.sin(disp + 2.1))
        iB += fireW * (12 + 9 * Math.sin(disp + 4.15))

        let fR: number, fG: number, fB: number, fa: number

        if (sparkle > 0.62 || pd > 0.86 || hot) {
          fR = Math.min(255, iR * 1.06 + 48 + (hot ? 28 : 0))
          fG = Math.min(255, iG + 30 + (hot ? 22 : 0))
          fB = Math.min(255, iB * 0.96 + 26 + (hot ? 14 : 0))
          fa = 0.58 + Math.min(0.28, sparkle * 0.1) + (hot ? 0.1 : 0)
        } else if (pd > 0.38) {
          fR = Math.min(255, iR * 0.76 + 52 + edgePow * 20)
          fG = Math.min(255, iG * 0.74 + 40 + edgePow * 15)
          fB = Math.min(255, iB * 0.72 + 30 + edgePow * 24)
          fa = 0.15 + pd * 0.25 + edgePow * 0.07
        } else if (pd > 0.1) {
          const deep = pd / 0.42
          fR = 26 + deep * 48
          fG = 22 + deep * 44
          fB = 46 + deep * 74
          fa = 0.11 + pd * 0.14 + edgePow * 0.055
        } else {
          fR = 7; fG = 5; fB = 16
          fa = 0.028 + edgePow * 0.025
        }

        ctx!.beginPath()
        ctx!.moveTo(f.pts[0][0], f.pts[0][1])
        for (let k = 1; k < 3; k++) ctx!.lineTo(f.pts[k][0], f.pts[k][1])
        ctx!.closePath()
        ctx!.fillStyle = `rgba(${Math.round(fR)},${Math.round(fG)},${Math.round(fB)},${fa})`
        ctx!.fill()

        const ea = sparkle > 0.32 ? 0.7 : pd > 0.52 ? 0.5 : pd > 0.2 ? 0.2 : 0.038
        if (ea > 0.04) {
          const lineAlpha = (hot ? Math.min(0.88, ea + 0.14) : ea) * 0.6
          ctx!.strokeStyle = `rgba(255,250,242,${lineAlpha})`
          ctx!.lineWidth = hot ? 1.1 : sparkle > 0.32 ? 1.0 : pd > 0.52 ? 0.54 : 0.34
          ctx!.stroke()
        }
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => { cancelAnimationFrame(animId); ro.disconnect() }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" aria-hidden />
}
