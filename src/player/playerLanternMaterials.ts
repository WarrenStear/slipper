import * as THREE from "three";

export function createPlayerLanternMaterials() {
    const flame = new THREE.MeshBasicMaterial({
      color: "#ffd78a",
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      toneMapped: true,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: "#cbd7d1",
      emissive: "#000000",
      emissiveIntensity: 0,
      roughness: 0.14,
      metalness: 0,
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const metal = new THREE.MeshStandardMaterial({
      color: "#403b2d",
      vertexColors: true,
      emissive: "#160c05",
      emissiveIntensity: 0.025,
      roughness: 0.62,
      metalness: 0.54,
    });
    const glow = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color("#ffd78a") },
        glowOpacity: { value: 0.075 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float glowOpacity;
        varying vec2 vUv;
        void main() {
          float radius = length((vUv - 0.5) * 2.0);
          float falloff = pow(1.0 - smoothstep(0.08, 1.0, radius), 2.35);
          gl_FragColor = vec4(glowColor, falloff * glowOpacity);
        }
      `,
    });

    return { flame, glass, metal, glow };
  }
