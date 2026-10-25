import { useEffect, useRef } from 'react'
import * as THREE from 'three'
export function SpaceScene({ enabled }: { enabled: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el || !enabled) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 0, 12)
    const group = new THREE.Group()
    scene.add(group)
    group.rotation.set(0.8, 0.25, -0.35)
    const material = new THREE.LineBasicMaterial({
      color: 0x55dcff,
      transparent: true,
      opacity: 0.55,
    })
    for (let i = 0; i < 4; i++) {
      const points = Array.from({ length: 181 }, (_, j) => {
        const a = (j / 180) * Math.PI * 2
        return new THREE.Vector3(
          Math.cos(a) * (3 + i * 0.22),
          Math.sin(a) * (3 + i * 0.22),
          0,
        )
      })
      const ring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        material,
      )
      ring.rotation.x = i * 0.35
      ring.rotation.y = i * 0.38
      group.add(ring)
    }
    const sphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.85, 2),
      new THREE.MeshBasicMaterial({
        color: 0xb088ff,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
      }),
    )
    group.add(sphere)
    const particles = new Float32Array(240 * 3)
    for (let i = 0; i < particles.length; i++)
      particles[i] = ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1) * 22
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(particles, 3))
    scene.add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          color: 0xc0ddff,
          size: 0.04,
          transparent: true,
          opacity: 0.5,
        }),
      ),
    )
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const draw = () => {
      if (!document.hidden) {
        group.rotation.z += 0.00055
        renderer.render(scene, camera)
      }
      if (!reduced.matches) frame = requestAnimationFrame(draw)
    }
    const change = () => {
      cancelAnimationFrame(frame)
      draw()
    }
    reduced.addEventListener('change', change)
    draw()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      reduced.removeEventListener('change', change)
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Line ||
          o instanceof THREE.Points
        ) {
          o.geometry.dispose()
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material]
          materials.forEach((m) => m.dispose())
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [enabled])
  return <div className="space-scene" ref={host} aria-hidden="true" />
}
