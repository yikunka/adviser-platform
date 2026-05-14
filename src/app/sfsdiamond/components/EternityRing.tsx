'use client'

import { useEffect, useRef } from 'react'

type Vec3 = [number, number, number]

// ── Figure-8 spine (Lissajous 1:2) ──────────────────────────────────────────
// x = Rx·sin(2t),  y = Ry·cos(t),  z = 0
// Ry ≈ 1.8·Rx  →  each loop looks roughly circular like the digit "8"

function spinePoint(t: number, Rx: number, Ry: number): Vec3 {
  return [Rx * Math.sin(2 * t), Ry * Math.cos(t), 0]
}

// Analytical (unit) tangent
function spineTangent(t: number, Rx: number, Ry: number): Vec3 {
  const dx = 2 * Rx * Math.cos(2 * t)
  const dy = -Ry * Math.sin(t)
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  return [dx / len, dy / len, 0]
}

// Tube cross-section:  N = (–Ty, Tx, 0)  B = (0,0,1)
function tubePoint(t: number, v: number, Rx: number, Ry: number, r: number): Vec3 {
  const C = spinePoint(t, Rx, Ry)
  const T = spineTangent(t, Rx, Ry)
  return [
    C[0] + r * Math.cos(v) * (-T[1]),
    C[1] + r * Math.cos(v) *   T[0],
    r * Math.sin(v),
  ]
}

// Outward surface normal (already unit length for planar spine)
function tubeNormal(t: number, v: number, Rx: number, Ry: number): Vec3 {
  const T = spineTangent(t, Rx, Ry)
  return [-T[1] * Math.cos(v), T[0] * Math.cos(v), Math.sin(v)]
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

// ── Three-point crystal lighting ─────────────────────────────────────────────
type Light = { dir: Vec3; rgb: [number, number, number]; s: number }
function L(dx: number, dy: number, dz: number, rgb: [number, number, number], s: number): Light {
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
  return { dir: [dx / len, dy / len, dz / len], rgb, s }
}
const LIGHTS: Light[] = [
  L( 0.45,  0.65,  0.85, [255, 252, 242], 1.00), // main  — warm white
  L(-0.55,  0.25,  0.55, [180, 210, 255], 0.45), // fill  — cool blue
  L( 0.10, -0.75,  0.40, [255, 200, 175], 0.25), // rim   — warm rose
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

      // Steady slow rotation around Y axis; fixed X tilt so both faces stay visible
      const aY = elapsed * 0.25
      const aX = 0.52
      const aZ = 0

      const min = Math.min(CW, CH)
      const Rx  = min * 0.21   // half-width of each loop
      const Ry  = min * 0.32   // half-height  (Ry/Rx ≈ 1.52  →  loops look like "8")
      const r   = min * 0.072  // tube radius
      const fov = min * 1.9
      const cx  = CW * 0.5
      const cy  = CH * 0.5

      const U = 96  // segments along the spine
      const V = 32  // segments around the tube

      type Face = { pts: [number, number][]; z: number; n: Vec3 }
      const faces: Face[] = []

      for (let i = 0; i < U; i++) {
        for (let j = 0; j < V; j++) {
          const t1 = (i       / U) * 2 * Math.PI
          const t2 = ((i + 1) / U) * 2 * Math.PI
          const v1 = (j       / V) * 2 * Math.PI
          const v2 = ((j + 1) / V) * 2 * Math.PI

          const rawPts: Vec3[] = [
            tubePoint(t1, v1, Rx, Ry, r),
            tubePoint(t2, v1, Rx, Ry, r),
            tubePoint(t2, v2, Rx, Ry, r),
            tubePoint(t1, v2, Rx, Ry, r),
          ]
          const rawN = tubeNormal((t1 + t2) * 0.5, (v1 + v2) * 0.5, Rx, Ry)

          const rot = (p: Vec3) => rotZ(rotX(rotY(p, aY), aX), aZ)
          const corners = rawPts.map(rot) as Vec3[]
          const n       = rot(rawN)

          const avgZ = corners.reduce((s, p) => s + p[2], 0) / 4
          const pts  = corners.map(p => project(p, fov, cx, cy)) as [number, number][]

          faces.push({ pts, z: avgZ, n })
        }
      }

      // Painter's algorithm — back to front for correct transparency layering
      faces.sort((a, b) => a.z - b.z)

      for (const f of faces) {
        let iR = 0, iG = 0, iB = 0
        for (const L of LIGHTS) {
          const d    = Math.max(0, dot3(f.n, L.dir))
          const spec = d ** 5 * L.s        // sharp specular flash
          const diff = d      * L.s * 0.25 // soft diffuse
          iR += (diff + spec) * L.rgb[0]
          iG += (diff + spec) * L.rgb[1]
          iB += (diff + spec) * L.rgb[2]
        }

        const pd = Math.max(0, dot3(f.n, LIGHTS[0].dir)) // primary dot

        let fR: number, fG: number, fB: number, fa: number

        if (pd > 0.85) {
          // Specular flash — near-white
          fR = Math.min(255, iR); fG = Math.min(255, iG); fB = Math.min(255, iB)
          fa = 0.60
        } else if (pd > 0.50) {
          // Crystal mid-tone — warm with slight gold
          fR = Math.min(255, iR * 0.85 + 55)
          fG = Math.min(255, iG * 0.85 + 38)
          fB = Math.min(255, iB * 0.85 + 22)
          fa = 0.18 + pd * 0.24
        } else if (pd > 0.15) {
          // Shadow side — cool indigo
          fR = 48; fG = 40; fB = 70
          fa = 0.09 + pd * 0.10
        } else {
          // Back face — near invisible
          fR = 16; fG = 12; fB = 28
          fa = 0.04
        }

        ctx!.beginPath()
        ctx!.moveTo(f.pts[0][0], f.pts[0][1])
        for (let k = 1; k < f.pts.length; k++) ctx!.lineTo(f.pts[k][0], f.pts[k][1])
        ctx!.closePath()
        ctx!.fillStyle = `rgba(${Math.round(fR)},${Math.round(fG)},${Math.round(fB)},${fa})`
        ctx!.fill()

        // Facet edge — only visible on lit surfaces
        const ea = pd > 0.65 ? 0.58 : pd > 0.25 ? 0.20 : 0.04
        if (ea > 0.04) {
          ctx!.strokeStyle = `rgba(245,238,215,${ea})`
          ctx!.lineWidth = pd > 0.65 ? 0.85 : 0.38
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
