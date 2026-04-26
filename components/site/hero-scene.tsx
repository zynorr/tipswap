"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Float, MeshTransmissionMaterial } from "@react-three/drei"
import * as THREE from "three"

function Crystal({
  position,
  scale,
  speed,
  color,
}: {
  position: [number, number, number]
  scale: number
  speed: number
  color: string
}) {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed
    ref.current.rotation.x = Math.sin(t) * 0.4
    ref.current.rotation.y = t * 0.3
    ref.current.position.y = position[1] + Math.sin(t * 0.7) * 0.15
  })

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.4}>
      <mesh ref={ref} position={position} scale={scale}>
        <octahedronGeometry args={[1, 0]} />
        <MeshTransmissionMaterial
          backside
          thickness={0.4}
          roughness={0.05}
          transmission={0.95}
          ior={1.5}
          chromaticAberration={0.06}
          color={color}
        />
      </mesh>
    </Float>
  )
}

function Torus({
  position,
  scale,
  speed,
}: {
  position: [number, number, number]
  scale: number
  speed: number
}) {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed
    ref.current.rotation.x = t * 0.2
    ref.current.rotation.z = Math.cos(t * 0.5) * 0.3
    ref.current.position.y = position[1] + Math.sin(t * 0.6) * 0.12
  })

  return (
    <Float speed={1} rotationIntensity={0.2} floatIntensity={0.3}>
      <mesh ref={ref} position={position} scale={scale}>
        <torusGeometry args={[1, 0.35, 16, 32]} />
        <meshStandardMaterial
          color="#2dd4bf"
          metalness={0.9}
          roughness={0.15}
          emissive="#2dd4bf"
          emissiveIntensity={0.08}
        />
      </mesh>
    </Float>
  )
}

function Sphere({
  position,
  scale,
  speed,
}: {
  position: [number, number, number]
  scale: number
  speed: number
}) {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed
    ref.current.position.y = position[1] + Math.sin(t) * 0.1
    ref.current.position.x = position[0] + Math.cos(t * 0.4) * 0.05
  })

  return (
    <mesh ref={ref} position={position} scale={scale}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        color="#0ea5e9"
        metalness={0.95}
        roughness={0.1}
        emissive="#0ea5e9"
        emissiveIntensity={0.05}
      />
    </mesh>
  )
}

function Particles() {
  const count = 80
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 12
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6
    }
    return arr
  }, [])

  const ref = useRef<THREE.Points>(null!)

  useFrame((state) => {
    ref.current.rotation.y = state.clock.elapsedTime * 0.015
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.05
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        color="#5eead4"
        transparent
        opacity={0.5}
        sizeAttenuation
      />
    </points>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} color="#e0f7ff" />
      <pointLight position={[-3, 2, 2]} intensity={0.4} color="#2dd4bf" />
      <pointLight position={[4, -1, -2]} intensity={0.3} color="#0ea5e9" />

      {/* Main crystal cluster - right side */}
      <Crystal position={[2.8, 0.3, 0]} scale={0.6} speed={0.4} color="#2dd4bf" />
      <Crystal position={[3.8, -0.8, -1]} scale={0.35} speed={0.5} color="#0ea5e9" />
      <Crystal position={[2, 1.2, -0.5]} scale={0.25} speed={0.6} color="#5eead4" />

      {/* Torus ring - left side accent */}
      <Torus position={[-3.2, 0.5, -1]} scale={0.35} speed={0.3} />

      {/* Small sphere accents */}
      <Sphere position={[-2, -1, 0.5]} scale={0.15} speed={0.5} />
      <Sphere position={[1, 1.8, -1.5]} scale={0.1} speed={0.7} />
      <Sphere position={[4.5, 1, -0.5]} scale={0.12} speed={0.45} />

      <Particles />
    </>
  )
}

export function HeroScene() {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
