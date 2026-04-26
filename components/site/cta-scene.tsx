"use client"

import { useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Float, MeshTransmissionMaterial } from "@react-three/drei"
import * as THREE from "three"

function TONCoin() {
  const groupRef = useRef<THREE.Group>(null!)
  const innerRef = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    groupRef.current.rotation.y = t * 0.25
    groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.1
    innerRef.current.rotation.z = t * 0.4
  })

  return (
    <Float speed={2} rotationIntensity={0.15} floatIntensity={0.5}>
      <group ref={groupRef}>
        {/* Outer ring */}
        <mesh>
          <torusGeometry args={[1.2, 0.08, 16, 64]} />
          <meshStandardMaterial
            color="#2dd4bf"
            metalness={0.95}
            roughness={0.05}
            emissive="#2dd4bf"
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Inner diamond */}
        <mesh ref={innerRef} scale={0.65}>
          <octahedronGeometry args={[1, 0]} />
          <MeshTransmissionMaterial
            backside
            thickness={0.5}
            roughness={0.02}
            transmission={0.97}
            ior={1.6}
            chromaticAberration={0.08}
            color="#5eead4"
          />
        </mesh>

        {/* Orbiting small spheres */}
        <OrbitingSphere radius={1.8} speed={0.6} size={0.06} color="#0ea5e9" offset={0} />
        <OrbitingSphere radius={1.8} speed={0.6} size={0.04} color="#2dd4bf" offset={Math.PI} />
        <OrbitingSphere radius={1.6} speed={0.8} size={0.05} color="#5eead4" offset={Math.PI / 2} />
      </group>
    </Float>
  )
}

function OrbitingSphere({
  radius,
  speed,
  size,
  color,
  offset,
}: {
  radius: number
  speed: number
  size: number
  color: string
  offset: number
}) {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + offset
    ref.current.position.x = Math.cos(t) * radius
    ref.current.position.z = Math.sin(t) * radius
    ref.current.position.y = Math.sin(t * 2) * 0.15
  })

  return (
    <mesh ref={ref} scale={size}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial
        color={color}
        metalness={0.9}
        roughness={0.1}
        emissive={color}
        emissiveIntensity={0.3}
      />
    </mesh>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 4, 5]} intensity={0.5} color="#e0f7ff" />
      <pointLight position={[-2, 1, 3]} intensity={0.4} color="#2dd4bf" />
      <pointLight position={[2, -1, -2]} intensity={0.3} color="#0ea5e9" />
      <TONCoin />
    </>
  )
}

export function CTAScene() {
  return (
    <div className="h-[280px] w-[280px] sm:h-[320px] sm:w-[320px]">
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
