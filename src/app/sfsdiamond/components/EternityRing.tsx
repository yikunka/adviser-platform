'use client'

import { useEffect, useRef } from 'react'

type Vec3 = [number, number, number]

function torusPoint(u: number, v: number, R: number, r: number): Vec3 {
  return [
    (R + r * Math.cos(v)) * Math.cos(u),
    (R + r * Math.cos(v)) * Math.sin(u),
    r * Math.sin(v),
  ]
}

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

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

// Three light sources for crystal multi-reflection
const LIGHTS: { dir: Vec3; strength: number; color: [number, number, number] }[] = [
  { dir: normalize([0.5,  0.7,  0.9]), strength: 1.0,  color: [255, 252, 240] }, // main — warm white
  { dir: normalize([-0.6, 0.2,  0.5]), strength: 0.45, color: [200, 220, 255] }, // fill — cool blue
  { dir: normalize([0.1, -0.8,  0.4]), strength: 0.25, color: [255, 210, 180] }, // rim  — warm rose
]

export default function EternityRing() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const startTime = performance.now()

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

      const t = (performance.now() - startTime) * 0.001

      // Irregular organic motion — incommensurate frequencies, small amplitudes
      const aY = t * 0.22
            + 0.18 * Math.sin(t * 0.47)
            + 0.09 * Math.sin(t * 1.13 + 1.7)
            + 0.04 * Math.sin(t * 2.31 + 0.5)
      const aX = 0.50
            + 0.22 * Math.sin(t * 0.38 + 0.9)
            + 0.10 * Math.sin(t * 0.91 + 2.4)
            + 0.04 * Math.sin(t * 1.77 + 1.2)
      const aZ = 0.08 * Math.sin(t * 0.59 + 1.1)
            + 0.04 * Math.sin(t * 0.83 + 3.0)

      const minDim = Math.min(CW, CH)
      const R   = minDim * 0.30
      const r   = minDim * 0.088
      const fov = minDim * 1.9
      const cx  = CW * 0.5
      const cy  = CH * 0.5

      const U = 72  // facets around major circle
      const V = 30  // facets around tube

      type Face = {
        pts: [number, number][]
        z: number
        normal: Vec3
      }
      const faces: Face[] = []

      for (let i = 0; i < U; i++) {
        for (let j = 0; j < V; j++) {
          const u0 = (i       / U) * 2 * Math.PI
          const u1 = ((i + 1) / U) * 2 * Math.PI
          const v0 = (j       / V) * 2 * Math.PI
          const v1 = ((j + 1) / V) * 2 * Math.PI

          const raw: Vec3[] = [
            torusPoint(u0, v0, R, r),
            torusPoint(u1, v0, R, r),
            torusPoint(u1, v1, R, r),
            torusPoint(u0, v1, R, r),
          ]
          const corners = raw.map(p => rotZ(rotX(rotY(p, aY), aX), aZ)) as Vec3[]

          const e1: Vec3 = [corners[1][0]-corners[0][0], corners[1][1]-corners[0][1], corners[1][2]-corners[0][2]]
          const e2: Vec3 = [corners[3][0]-corners[0][0], corners[3][1]-corners[0][1], corners[3][2]-corners[0][2]]
          const nx = e1[1]*e2[2] - e1[2]*e2[1]
          const ny = e1[2]*e2[0] - e1[0]*e2[2]
          const nz = e1[0]*e2[1] - e1[1]*e2[0]
          const normal: Vec3 = [nx, ny, nz]

          const avgZ = (corners[0][2]+corners[1][2]+corners[2][2]+corners[3][2]) / 4
          const pts = corners.map(p => project(p, fov, cx, cy)) as [number, number][]

          faces.push({ pts, z: avgZ, normal })
        }
      }

      // Painter's algorithm — back to front so transparency layers correctly
      faces.sort((a, b) => a.z - b.z)

      for (const f of faces) {
        const n = normalize(f.normal)

        // Accumulate multi-light illumination
        let illumR = 0, illumG = 0, illumB = 0
        for (const light of LIGHTS) {
          const d = Math.max(0, dot(n, light.dir))
          // Crystal uses specular^4 to get sharp highlights
          const spec = Math.pow(d, 4) * light.strength
          const diff = d * light.strength * 0.3
          illumR += (diff + spec) * light.color[0]
          illumG += (diff + spec) * light.color[1]
          illumB += (diff + spec) * light.color[2]
        }

        // Primary dot with main light for alpha decisions
        const primaryDot = Math.max(0, dot(n, LIGHTS[0].dir))

        // Fill — crystal is mostly transparent; bright specular faces flash white
        let fillA: number
        let fR: number, fG: number, fB: number

        if (primaryDot > 0.82) {
          // Specular flash — near opaque bright white/cream
          fR = Math.min(255, illumR); fG = Math.min(255, illumG); fB = Math.min(255, illumB)
          fillA = 0.55
        } else if (primaryDot > 0.45) {
          // Mid-range crystal — warm white with slight gold cast
          fR = Math.min(255, illumR * 0.9 + 60)
          fG = Math.min(255, illumG * 0.9 + 40)
          fB = Math.min(255, illumB * 0.9 + 20)
          fillA = 0.18 + primaryDot * 0.20
        } else if (primaryDot > 0.1) {
          // Shadow-side — cool dark crystal, slight indigo
          fR = 45; fG = 38; fB = 65
          fillA = 0.10 + primaryDot * 0.08
        } else {
          // Back face — almost invisible
          fR = 20; fG = 15; fB = 35
          fillA = 0.05
        }

        ctx!.beginPath()
        ctx!.moveTo(f.pts[0][0], f.pts[0][1])
        for (let k = 1; k < f.pts.length; k++) ctx!.lineTo(f.pts[k][0], f.pts[k][1])
        ctx!.closePath()
        ctx!.fillStyle = `rgba(${Math.round(fR)},${Math.round(fG)},${Math.round(fB)},${fillA})`
        ctx!.fill()

        // Facet edge lines — brightest on lit faces, invisible on dark
        const edgeA = primaryDot > 0.6
          ? 0.55
          : primaryDot > 0.2
          ? 0.20
          : 0.06
        if (edgeA > 0.05) {
          ctx!.strokeStyle = `rgba(245,238,215,${edgeA})`
          ctx!.lineWidth = primaryDot > 0.6 ? 0.8 : 0.4
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
