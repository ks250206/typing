import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type PlanetStyle = 'gas' | 'ocean' | 'rock' | 'ice'

/** Small, local, deterministic textures: no downloads or per-frame texture work. */
function planetTexture(
  style: PlanetStyle,
  palette: [number, number, number],
  seed: number,
) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const pixels = ctx.createImageData(canvas.width, canvas.height)
  const colors = palette.map((color) => [
    color >> 16,
    (color >> 8) & 255,
    color & 255,
  ])
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const u = (x / canvas.width) * Math.PI * 2
      const v = (y / canvas.height) * Math.PI
      const noise =
        Math.sin(u * 5 + Math.sin(v * 11) + seed) * Math.cos(v * 13 + seed) +
        0.5 * Math.sin(u * 13 + Math.cos(v * 7)) * Math.sin(v * 29)
      let value =
        style === 'gas'
          ? 0.5 +
            0.23 * Math.sin(v * 36 + noise * 0.7) +
            0.17 * Math.sin(v * 13)
          : 0.5 + noise * 0.27
      if (style === 'ocean')
        value = value > 0.56 ? 0.65 + value * 0.2 : value * 0.35
      if (style === 'ice') value = 0.35 + value * 0.6
      const polar = Math.abs(Math.cos(v))
      if (style !== 'gas' && polar > 0.95) value = 0.95
      const t = Math.max(0, Math.min(0.999, value)) * 2
      const low = Math.floor(t),
        mix = t - low
      const index = (y * canvas.width + x) * 4
      for (let c = 0; c < 3; c++)
        pixels.data[index + c] =
          colors[low][c] * (1 - mix) + colors[low + 1][c] * mix
      pixels.data[index + 3] = 255
    }
  }
  ctx.putImageData(pixels, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  return texture
}

function glowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.16, '#ffffffd0')
  gradient.addColorStop(0.4, '#ffffff35')
  gradient.addColorStop(1, '#ffffff00')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

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
      return // The CSS planets remain visible when WebGL is unavailable.
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    el.dataset.rendering = 'webgl'
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120)
    camera.position.z = 20
    scene.add(new THREE.AmbientLight(0x9bb6ff, 0.9))
    const sunlight = new THREE.DirectionalLight(0xffead0, 3.2)
    sunlight.position.set(-6, 9, 10)
    scene.add(sunlight)
    const rim = new THREE.DirectionalLight(0x687dff, 1.8)
    rim.position.set(8, -3, -5)
    scene.add(rim)

    const textures: THREE.Texture[] = []
    const sphere = new THREE.SphereGeometry(1, 48, 32)
    const glow = glowTexture()
    textures.push(glow)
    const specs: {
      style: PlanetStyle
      palette: [number, number, number]
      x: number
      y: number
      z: number
      radius: number
      ring?: boolean
    }[] = [
      {
        style: 'gas',
        palette: [0x63436d, 0xd29475, 0xffe1ae],
        x: 5.8,
        y: 4.7,
        z: 0,
        radius: 1.75,
        ring: true,
      },
      {
        style: 'ocean',
        palette: [0x092f62, 0x147c98, 0x97e7be],
        x: 1.5,
        y: 7.5,
        z: -9,
        radius: 1.45,
      },
      {
        style: 'rock',
        palette: [0x572c43, 0xb84f38, 0xeeb384],
        x: 10,
        y: 3,
        z: -13,
        radius: 1.35,
      },
      {
        style: 'ice',
        palette: [0x42417e, 0x8c8ccc, 0xe3dfff],
        x: -8,
        y: -3.8,
        z: -8,
        radius: 1.6,
      },
      {
        style: 'gas',
        palette: [0x133c66, 0x32a5bc, 0xa4eeeb],
        x: 10,
        y: -7,
        z: -12,
        radius: 2.1,
        ring: true,
      },
      {
        style: 'rock',
        palette: [0x312c58, 0x8e527b, 0xe0a2c1],
        x: -10,
        y: 8,
        z: -22,
        radius: 1.8,
      },
    ]
    const planets = specs.map((spec, i) => {
      const map = planetTexture(spec.style, spec.palette, i * 1.7)
      textures.push(map)
      const material = new THREE.MeshStandardMaterial({
        map,
        roughness: 0.88,
        metalness: 0.03,
      })
      const body = new THREE.Mesh(sphere, material)
      const group = new THREE.Group()
      body.rotation.z = 0.18 + i * 0.1
      group.add(body)
      if (spec.ring) {
        const rings = new THREE.Group()
        for (let r = 0; r < 5; r++) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(1.35 + r * 0.17, 1.47 + r * 0.17, 96),
            new THREE.MeshStandardMaterial({
              color: spec.palette[r % 3],
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.55,
              roughness: 1,
              depthWrite: false,
            }),
          )
          rings.add(ring)
        }
        rings.rotation.set(-0.85, -0.25, -0.35)
        group.add(rings)
      }
      group.scale.setScalar(spec.radius)
      group.position.set(spec.x, spec.y, spec.z)
      scene.add(group)
      return { group, body, spec }
    })
    const sun = new THREE.Group()
    sun.add(
      new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffeed3 })),
    )
    sun.children[0].scale.setScalar(0.48)
    const corona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color: 0xffaa60,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    corona.scale.set(9, 9, 1)
    sun.add(corona)
    sun.position.set(-2, 7, -20)
    scene.add(sun)

    const count = 650
    const starPositions = new Float32Array(count * 3)
    const starColors = new Float32Array(count * 3)
    const random = (n: number) => {
      const v = Math.sin(n * 127.1 + 311.7) * 43758.5453
      return v - Math.floor(v)
    }
    const starPalette = [
      new THREE.Color(0xbadfff),
      new THREE.Color(0xffd9ba),
      new THREE.Color(0xd6c4ff),
    ]
    for (let i = 0; i < count; i++) {
      starPositions[i * 3] = (random(i * 3) - 0.5) * 85
      starPositions[i * 3 + 1] = (random(i * 3 + 1) - 0.5) * 55
      starPositions[i * 3 + 2] = -60 + random(i * 3 + 2) * 70
      starPalette[i % 3].toArray(starColors, i * 3)
    }
    const stars = new THREE.BufferGeometry()
    stars.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    stars.setAttribute('color', new THREE.BufferAttribute(starColors, 3))
    scene.add(
      new THREE.Points(
        stars,
        new THREE.PointsMaterial({
          map: glow,
          size: 0.18,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    )

    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let last = 0
    let elapsed = 0
    let lost = false
    let horizontalScale = 1
    const draw = () => {
      if (!lost && !document.hidden) renderer.render(scene, camera)
    }
    const resize = () => {
      const w = Math.max(1, el.clientWidth),
        h = Math.max(1, el.clientHeight)
      renderer.setPixelRatio(
        Math.min(devicePixelRatio, 1.5, Math.sqrt(1_600_000 / (w * h))),
      )
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      horizontalScale = Math.min(1, camera.aspect / 1.35)
      for (const { group, spec } of planets) {
        group.position.x = spec.x * horizontalScale
        group.scale.setScalar(spec.radius * (0.65 + horizontalScale * 0.35))
      }
      draw() // Reduced-motion scenes must also redraw after resize.
    }
    const animate = (now: number) => {
      if (document.hidden || reduced.matches || lost) return
      if (last && now - last < 1000 / 30) {
        frame = requestAnimationFrame(animate)
        return
      }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
      last = now
      elapsed += dt
      for (const { group, body, spec } of planets) {
        // Continuous travel, recycling only after a planet has passed the camera.
        const travel = ((elapsed * 0.34 + spec.z + 48) % 62) - 48
        group.position.set(
          (spec.x + Math.sin(elapsed * 0.025) * 0.6) * horizontalScale,
          spec.y,
          travel,
        )
        body.rotation.y += dt * 0.045
      }
      for (let i = 2; i < starPositions.length; i += 3) {
        starPositions[i] += dt * 0.75
        if (starPositions[i] > 16) starPositions[i] = -60
      }
      stars.attributes.position.needsUpdate = true
      draw()
      frame = requestAnimationFrame(animate)
    }
    const updateMotion = () => {
      cancelAnimationFrame(frame)
      last = 0
      draw()
      if (!reduced.matches && !document.hidden && !lost)
        frame = requestAnimationFrame(animate)
    }
    const contextLost = (event: Event) => {
      event.preventDefault()
      lost = true
      cancelAnimationFrame(frame)
      el.dataset.rendering = 'fallback'
    }
    const contextRestored = () => {
      lost = false
      el.dataset.rendering = 'webgl'
      resize()
      updateMotion()
    }
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      contextRestored,
    )
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()
    reduced.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateMotion)
    updateMotion()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      reduced.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateMotion)
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        contextRestored,
      )
      const geometries = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Points ||
          object instanceof THREE.Sprite
        ) {
          if ('geometry' in object) geometries.add(object.geometry)
          const list = Array.isArray(object.material)
            ? object.material
            : [object.material]
          list.forEach((material) => materials.add(material))
        }
      })
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      textures.forEach((texture) => texture.dispose())
      renderer.dispose()
      renderer.domElement.remove()
      delete el.dataset.rendering
    }
  }, [enabled])
  return (
    <div className="space-scene" ref={host} aria-hidden="true">
      <div className="space-fallback">
        <i />
        <i />
        <i />
      </div>
    </div>
  )
}
