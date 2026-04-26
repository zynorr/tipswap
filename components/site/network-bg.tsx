"use client"

import { useRef, useMemo, useCallback } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

/* ─── tuning ─── */
const NODE_COUNT = 100
const CONNECTION_DISTANCE = 3.5
const SPREAD_X = 20
const SPREAD_Y = 30
const SPREAD_Z = 6
const NODE_SIZE_MIN = 0.04
const NODE_SIZE_MAX = 0.12
const LINE_OPACITY_MAX = 0.6
const MOUSE_RADIUS = 5
const MOUSE_FORCE = 0.006
const DRIFT_SPEED = 0.004
const PULSE_SPEED = 0.8

const TEAL = new THREE.Color("#2dd4bf")
const CYAN = new THREE.Color("#22d3ee")
const DIM_TEAL = new THREE.Color("#0d4f4f")

/* ─── generate initial positions + velocities ─── */
function useNetwork(count: number) {
  return useMemo(() => {
    const positions: [number, number, number][] = []
    const velocities: [number, number, number][] = []
    const sizes: number[] = []

    for (let i = 0; i < count; i++) {
      positions.push([
        (Math.random() - 0.5) * SPREAD_X,
        (Math.random() - 0.5) * SPREAD_Y,
        (Math.random() - 0.5) * SPREAD_Z,
      ])
      velocities.push([
        (Math.random() - 0.5) * DRIFT_SPEED,
        (Math.random() - 0.5) * DRIFT_SPEED,
        (Math.random() - 0.5) * DRIFT_SPEED * 0.3,
      ])
      sizes.push(NODE_SIZE_MIN + Math.random() * (NODE_SIZE_MAX - NODE_SIZE_MIN))
    }
    return { positions, velocities, sizes }
  }, [count])
}

/* ─── instanced nodes ─── */
function Nodes({
  posRef,
  sizes,
}: {
  posRef: React.MutableRefObject<[number, number, number][]>
  sizes: number[]
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const colors = useMemo(() => {
    const arr = new Float32Array(NODE_COUNT * 3)
    for (let i = 0; i < NODE_COUNT; i++) {
      const c = i % 4 === 0 ? TEAL : i % 4 === 1 ? CYAN : DIM_TEAL
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    return arr
  }, [])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    const p = posRef.current

    for (let i = 0; i < NODE_COUNT; i++) {
      dummy.position.set(p[i][0], p[i][1], p[i][2])
      const pulse = 1 + Math.sin(t * PULSE_SPEED + i * 0.5) * 0.3
      dummy.scale.setScalar(sizes[i] * pulse)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, NODE_COUNT]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial vertexColors toneMapped={false} />
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
    </instancedMesh>
  )
}

/* ─── line connections ─── */
function Connections({
  posRef,
}: {
  posRef: React.MutableRefObject<[number, number, number][]>
}) {
  const lineRef = useRef<THREE.LineSegments>(null!)
  const geoRef = useRef<THREE.BufferGeometry>(null!)

  const maxSegments = (NODE_COUNT * (NODE_COUNT - 1)) / 2
  const posArr = useMemo(() => new Float32Array(maxSegments * 6), [maxSegments])
  const colArr = useMemo(() => new Float32Array(maxSegments * 6), [maxSegments])

  useFrame(({ clock }) => {
    if (!geoRef.current) return
    const p = posRef.current
    const t = clock.getElapsedTime()
    let idx = 0

    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dx = p[i][0] - p[j][0]
        const dy = p[i][1] - p[j][1]
        const dz = p[i][2] - p[j][2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (dist < CONNECTION_DISTANCE) {
          const alpha = (1 - dist / CONNECTION_DISTANCE) * LINE_OPACITY_MAX
          const o = idx * 6

          posArr[o] = p[i][0]
          posArr[o + 1] = p[i][1]
          posArr[o + 2] = p[i][2]
          posArr[o + 3] = p[j][0]
          posArr[o + 4] = p[j][1]
          posArr[o + 5] = p[j][2]

          // pulse brightness on some lines
          const flicker = alpha > 0.3
            ? 1 + Math.sin(t * 2 + i + j) * 0.15
            : 1
          const c = alpha > 0.35 ? TEAL : alpha > 0.2 ? CYAN : DIM_TEAL
          const a = alpha * flicker

          colArr[o] = c.r * a
          colArr[o + 1] = c.g * a
          colArr[o + 2] = c.b * a
          colArr[o + 3] = c.r * a
          colArr[o + 4] = c.g * a
          colArr[o + 5] = c.b * a

          idx++
        }
      }
    }

    geoRef.current.setDrawRange(0, idx * 2)
    geoRef.current.attributes.position.needsUpdate = true
    geoRef.current.attributes.color.needsUpdate = true
  })

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute
          attach="attributes-position"
          count={maxSegments * 2}
          array={posArr}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={maxSegments * 2}
          array={colArr}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial vertexColors toneMapped={false} />
    </lineSegments>
  )
}

/* ─── main scene with drift + mouse ─── */
function NetworkScene() {
  const { positions, velocities, sizes } = useNetwork(NODE_COUNT)
  const posRef = useRef(positions)
  const velRef = useRef(velocities)
  const mouse = useRef(new THREE.Vector2(9999, 9999))

  const onPointerMove = useCallback((e: { point: THREE.Vector3 }) => {
    mouse.current.set(e.point.x, e.point.y)
  }, [])

  /* drift + wrap + mouse attract */
  useFrame(() => {
    const p = posRef.current
    const v = velRef.current
    const mx = mouse.current.x
    const my = mouse.current.y

    for (let i = 0; i < NODE_COUNT; i++) {
      p[i][0] += v[i][0]
      p[i][1] += v[i][1]
      p[i][2] += v[i][2]

      // wrap edges
      const hx = SPREAD_X / 2
      const hy = SPREAD_Y / 2
      const hz = SPREAD_Z / 2
      if (p[i][0] > hx) p[i][0] = -hx
      if (p[i][0] < -hx) p[i][0] = hx
      if (p[i][1] > hy) p[i][1] = -hy
      if (p[i][1] < -hy) p[i][1] = hy
      if (p[i][2] > hz) p[i][2] = -hz
      if (p[i][2] < -hz) p[i][2] = hz

      // mouse attraction
      const dx = mx - p[i][0]
      const dy = my - p[i][1]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < MOUSE_RADIUS && dist > 0.01) {
        const force = MOUSE_FORCE / dist
        p[i][0] += dx * force
        p[i][1] += dy * force
      }
    }
  })

  return (
    <>
      {/* invisible plane to capture mouse position */}
      <mesh position={[0, 0, 0]} onPointerMove={onPointerMove}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <Nodes posRef={posRef} sizes={sizes} />
      <Connections posRef={posRef} />
    </>
  )
}

export function NetworkBackground() {
  return (
    <div className="pointer-events-auto fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 12], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        resize={{ scroll: false }}
      >
        <NetworkScene />
      </Canvas>
    </div>
  )
}
