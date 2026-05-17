import * as THREE from 'three';

const canvas = document.getElementById('bg-canvas');
if (!canvas) throw new Error('No canvas found');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(pointer: coarse)').matches;

const W = window.innerWidth;
const H = window.innerHeight;
const DPR = Math.min(window.devicePixelRatio, isMobile ? 1.0 : 1.5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(W, H);
renderer.setPixelRatio(DPR);
renderer.autoClear = false;

// ─── shared mouse state ───────────────────────────────────────────────────────
const mouse = {
  target:  new THREE.Vector2(0.5, 0.5),
  current: new THREE.Vector2(0.5, 0.5),
};

if (!isMobile) {
  window.addEventListener('mousemove', (e) => {
    mouse.target.x = e.clientX / window.innerWidth;
    mouse.target.y = 1.0 - e.clientY / window.innerHeight;
  });
}

// ─── SCENE 1 — background ─────────────────────────────────────────────────────
const bgScene  = new THREE.Scene();
const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
bgCamera.position.z = 1;

const bgUniforms = {
  t:     { value: 0.0 },
  r:     { value: new THREE.Vector2(W, H) },
  mouse: { value: new THREE.Vector2(0.5, 0.5) },
};

const bgMaterial = new THREE.ShaderMaterial({
  uniforms: bgUniforms,
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

    vec3 mod289v3(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec2 mod289v2(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec3 permute3(vec3 x){return mod289v3(((x*34.0)+1.0)*x);}

    float snoise(vec2 v){
      const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
      vec2 i=floor(v+dot(v,C.yy));
      vec2 x0=v-i+dot(i,C.xx);
      vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
      vec4 x12=x0.xyxy+C.xxzz;
      x12.xy-=i1;
      i=mod289v2(i);
      vec3 p=permute3(permute3(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
      vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
      m=m*m*m*m;
      vec3 x=2.0*fract(p*C.www)-1.0;
      vec3 h=abs(x)-0.5;
      vec3 ox=floor(x+0.5);
      vec3 a0=x-ox;
      m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
      vec3 g;
      g.x=a0.x*x0.x+h.x*x0.y;
      g.yz=a0.yz*x12.xz+h.yz*x12.yw;
      return 130.0*dot(m,g);
    }

    mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}

    float wave(vec2 p,float phase,float freq){
      return sin(p.x*freq+phase)*0.4*sin(p.y*freq*0.5+phase*0.7);
    }

    float glowLine(float d,float thickness,float intensity){
      return intensity*thickness/(abs(d)+thickness*0.5);
    }

    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}

    float starfield(vec2 uv,float time){
      vec2 grid=floor(uv*150.0);
      vec2 fr=fract(uv*150.0)-0.5;
      float star=hash(grid);
      if(star<0.988)return 0.0;
      float twinkle=sin(time*2.0+grid.x+grid.y)*0.5+0.5;
      float sparkle=smoothstep(0.06,0.0,length(fr))*twinkle;
      return sparkle*(star-0.988)*80.0;
    }

    void main(){
      vec2 uv=(vUv-0.5)*2.0;
      uv.x*=r.x/r.y;
      vec2 uv0=uv;
      float time=t*0.25;
      vec3 col=vec3(0.0);

      float noise=(snoise(uv*0.4+time*0.015)+1.0)*0.5;
      col+=noise*vec3(1.0)*0.022;

      float dist=length(uv0);
      float nd1=snoise(uv0*0.9+time*0.07)*0.22;
      float nd2=snoise(uv0*1.8+time*0.11)*0.10;
      float nebula=exp(-(dist+nd1)*1.6);
      col+=nebula*vec3(0.10,0.10,0.13);
      float core=exp(-(dist+nd2*0.5)*4.5);
      col+=core*vec3(0.13,0.13,0.16);
      col+=exp(-dist*0.7)*0.04*vec3(1.0);

      vec2 uvr=uv*rot(time*0.04);
      float wn=snoise(uvr*1.6+time*0.16)*0.10;

      col+=vec3(1.0)*glowLine(uvr.y                                        -wave(uvr,             time*1.1,1.6)+wn,      0.014,0.45)*0.09;
      col+=vec3(1.0)*glowLine(uvr.y+0.55-wave(uvr+vec2(1.0, 0.5), time*0.9,2.0)+wn*0.8,0.011,0.38)*0.07;
      col+=vec3(1.0)*glowLine(uvr.y-0.55-wave(uvr+vec2(-0.5,1.0), time*1.3,1.4)+wn*1.1,0.011,0.38)*0.07;
      col+=vec3(1.0)*glowLine(uvr.y+1.1 -wave(uvr+vec2(0.3, 0.8), time*0.7,1.8)+wn*0.6,0.008,0.30)*0.05;
      col+=vec3(1.0)*glowLine(uvr.y-1.1 -wave(uvr+vec2(-0.8,0.3), time*1.5,1.2)+wn*0.9,0.008,0.30)*0.05;

      col+=vec3(1.0)*abs(sin(dist*3.2-time*1.4))*exp(-dist*1.0)*0.03;
      col+=starfield(uv0*1.6+time*0.007,t)*vec3(0.85,0.88,1.0)*0.4;

      vec2 mUv=(mouse-0.5)*2.0;
      mUv.x*=r.x/r.y;
      col+=(0.05/(length(uv0-mUv)+0.35))*vec3(1.0)*0.07;

      col*=clamp(1.0-length(uv0)*0.45,0.0,1.0);
      col=pow(clamp(col,0.0,1.0),vec3(0.9));
      gl_FragColor=vec4(col,1.0);
    }
  `,
});

bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMaterial));

// ─── SCENE 2 — sphere ─────────────────────────────────────────────────────────
const sphereScene  = new THREE.Scene();
const sphereCamera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
sphereCamera.position.z = 4.8;

const NOISE3 = `
  vec3 mod289_3(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289_4(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute4(vec4 x){return mod289_4(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt4(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise3(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289_3(i);
    vec4 p=permute4(permute4(permute4(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt4(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

const sphereUniforms = {
  t:     { value: 0.0 },
  mouse: { value: new THREE.Vector2(0.5, 0.5) },
};

const sphereMaterial = new THREE.ShaderMaterial({
  uniforms: sphereUniforms,
  transparent: true,
  vertexShader: `
    uniform float t;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying float vDisplace;
    varying vec3 vPos;
    ${NOISE3}
    void main(){
      vNormal = normalize(normalMatrix * normal);
      vPos = position;
      float d  = snoise3(position*0.8  + t*0.13)*0.22;
            d += snoise3(position*1.8  + t*0.10)*0.09;
            d += snoise3(position*3.5  + t*0.07)*0.04;
            d += snoise3(position*7.0  + t*0.05)*0.015;
      vDisplace = d;
      vec3 displaced = position + normal * d;
      vWorldPos = (modelMatrix * vec4(displaced, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  fragmentShader: `
    uniform float t;
    uniform vec2 mouse;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying float vDisplace;
    varying vec3 vPos;
    ${NOISE3}

    void main(){
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      vec3 n       = normalize(vNormal);
      float fresnel = pow(clamp(1.0 - dot(n, viewDir), 0.0, 1.0), 2.5);
      float ifresnel = 1.0 - fresnel;

      // noise layers for surface texture
      float n1 = snoise3(vPos * 1.2 + t * 0.08) * 0.5 + 0.5;
      float n2 = snoise3(vPos * 2.8 + t * 0.05) * 0.5 + 0.5;
      float n3 = snoise3(vPos * 6.0 + t * 0.03) * 0.5 + 0.5;

      // two-tone split like shadertoy: purple inner / green outer
      vec3 innerCol = vec3(0.18, 0.06, 0.22); // deep purple
      vec3 outerCol = vec3(0.04, 0.16, 0.08); // dark green
      vec3 base = mix(innerCol, outerCol, n1 * 0.6 + fresnel * 0.4);

      // surface detail — veiny/fleshy variation
      float vein = n2 * n3;
      base += vein * vec3(0.08, 0.04, 0.10) * ifresnel;

      // metallic sheen — light from top right
      vec3 lightDir = normalize(vec3(0.6, 0.9, 1.0));
      float diff = max(dot(n, lightDir), 0.0);
      float spec = pow(max(dot(reflect(-lightDir, n), viewDir), 0.0), 48.0);

      base += diff * vec3(0.06, 0.05, 0.08) * 0.6;
      base += spec * vec3(0.35, 0.30, 0.40); // purplish specular highlight

      // second light — cooler, from left
      vec3 lightDir2 = normalize(vec3(-0.8, 0.2, 0.6));
      float spec2 = pow(max(dot(reflect(-lightDir2, n), viewDir), 0.0), 24.0);
      base += spec2 * vec3(0.10, 0.20, 0.12) * 0.5; // greenish secondary spec

      // rim glow
      base += fresnel * vec3(0.22, 0.10, 0.30) * 0.9; // purple rim

      // displacement-based color — brighter where surface bulges
      base += clamp(vDisplace, 0.0, 1.0) * vec3(0.12, 0.05, 0.15);

      // mouse-driven light shift
      vec3 mouseLight = normalize(vec3((mouse.x - 0.5) * 3.0, (mouse.y - 0.5) * 3.0, 1.5));
      float mSpec = pow(max(dot(reflect(-mouseLight, n), viewDir), 0.0), 36.0);
      base += mSpec * vec3(0.20, 0.15, 0.25) * 0.6;

      float alpha = mix(0.97, 0.0, pow(fresnel, 3.5));
      gl_FragColor = vec4(base, alpha);
    }
  `,
});

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.6, 128, 128),
  sphereMaterial
);
sphereScene.add(sphere);

let rotX = 0;
let rotY = 0;
let targetRotX = 0;
let targetRotY = 0;

// ─── resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  bgUniforms.r.value.set(w, h);
  sphereCamera.aspect = w / h;
  sphereCamera.updateProjectionMatrix();
});

// ─── render loop ──────────────────────────────────────────────────────────────
if (prefersReducedMotion) {
  renderer.clear();
  renderer.render(bgScene, bgCamera);
  renderer.clearDepth();
  renderer.render(sphereScene, sphereCamera);
} else {
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // lerp shared mouse
    if (!isMobile) {
      mouse.current.lerp(mouse.target, 0.04);
    }

    // background
    bgUniforms.t.value = elapsed;
    bgUniforms.mouse.value.copy(mouse.current);

    // sphere base rotation
    sphere.rotation.y = elapsed * 0.10;

    // mouse tilt — additive on top of base rotation
    if (!isMobile) {
      targetRotX =  (mouse.current.y - 0.5) * 0.55;
      targetRotY = -(mouse.current.x - 0.5) * 0.55;
      rotX += (targetRotX - rotX) * 0.05;
      rotY += (targetRotY - rotY) * 0.05;
      sphere.rotation.x = rotX;
      sphere.rotation.y += rotY;
    }

    // mouse-driven specular in fragment shader
    sphereUniforms.t.value = elapsed;
    sphereUniforms.mouse.value.copy(mouse.current);

    // render
    renderer.clear();
    renderer.render(bgScene, bgCamera);
    renderer.clearDepth();
    renderer.render(sphereScene, sphereCamera);
  }

  animate();
}