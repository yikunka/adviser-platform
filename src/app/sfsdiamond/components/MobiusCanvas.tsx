'use client'

import { useEffect, useRef } from 'react'

type Vec3 = [number, number, number]

function mobiusPoint(u: number, v: number, R: number, W: number): Vec3 {
  return [
    (R + W * v * Math.cos(u / 2)) * Math.cos(u),
    (R + W * v * Math.cos(u / 2)) * Math.sin(u),
    W * v * Math.sin(u / 2),
  ]
}

function rotX(p: Vec3, a: number): Vec3 {
  return [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)]
}

function rotY(p: Vec3, a: number): Vec3 {
  return [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)]
}

function project(p: Vec3, fov: number, cx: number, cy: number): [number, number] {
  const z = p[2] + fov
  const s = fov / Math.max(z, 1)
  return [cx + p[0] * s, cy - p[1] * s]
}

export default function MobiusCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let angle = 0

    function resize() {
      const dpr = window.devicePixelRatio || 1
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.scale(dpr, dpr)
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Light direction (top-right-front)
    const LX = 0.35, LY = 0.55, LZ = 0.76

    function draw() {
      const dpr = window.devicePixelRatio || 1
      const CW = canvas!.width / dpr
      const CH = canvas!.height / dpr
      if (CW === 0 || CH === 0) { animId = requestAnimationFrame(draw); return }

      ctx!.clearRect(0, 0, CW, CH)
      angle += 0.003

      const minDim = Math.min(CW, CH)
      const R  = minDim * 0.40   // large radius — fills the hero
      const W  = minDim * 0.13   // half-width of ribbon
      const fov = minDim * 1.6
      const cx = CW * 0.5
      const cy = CH * 0.5
      const tiltX = 0.38         // ~22° tilt so both faces show

      const U_STEPS = 160

      type Face = {
        pts: [number, number][]
        z: number
        bright: number
        alpha: number
      }
      const faces: Face[] = []

      for (let i = 0; i < U_STEPS; i++) {
        const u0 = (i / U_STEPS) * 2 * Math.PI
        const u1 = ((i + 1) / U_STEPS) * 2 * Math.PI

        const raw: Vec3[] = [
          mobiusPoint(u0, -1, R, W),
          mobiusPoint(u1, -1, R, W),
          mobiusPoint(u1,  1, R, W),
          mobiusPoint(u0,  1, R, W),
        ]

        const rot = raw.map(p => rotX(rotY(rotX(p, tiltX), angle), 0)) as Vec3[]

        // Face normal via cross product
        const e1: Vec3 = [rot[1][0]-rot[0][0], rot[1][1]-rot[0][1], rot[1][2]-rot[0][2]]
        const e2: Vec3 = [rot[3][0]-rot[0][0], rot[3][1]-rot[0][1], rot[3][2]-rot[0][2]]
        const nx = e1[1]*e2[2] - e1[2]*e2[1]
        const ny = e1[2]*e2[0] - e1[0]*e2[2]
        const nz = e1[0]*e2[1] - e1[1]*e2[0]
        const nlen = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1

        const dot = (nx/nlen)*LX + (ny/nlen)*LY + (nz/nlen)*LZ
        const bright = Math.max(0.15, dot)

        const avgZ = (rot[0][2]+rot[1][2]+rot[2][2]+rot[3][2]) / 4
        const pts = rot.map(p => project(p, fov, cx, cy)) as [number, number][]

        faces.push({ pts, z: avgZ, bright, alpha: 0.9 })
      }

      // Painter's algorithm — back to front
      faces.sort((a, b) => a.z - b.z)

      for (const f of faces) {
        const b = f.bright

        // Gold front / deep bronze back
        const r = Math.round(Math.min(255, 255  * b + 30))
        const g = Math.round(Math.min(255, 195  * b))
        const bv = Math.round(Math.min(255, 80  * b))

        ctx!.beginPath()
        ctx!.moveTo(f.pts[0][0], f.pts[0][1])
        for (let j = 1; j < f.pts.length; j++) ctx!.lineTo(f.pts[j][0], f.pts[j][1])
        ctx!.closePath()
        ctx!.fillStyle = `rgba(${r},${g},${bv},${f.alpha})`
        ctx!.fill()

        // Subtle inner edge lines
        ctx!.strokeStyle = `rgba(245,236,208,${b * 0.18})`
        ctx!.lineWidth = 0.5
        ctx!.stroke()
      }

      // ── Draw the single continuous Möbius edge as a bright gold ribbon ──
      // edge at v = +1 for u = 0..4π (wraps once, completing the single edge)
      const EDGE_STEPS = 320
      ctx!.beginPath()
      for (let i = 0; i <= EDGE_STEPS; i++) {
        const u = (i / EDGE_STEPS) * 4 * Math.PI
        const p = mobiusPoint(u, 1, R, W)
        const rp = rotX(rotY(rotX(p, tiltX), angle), 0)
        const [px, py] = project(rp, fov, cx, cy)
        i === 0 ? ctx!.moveTo(px, py) : ctx!.lineTo(px, py)
      }
      ctx!.strokeStyle = 'rgba(245,236,208,0.55)'
      ctx!.lineWidth = 1.4
      ctx!.stroke()

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block"
      aria-hidden
    />
  )
}
