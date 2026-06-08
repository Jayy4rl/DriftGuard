import { useRef, useEffect } from 'react'
import * as THREE from 'three'

// ── Trefoil knot via CatmullRom through sampled points ────────────────────
function makeTrefoil(samples = 600): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < samples; i++) {
    const phi = (2 * Math.PI * i) / samples
    pts.push(new THREE.Vector3(
      Math.sin(phi) + 2 * Math.sin(2 * phi),
      Math.cos(phi) - 2 * Math.cos(2 * phi),
      -Math.sin(3 * phi)
    ))
  }
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5)
}

// ── Flat ribbon geometry along a curve ────────────────────────────────────
function buildRibbon(
  curve: THREE.Curve<THREE.Vector3>,
  segments: number,
  halfW: number,   // ribbon half-width (normal direction)
  halfH: number    // ribbon half-thickness (binormal direction)
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(segments, true)
  const pos: number[] = []
  const idx: number[] = []

  // 4 corners per cross-section: (+W+H), (-W+H), (-W-H), (+W-H)
  const corners: [number, number][] = [[halfW, halfH], [-halfW, halfH], [-halfW, -halfH], [halfW, -halfH]]

  for (let i = 0; i < segments; i++) {
    const p = curve.getPointAt(i / segments)
    const N = frames.normals[i]
    const B = frames.binormals[i]
    for (const [w, h] of corners) {
      pos.push(
        p.x + w * N.x + h * B.x,
        p.y + w * N.y + h * B.y,
        p.z + w * N.z + h * B.z
      )
    }
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 4
    const b = ((i + 1) % segments) * 4
    // wide top face (corners 0,1)
    idx.push(a, b, a + 1,  b, b + 1, a + 1)
    // wide bottom face (corners 2,3)
    idx.push(a + 3, a + 2, b + 3,  b + 3, a + 2, b + 2)
    // thin right edge (corners 0,3)
    idx.push(a, a + 3, b,  b, a + 3, b + 3)
    // thin left edge (corners 1,2)
    idx.push(a + 2, a + 1, b + 2,  b + 2, a + 1, b + 1)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Ribbon3D() {
  const mountRef = useRef<HTMLDivElement>(null)
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    // ── Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.35
    el.appendChild(renderer.domElement)

    // ── Scene
    const scene = new THREE.Scene()

    // ── Camera
    const cam = new THREE.PerspectiveCamera(44, el.clientWidth / el.clientHeight, 0.1, 100)
    cam.position.set(0, 0, 14)

    // ── Lighting  (top rim cyan, fill blue, back warm)
    scene.add(new THREE.AmbientLight('#091830', 2.0))

    const keyLight = new THREE.DirectionalLight('#c5e8ff', 3.2)
    keyLight.position.set(-4, 7, 6)
    scene.add(keyLight)

    const cyanRim = new THREE.PointLight('#00E5B0', 6, 30)
    cyanRim.position.set(-6, 5, 9)
    scene.add(cyanRim)

    const blueFill = new THREE.PointLight('#2563FF', 3.5, 30)
    blueFill.position.set(6, -4, 6)
    scene.add(blueFill)

    const backRim = new THREE.PointLight('#00C2FF', 2.5, 20)
    backRim.position.set(2, -6, -4)
    scene.add(backRim)

    // ── Geometry — trefoil knot ribbon
    const curve = makeTrefoil(600)
    const geo   = buildRibbon(curve, 480, 0.30, 0.068)

    // ── Main glass material
    const mat = new THREE.MeshPhysicalMaterial({
      color:               new THREE.Color('#0d5470'),
      roughness:           0.06,
      metalness:           0.04,
      transmission:        0.40,
      thickness:           1.4,
      ior:                 1.48,
      clearcoat:           1.0,
      clearcoatRoughness:  0.04,
      transparent:         true,
      opacity:             0.93,
      side:                THREE.DoubleSide,
    })

    const mesh = new THREE.Mesh(geo, mat)

    // Orient so the knot silhouette matches the reference (heart-like, top-centered)
    mesh.rotation.set(0.18, 0.22, -0.08)
    mesh.scale.setScalar(0.92)
    scene.add(mesh)

    // ── Outer glow shell (back-face, additive cyan)
    const glowMat = new THREE.MeshBasicMaterial({
      color:       new THREE.Color('#00D0C0'),
      transparent: true,
      opacity:     0.045,
      side:        THREE.BackSide,
    })
    const glow = new THREE.Mesh(geo, glowMat)
    glow.scale.setScalar(1.055)
    scene.add(glow)

    // ── Inner edge highlight shell (slightly larger, additive)
    const edgeMat = new THREE.MeshBasicMaterial({
      color:       new THREE.Color('#00B8FF'),
      transparent: true,
      opacity:     0.025,
      side:        THREE.BackSide,
    })
    const edgeMesh = new THREE.Mesh(geo, edgeMat)
    edgeMesh.scale.setScalar(1.02)
    scene.add(edgeMesh)

    // ── Animation loop
    let raf: number
    let t = 0

    // Smooth lerp targets
    let rotX = mesh.rotation.x
    let rotY = mesh.rotation.y

    const tick = () => {
      raf = requestAnimationFrame(tick)
      t += 0.004

      // Floating
      const floatY = Math.sin(t * 0.72) * 0.18
      mesh.position.y  = floatY
      glow.position.y  = floatY
      edgeMesh.position.y = floatY

      // Slow auto-rotation + mouse parallax (smooth lerp)
      const tgtY = 0.22 + t * 0.07 + mouse.current.x * 0.38
      const tgtX = 0.18 + Math.sin(t * 0.45) * 0.07 + mouse.current.y * 0.28
      rotY += (tgtY - rotY) * 0.04
      rotX += (tgtX - rotX) * 0.04

      mesh.rotation.y = rotY
      mesh.rotation.x = rotX
      glow.rotation.copy(mesh.rotation)
      edgeMesh.rotation.copy(mesh.rotation)

      // Breathing scale
      const breathe = 1.0 + Math.sin(t * 1.05) * 0.013
      mesh.scale.setScalar(0.92 * breathe)
      glow.scale.setScalar(0.92 * breathe * 1.055)
      edgeMesh.scale.setScalar(0.92 * breathe * 1.02)

      // Pulsing rim light
      cyanRim.intensity = 6 + Math.sin(t * 1.7) * 0.9

      renderer.render(scene, cam)
    }
    tick()

    // ── Mouse parallax
    const onMouse = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      mouse.current = {
        x: ((e.clientX - r.left) / r.width  - 0.5) * 2,
        y: -((e.clientY - r.top)  / r.height - 0.5) * 2,
      }
    }
    window.addEventListener('mousemove', onMouse)

    // ── Resize
    const onResize = () => {
      cam.aspect = el.clientWidth / el.clientHeight
      cam.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('resize', onResize)
      geo.dispose()
      mat.dispose()
      glowMat.dispose()
      edgeMat.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    />
  )
}
