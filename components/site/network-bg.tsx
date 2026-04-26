"use client"

import { useRef, useMemo, useCallback } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

const NODE_COUNT = 60
const CONNECTION_DISTANCE = 2.8
const SPREAD_X = 14
const SPREAD_Y = 22
const SPREAD_Z = 8
const PRIMARY = new THREE.Color("#2dd4bf")
const SECONDARY = new THREE.Color("#0ea5e9")
const DIM = new THREE.Color("#1a3a4a")

/* ── one node ── */
function useNodePositions(count: number) {
  return useMemo(() => {
    const pos: [number, number, number][] = []
    const vel: [number, number, number][] = []
    for (let i = 0; i < count; i++) {
      pos.push([
        (Math.random() - 0.5) * SPREAD_X,
        (Math.random() - 0.5) * SPREAD_Y,
        (Math.random() - 0.5) * SPREAD_Z - 2,
      ])
      vel.push([
        (Math.random() - 0.5) * 0.003,
        (Math.random() - 0.5) * 0.003,
        (Math.random() - 0.5) * 0.001,
      ])
    }
    return { pos, vel }
  }, [count])
}

/* ── all nodes as instanced mesh ── */
function Nodes({
  positions,
}: {
  positions: React.MutableRefObject<[number, number, number][]>
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colorArray = useMemo(() => {
    const arr = new Float32Array(NODE_COUNT * 3)
    for (let i = 0; i < NODE_COUNT; i++) {
      const c = i % 3 === 0 ? PRIMARY : i % 3 === 1 ? SECONDARY : DIM
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    return arr
  }, [])

  useFrame(() => {
    if (!meshRef.current) return
    const p = positions.current
    for (let i = 0; i < NODE_COUNT; i++) {
      dummy.position.set(p[i][0], p[i][1], p[i][2])
      const baseFactor = i % 3 === 0 ? 1 : i % 5 === 0 ? 0.7 : 0.45
      const s = 0.035 * baseFactor + 0.015
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, NODE_COUNT]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial toneMapped={false}>
        <instancedBufferAttribute
          attach="color"
          args={[colorArray, 3]}
        />
      </meshBasicMaterial>
    </instancedMesh>
  )
}

/* ── lines between close nodes ── */
function Lines({
  positions,
}: {
  positions: React.MutableRefObject<[number, number, number][]>
}) {
  const lineRef = useRef<THREE.LineSegments>(null!)
  const maxLines = NODE_COUNT * NODE_COUNT
  const posAttr = useMemo(
    () => new Float32Array(maxLines * 6),
    [maxLines]
  )
  const colAttr = useMemo(
    () => new Float32Array(maxLines * 6),
    [maxLines]
  )
  const geoRef = useRef<THREE.BufferGeometry>(null!)

  useFrame(() => {
    if (!lineRef.current || !geoRef.current) return
    const p = positions.current
    let idx = 0

    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dx = p[i][0] - p[j][0]
        const dy = p[i][1] - p[j][1]
        const dz = p[i][2] - p[j][2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (dist < CONNECTION_DISTANCE) {
          const alpha = 1 - dist / CONNECTION_DISTANCE
          const o = idx * 6

          posAttr[o] = p[i][0]
          posAttr[o + 1] = p[i][1]
          posAttr[o + 2] = p[i][2]
          posAttr[o + 3] = p[j][0]
          posAttr[o + 4] = p[j][1]
          posAttr[o + 5] = p[j][2]

          const c = alpha > 0.6 ? PRIMARY : DIM
          const a = alpha * 0.35

          colAttr[o] = c.r * a
          colAttr[o + 1] = c.g * a
          colAttr[o + 2] = c.b * a
          colAttr[o + 3] = c.r * a
          colAttr[o + 4] = c.g * a
          colAttr[o + 5] = c.b * a

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
          count={maxLines * 2}
          array={posAttr}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={maxLines * 2}
          array={colAttr}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={1} toneMapped={false} />
    </lineSegments>
  )
}

/* ── mouse interaction ── */
function useMouseAttract(
  positions: React.MutableRefObject<[number, number, number][]>
) {
  const mouse = useRef(new THREE.Vector2(9999, 9999))
  const { viewport } = useThree()

  const onPointerMove = useCallback(
    (e: { point: THREE.Vector3 }) => {
      mouse.current.set(e.point.x, e.point.y)
    },
    []
  )

  useFrame(() => {
    const mx = mouse.current.x
    const my = mouse.current.y
    const p = positions.current
    for (let i = 0; i < NODE_COUNT; i++) {
      const dx = mx - p[i][0]
      const dy = my - p[i][1]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 3 && dist > 0.01) {
        const force = 0.002 / dist
        p[i][0] += dx * force
        p[i][1] += dy * force
      }
    }
  })

  return { onPointerMove, viewport }
}

/* ── scene ── */
function Scene() {
  const { pos, vel } = useNodePositions(NODE_COUNT)
  const positionsRef = useRef(pos)
  positionsRef.current = pos
  const velRef = useRef(vel)

  // drift nodes slowly
  useFrame(() => {
    const p = positionsRef.current
    const v = velRef.current
    for (let i = 0; i < NODE_COUNT; i++) {
      p[i][0] += v[i][0]
      p[i][1] += v[i][1]
      p[i][2] += v[i][2]

      // wrap around edges
      if (p[i][0] > SPREAD_X / 2) p[i][0] = -SPREAD_X / 2
      if (p[i][0] < -SPREAD_X / 2) p[i][0] = SPREAD_X / 2
      if (p[i][1] > SPREAD_Y / 2) p[i][1] = -SPREAD_Y / 2
      if (p[i][1] < -SPREAD_Y / 2) p[i][1] = SPREAD_Y / 2
      if (p[i][2] > SPREAD_Z / 2 - 2) p[i][2] = -SPREAD_Z / 2 - 2
      if (p[i][2] < -SPREAD_Z / 2 - 2) p[i][2] = SPREAD_Z / 2 - 2
    }
  })

  const { onPointerMove } = useMouseAttract(positionsRef)

  return (
    <>
      {/* invisible plane for mouse raycasting */}
      <mesh position={[0, 0, -2]} onPointerMove={onPointerMove}>
        <planeGeometry args={[50, 50]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <Nodes positions={positionsRef} />
      <Lines positions={positionsRef} />
    </>
  )
}

export function NetworkBackground() {
  return (
    <div className="pointer-events-auto fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 55 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        resize={{ scroll: false }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
