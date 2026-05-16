"use client"

import { useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

const AURA = new THREE.Color("#10353a")
const TEAL = new THREE.Color("#2dd4bf")
const CYAN = new THREE.Color("#67e8f9")
const WHITE = new THREE.Color("#e8fffd")

function ScrollRig() {
  const { camera } = useThree()
  const targetY = useRef(0)

  useFrame(({ clock }) => {
    if (typeof window !== "undefined") {
      const scrollMax = document.documentElement.scrollHeight - window.innerHeight
      const progress = scrollMax > 0 ? window.scrollY / scrollMax : 0
      targetY.current = 1.6 - progress * 3.2
    }

    const t = clock.getElapsedTime()
    camera.position.x += ((Math.sin(t * 0.2) * 0.35) - camera.position.x) * 0.03
    camera.position.y += (targetY.current - camera.position.y) * 0.04
    camera.position.z += (10.5 - camera.position.z) * 0.04
    camera.lookAt(0, 0, 0)
  })

  return null
}

function FloatingCore() {
  const group = useRef<THREE.Group>(null!)
  const shell = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    group.current.rotation.y = t * 0.12
    group.current.rotation.x = Math.sin(t * 0.22) * 0.04
    group.current.position.y = Math.sin(t * 0.38) * 0.1

    const scale = 1 + Math.sin(t * 0.9) * 0.02
    shell.current.scale.setScalar(scale)
  })

  return (
    <group ref={group} position={[3.2, 0.15, 0]}>
      <mesh ref={shell}>
        <icosahedronGeometry args={[1.45, 1]} />
        <meshStandardMaterial
          color={new THREE.Color("#0f2025")}
          emissive={TEAL}
          emissiveIntensity={0.12}
          metalness={0.5}
          roughness={0.32}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh scale={0.42}>
        <icosahedronGeometry args={[1.45, 0]} />
        <meshBasicMaterial color={WHITE} transparent opacity={0.82} />
      </mesh>
    </group>
  )
}

function OrbitRing({
  radius,
  speed,
  tiltX,
  tiltY,
  color,
  opacity,
}: {
  radius: number
  speed: number
  tiltX: number
  tiltY: number
  color: string
  opacity: number
}) {
  const group = useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    group.current.rotation.z = clock.getElapsedTime() * speed
  })

  return (
    <group ref={group} position={[3.2, 0.15, 0]} rotation={[tiltX, tiltY, 0]}>
      <mesh>
        <torusGeometry args={[radius, 0.028, 16, 180]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
    </group>
  )
}

function SparkField() {
  const points = useRef<THREE.Points>(null!)
  const data = useMemo(() => {
    const count = 36
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8
    }

    return { positions, count }
  }, [])

  useFrame(({ clock }) => {
    points.current.rotation.y = clock.getElapsedTime() * 0.008
  })

  return (
    <points ref={points} position={[0, 0, -1.5]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={new THREE.Color("#78f7ee")}
        size={0.04}
        sizeAttenuation
        transparent
        opacity={0.22}
        depthWrite={false}
      />
    </points>
  )
}

function GlowPlanes() {
  return (
    <>
      <mesh position={[3.6, 0.1, -2.5]} rotation={[0, 0, 0.2]}>
        <planeGeometry args={[7.2, 7.2]} />
        <meshBasicMaterial color={AURA} transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </>
  )
}

function Scene() {
  return (
    <>
      <fog attach="fog" args={["#061015", 8, 18]} />
      <ambientLight intensity={0.42} />
      <pointLight position={[5, 4, 6]} intensity={7} color="#7cf8ef" distance={16} />
      <ScrollRig />
      <GlowPlanes />
      <SparkField />
      <FloatingCore />
      <OrbitRing radius={2.1} speed={0.15} tiltX={1.12} tiltY={0.22} color="#67e8f9" opacity={0.26} />
      <OrbitRing radius={2.85} speed={-0.1} tiltX={0.72} tiltY={-0.42} color="#2dd4bf" opacity={0.14} />
    </>
  )
}

export function NetworkBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 opacity-75">
      <Canvas
        camera={{ position: [0, 0.4, 10.5], fov: 48 }}
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
