import * as THREE from 'three';

const canvas = document.getElementById('bg-canvas');
if (!canvas) throw new Error('No canvas found');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(pointer: coarse)').matches;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.0 : 1.5));

const uniforms = {
  t:     { value: 0.0 },
  r:     { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  mouse: { value: new THREE.Vector2(0.5, 0.5) },
};

const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec2 r;
    uniform float t;
    uniform vec2 mouse;
    varying vec2 vUv;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m * m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    mat2 rot(float a) {
      float s = sin(a); float c = cos(a);
      return mat2(c, -s, s, c);
    }

    float wave(vec2 p, float phase, float freq) {
      return sin(p.x * freq + phase) * 0.3 * sin(p.y * freq * 0.5 + phase * 0.7);
    }

    float glowLine(float dist, float thickness, float intensity) {
      return intensity * thickness / (abs(dist) + thickness * 0.5);
    }

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float starfield(vec2 uv, float time) {
      vec2 grid = floor(uv * 150.0);
      vec2 fr   = fract(uv * 150.0) - 0.5;
      float star = hash(grid);
      if (star < 0.988) return 0.0;
      float twinkle = sin(time * 2.0 + grid.x + grid.y) * 0.5 + 0.5;
      float dist = length(fr);
      float sparkle = smoothstep(0.06, 0.0, dist) * twinkle;
      return sparkle * (star - 0.988) * 80.0;
    }

    void main() {
      vec2 uv = (vUv - 0.5) * 2.0;
      uv.x *= r.x / r.y;
      vec2 uv0 = uv;

      float time = t * 0.25;
      vec3 col = vec3(0.0);

      // --- base noise layer — very dark, barely visible movement ---
      float noise = (snoise(uv * 0.4 + time * 0.015) + 1.0) * 0.5;
      col += noise * vec3(1.0) * 0.018;

      // --- nebula core — centered, noise displaced radial ---
      float dist = length(uv0);
      float nebulaDisplace = snoise(uv0 * 1.2 + time * 0.08) * 0.18;
      float nebula = exp(-(dist + nebulaDisplace) * 2.2);
      col += nebula * vec3(0.09, 0.09, 0.11);

      // inner bright core
      float core = exp(-(dist + nebulaDisplace * 0.5) * 5.5);
      col += core * vec3(0.12, 0.12, 0.14);

      // --- slow drifting wave lines — dark gray only ---
      uv *= rot(time * 0.04);
      float waveNoise = snoise(uv * 1.8 + time * 0.18) * 0.08;

      float y1 = uv.y - wave(uv, time * 1.2, 1.8) + waveNoise;
      col += vec3(1.0) * glowLine(y1, 0.012, 0.4) * 0.07;

      float y2 = uv.y + 0.35 - wave(uv + vec2(1.0, 0.5), time * 1.0, 2.2) + waveNoise * 0.8;
      col += vec3(1.0) * glowLine(y2, 0.010, 0.35) * 0.055;

      float y3 = uv.y - 0.35 - wave(uv + vec2(-0.5, 1.0), time * 1.4, 1.6) + waveNoise * 1.1;
      col += vec3(1.0) * glowLine(y3, 0.010, 0.35) * 0.055;

      // --- ripple ring from center ---
      float ring = abs(sin(dist * 3.5 - time * 1.5)) * exp(-dist * 1.2);
      col += vec3(1.0) * ring * 0.025;

      // --- starfield ---
      col += starfield(uv0 * 1.8 + time * 0.008, t) * vec3(0.85, 0.88, 1.0) * 0.35;

      // --- subtle mouse parallax glow — gray only ---
      vec2 mouseUv = (mouse - 0.5) * 2.0;
      mouseUv.x *= r.x / r.y;
      float mouseDist = length(uv0 - mouseUv);
      float mouseGlow = 0.04 / (mouseDist + 0.3);
      col += mouseGlow * vec3(1.0) * 0.06;

      // --- vignette ---
      float vignette = 1.0 - length(uv0) * 0.55;
      vignette = clamp(vignette, 0.0, 1.0);
      col *= vignette;

      // --- tone ---
      col = pow(clamp(col, 0.0, 1.0), vec3(0.9));

      gl_FragColor = vec4(col, 1.0);
    }
  `,
});

const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
scene.add(mesh);

// mouse tracking — desktop only
let targetMouse = new THREE.Vector2(0.5, 0.5);
let currentMouse = new THREE.Vector2(0.5, 0.5);

if (!isMobile) {
  window.addEventListener('mousemove', (e) => {
    targetMouse.x = e.clientX / window.innerWidth;
    targetMouse.y = 1.0 - e.clientY / window.innerHeight;
  });
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  uniforms.r.value.set(window.innerWidth, window.innerHeight);
});

// animation loop
if (prefersReducedMotion) {
  // static frame — just render once
  renderer.render(scene, camera);
} else {
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    uniforms.t.value = clock.getElapsedTime();
    if (!isMobile) {
      currentMouse.lerp(targetMouse, 0.04);
      uniforms.mouse.value.copy(currentMouse);
    }
    renderer.render(scene, camera);
  }
  animate();
}