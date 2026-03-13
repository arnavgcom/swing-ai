// @ts-nocheck
import React, { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";

function loadFiberNative() {
  try {
    const mod = require("@react-three/fiber/native");
    return mod?.Canvas ? mod : null;
  } catch {
    return null;
  }
}

export function isCorrective3DSupported(): boolean {
  return !!loadFiberNative();
}

type GroupRef = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
};

interface FigureProps {
  color: string;
  ghost?: boolean;
  targetX?: number;
}

interface CorrectiveMotionScene3DProps {
  accentColor: string;
}

function Figure({ color, ghost = false, targetX = 0 }: FigureProps) {
  const groupRef = useRef<GroupRef | null>(null);

  const FiberNative = loadFiberNative();
  const useFrame: ((fn: (state: { clock: { elapsedTime: number } }) => void) => void) | undefined = FiberNative?.useFrame;

  if (useFrame) {
    useFrame(({ clock }: { clock: { elapsedTime: number } }) => {
      if (!groupRef.current) return;

      if (ghost) {
        groupRef.current.position.x = targetX;
        groupRef.current.rotation.y = 0.42;
        groupRef.current.rotation.x = -0.04;
        return;
      }

      const t = (Math.sin(clock.elapsedTime * 1.5) + 1) / 2;
      groupRef.current.position.x = -0.55 + t * 1.05;
      groupRef.current.rotation.y = -0.48 + t * 0.95;
      groupRef.current.rotation.x = 0.06 * Math.sin(clock.elapsedTime * 1.5);
    });
  }

  const opacity = ghost ? 0.38 : 0.95;

  return (
    // @ts-ignore - react-three reconciler supplies group/mesh primitives
    <group ref={groupRef} position={[ghost ? targetX : -0.55, -0.2, 0]}>
      {/* Head */}
      <mesh position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 0.44, 0]}>
        <capsuleGeometry args={[0.12, 0.42, 8, 12]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.2, 0.45, 0.02]} rotation={[0.1, 0, 0.75]}>
        <capsuleGeometry args={[0.05, 0.26, 8, 10]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0.2, 0.45, 0.02]} rotation={[0.2, 0, -0.92]}>
        <capsuleGeometry args={[0.05, 0.3, 8, 10]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.1, 0.02, 0]} rotation={[0.18, 0, 0.2]}>
        <capsuleGeometry args={[0.06, 0.36, 8, 10]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0.1, 0.02, 0]} rotation={[-0.05, 0, -0.15]}>
        <capsuleGeometry args={[0.06, 0.38, 8, 10]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

export function CorrectiveMotionScene3D({ accentColor }: CorrectiveMotionScene3DProps) {
  const FiberNative = loadFiberNative();
  const Canvas = FiberNative?.Canvas as React.ComponentType<any> | undefined;

  if (!Canvas) {
    return <View style={styles.unavailable} />;
  }

  const scene = useMemo(
    () => (
      <Canvas camera={{ position: [0, 1.15, 3.6], fov: 44 }} style={styles.canvas}>
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.82} />
        <directionalLight position={[2.2, 3.5, 1.8]} intensity={1.05} color="#E2E8F0" />
        <pointLight position={[-2, 1.2, 1.6]} intensity={0.45} color={accentColor} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.78, 0]}>
          <planeGeometry args={[8, 8]} />
          <meshStandardMaterial color="#0F172A" />
        </mesh>

        <gridHelper args={[8, 14, "#334155", "#1E293B"]} position={[0, -0.77, 0]} />

        <Figure color={accentColor} ghost targetX={0.5} />
        <Figure color="#F8FAFC" />
      </Canvas>
    ),
    [accentColor],
  );

  return <View style={styles.container}>{scene}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  unavailable: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(2, 6, 23, 0.86)",
  },
  canvas: {
    flex: 1,
  },
});
