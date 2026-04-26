"use client"

import { useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Float } from "@react-three/drei"
import * as THREE from "three"

function Ring({
  radius,
  speed,
  thickness,
  color,
  emissive,
}: {
  radius: number
  speed: number
  thickness: number
  color: string
  emissive: number
}) {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed
    ref.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.4) * 0.15
    ref.current.rotation.z = t * 0.2
  })

  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, thickness, 16, 64]} />
      <meshStandardMaterial
        color={color}
        metalness={0.95}
        roughness={0.08}
        emissive={color}
        emissiveIntensity={emissive}
      />
    </mesh>
  )
}

function SmallOctahedron({
  position,
  speed,
}: {
  position: [number, number, number]
  speed: number
}) {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed
    ref.current.rotation.y = t
    ref.current.rotation.x = Math.sin(t * 0.5) * 0.5
    ref.current.position.y = position[1] + Math.sin(t * 0.8) * 0.06
  })

  return (
    <mesh ref={ref} position={position} scale={0.12}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#5eead4"
        metalness={0.9}
        roughness={0.1}
        emissive="#5eead4"
        emissiveIntensity={0.2}
      />
    </mesh>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[2, 1, 3]} intensity={0.5} color="#2dd4bf" />
      <pointLight position={[-2, -1, 2]} intensity={0.3} color="#0ea5e9" />

      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
        <group>
          <Ring radius={0.6} speed={0.3} thickness={0.035} color="#2dd4bf" emissive={0.12} />
          <Ring radius={0.9} speed={0.2} thickness={0.025} color="#0ea5e9" emissive={0.08} />
          <SmallOctahedron position={[0.75, 0, 0]} speed={0.5} />
          <SmallOctahedron position={[-0.75, 0, 0]} speed={0.6} />
        </group>
      </Float>
    </>
  )
}

export function SceneDivider() {
  return (
    <div className="mx-auto flex h-32 w-full max-w-5xl items-center justify-center">
      <div className="h-full w-48">
        <Canvas
          camera={{ position: [0, 0, 3], fov: 35 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <Scene />
        </Canvas>
      </div>
    </div>
  )
}
