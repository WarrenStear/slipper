import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { TactileMaterial, useTactileDetail } from "../storyEvents/TactileMaterial";
import { createPhantomGeometries, createSwanGeometries, createWolfGeometries } from "./npcGeometry.ts";

export type AuthoredNpcKind = "wolf" | "swan" | "phantom";
export const AuthoredNpcSilhouette = memo(function AuthoredNpcSilhouette({ kind, resting = false, opacity = 1 }: { kind: AuthoredNpcKind; resting?: boolean; opacity?: number }) {
  const detail = useTactileDetail();
  const geometry = useMemo(() => kind === "wolf" ? createWolfGeometries(resting, detail) : kind === "swan" ? createSwanGeometries(detail) : createPhantomGeometries(detail), [kind, resting, detail]);
  useEffect(() => () => { geometry.body.dispose(); geometry.accent.dispose(); geometry.dark.dispose(); }, [geometry]);
  const alpha = Math.min(1, Math.max(0, Number.isFinite(opacity) ? opacity : 1));
  const appearance = { transparent: alpha < 1, opacity: alpha, depthWrite: alpha >= 1 };
  return <group name={`authored-${kind}-silhouette`} userData={{ forwardAxis: "+Z", appearanceOnly: true }}>
    <mesh geometry={geometry.body} receiveShadow><TactileMaterial surface={kind === "swan" ? "paper" : kind === "phantom" ? "linen" : "velvet"} vertexColors={kind !== "phantom"} color={kind === "swan" ? "#e5e1d5" : kind === "phantom" ? "#b4bfbe" : "#60635a"} roughness={kind === "swan" ? .78 : .96} side={THREE.DoubleSide} {...appearance} /></mesh>
    <mesh geometry={geometry.accent}><TactileMaterial surface={kind === "phantom" ? "velvet" : "paper"} vertexColors={kind !== "phantom"} color={kind === "swan" ? "#a47c5c" : kind === "phantom" ? "#303b3c" : "#727669"} roughness={.9} {...appearance} /></mesh>
    {kind !== "phantom" ? <mesh geometry={geometry.dark}><meshStandardMaterial color="#222925" roughness={.65} {...appearance} /></mesh> : null}
  </group>;
});
