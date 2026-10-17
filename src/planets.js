import * as THREE from 'three';
import { NOISE_GLSL } from './noise.js';

export const T = { ROCKY: 0, OCEAN: 1, GAS: 2, ICE: 3, LAVA: 4, CRYSTAL: 5, STAR: 6 };
export const TYPE_LABELS = ['암석 행성', '바다 행성', '가스 거인', '얼음 행성', '용암 행성', '수정 행성', '항성'];

// colors: [주색, 보조색, 강조색] / sky: [천정, 지평선] — 비행 모드 하늘에 사용
export const PLANETS = [
  { id: 'aquaris', name: '아쿠아리스', en: 'AQUARIS', type: T.OCEAN, radius: 46,
    colors: ['#0d4aa8', '#3d8a3f', '#d8c48a'], atmo: '#6cb8ff', sky: ['#1b4fae', '#a9dcff'], moons: 1,
    desc: '푸른 바다가 표면의 80%를 덮은 물의 세계. 구름 사이로 열대 군도가 내려다보인다.',
    stats: { 중력: '1.1 G', 기온: '21°C', 하루: '26시간' } },
  { id: 'sahara', name: '사하라-9', en: 'SAHARA-9', type: T.ROCKY, radius: 34,
    colors: ['#8a5a2b', '#d9a066', '#f2d3a0'], atmo: '#ffc68a', sky: ['#7a4a2a', '#f3c48e'],
    desc: '끝없는 모래 언덕과 협곡의 사막 행성. 쌍둥이 태양이 지는 노을이 유명하다.',
    stats: { 중력: '0.8 G', 기온: '54°C', 하루: '31시간' } },
  { id: 'volcanus', name: '볼카누스', en: 'VOLCANUS', type: T.LAVA, radius: 30,
    colors: ['#1a0f0c', '#ff5a1f', '#ffd04a'], atmo: '#ff6a2a', sky: ['#1a0806', '#8a3412'],
    desc: '지각 틈새로 마그마가 흐르는 불의 행성. 밤에도 붉게 빛난다.',
    stats: { 중력: '1.4 G', 기온: '870°C', 하루: '9시간' } },
  { id: 'jovara', name: '요바라', en: 'JOVARA', type: T.GAS, radius: 110, rings: true, moons: 2,
    colors: ['#c98a52', '#f1dcb8', '#9c4a2a'], atmo: '#ffcf9a', sky: ['#6a3a1e', '#e8b98a'],
    desc: '거대한 폭풍의 눈을 가진 줄무늬 가스 거인. 고리 위로 위성 두 개가 돈다.',
    stats: { 중력: '2.5 G', 기온: '-110°C', 하루: '10시간' } },
  { id: 'glacia', name: '글라시아', en: 'GLACIA', type: T.ICE, radius: 38,
    colors: ['#9cc9ff', '#2a5f9e', '#ffffff'], atmo: '#bfe6ff', sky: ['#294c86', '#d8efff'],
    desc: '두꺼운 얼음 지각 아래 바다를 숨긴 행성. 균열 사이로 푸른빛이 새어 나온다.',
    stats: { 중력: '0.6 G', 기온: '-140°C', 하루: '41시간' } },
  { id: 'amethys', name: '아메티스', en: 'AMETHYS', type: T.CRYSTAL, radius: 32,
    colors: ['#3a1a5e', '#b77bff', '#ff9be8'], atmo: '#c48bff', sky: ['#2a0f4a', '#d39bff'],
    desc: '표면 전체가 보랏빛 수정으로 덮인 행성. 빛의 각도에 따라 무지갯빛으로 반짝인다.',
    stats: { 중력: '0.9 G', 기온: '-12°C', 하루: '17시간' } },
  { id: 'helios', name: '헬리오스', en: 'HELIOS', type: T.STAR, radius: 160,
    colors: ['#ff7a12', '#ffd36a', '#fff3cf'], atmo: '#ffb347', sky: ['#ff6a10', '#ffe9a8'],
    desc: '이 성운 지역을 비추는 노란 항성. 표면에서 플라스마 파도가 끓어오른다.',
    stats: { 질량: '1.2 태양', 표면온도: '5,900 K', 나이: '31억 년' } },
  { id: 'neptis', name: '넵티스', en: 'NEPTIS', type: T.GAS, radius: 80,
    colors: ['#1f4fd1', '#79b7ff', '#e6f3ff'], atmo: '#7fc4ff', sky: ['#0f2a7a', '#8cc6ff'],
    desc: '메탄 대기로 짙푸르게 빛나는 얼음 거인. 시속 2,000km의 바람이 분다.',
    stats: { 중력: '1.3 G', 기온: '-200°C', 하루: '16시간' } },
  { id: 'terra', name: '테라 노바', en: 'TERRA NOVA', type: T.OCEAN, radius: 40, moons: 1,
    colors: ['#0e5a7a', '#5c7f2e', '#c9b27a'], atmo: '#8fd0ff', sky: ['#3a7fd0', '#d6eeff'],
    desc: '숲과 바다가 공존하는 제2의 지구. 여행자들이 가장 사랑하는 행성.',
    stats: { 중력: '1.0 G', 기온: '16°C', 하루: '24시간' } },
  { id: 'rubrum', name: '루브룸', en: 'RUBRUM', type: T.ROCKY, radius: 28,
    colors: ['#5a1f14', '#b5482a', '#e3936a'], atmo: '#ff9a7a', sky: ['#5a2a24', '#e8a58a'],
    desc: '붉은 먼지 폭풍이 끊이지 않는 녹슨 행성. 거대한 협곡이 적도를 가른다.',
    stats: { 중력: '0.4 G', 기온: '-63°C', 하루: '25시간' } },
  { id: 'nebulon', name: '네뷸론', en: 'NEBULON', type: T.GAS, radius: 70,
    colors: ['#5a2a8a', '#ff8ad8', '#2a1a5a'], atmo: '#ff9ae0', sky: ['#2a1050', '#ff9ad0'],
    desc: '분홍빛 성운 가스를 머금은 몽환적인 가스 행성. 오로라가 적도까지 내려온다.',
    stats: { 중력: '1.7 G', 기온: '-80°C', 하루: '13시간' } },
  { id: 'veridia', name: '베리디아', en: 'VERIDIA', type: T.CRYSTAL, radius: 36,
    colors: ['#0d3b2e', '#3dffb0', '#d4ff5a'], atmo: '#5affc0', sky: ['#06322a', '#8affd0'],
    desc: '에메랄드 결정과 독성 늪이 빛나는 행성. 밤이면 결정이 스스로 빛난다.',
    stats: { 중력: '1.2 G', 기온: '38°C', 하루: '20시간' } },
  { id: 'cyanis', name: '시아니스', en: 'CYANIS', type: T.STAR, radius: 210,
    colors: ['#2a5aff', '#9ec0ff', '#ffffff'], atmo: '#7aa8ff', sky: ['#1a3aff', '#cfe0ff'],
    desc: '성단에서 태어난 젊고 뜨거운 청색 초거성. 주변 성운을 푸르게 물들인다.',
    stats: { 질량: '28 태양', 표면온도: '32,000 K', 나이: '400만 년' } },
  { id: 'selene', name: '셀레네', en: 'SELENE', type: T.ROCKY, radius: 22,
    colors: ['#4a4a52', '#8a8a94', '#c8c8d0'], atmo: '#9aa0b8', sky: ['#020309', '#262838'],
    desc: '대기가 거의 없는 회색 행성. 한낮에도 하늘에 별이 보인다.',
    stats: { 중력: '0.2 G', 기온: '-20°C', 하루: '29일' } },
  { id: 'saphira', name: '사피라', en: 'SAPHIRA', type: T.GAS, radius: 95, rings: true,
    colors: ['#d8d0b8', '#9fb4c8', '#6a7f9a'], atmo: '#d0e4ff', sky: ['#40506e', '#d8e2ee'],
    desc: '넓은 얼음 고리를 두른 창백한 가스 행성. 하늘을 가로지르는 고리가 장관이다.',
    stats: { 중력: '1.1 G', 기온: '-178°C', 하루: '11시간' } },
  { id: 'ember', name: '엠버', en: 'EMBER', type: T.STAR, radius: 120,
    colors: ['#8a1206', '#ff4a1a', '#ffa860'], atmo: '#ff4a2a', sky: ['#5a0a04', '#ff7a40'],
    desc: '천천히 오래 타오르는 적색 왜성. 수천억 년을 살아갈 별.',
    stats: { 질량: '0.3 태양', 표면온도: '3,100 K', 나이: '80억 년' } },
];

const planetVert = /* glsl */ `
varying vec3 vPos; varying vec3 vN; varying vec3 vW;
void main(){
  vPos = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const planetFrag = /* glsl */ `
uniform float uType, uSeed, uTime;
uniform vec3 uC1, uC2, uC3, uAtmo, uLightDir;
varying vec3 vPos; varying vec3 vN; varying vec3 vW;
${NOISE_GLSL}
void main(){
  vec3 p = normalize(vPos);
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize(uLightDir);
  float ndl = dot(N, L);
  float wrap = smoothstep(-0.12, 0.65, ndl);
  vec3 sp = p + uSeed * 7.31;
  vec3 col = uC1; vec3 emis = vec3(0.0); float spec = 0.0;

  if (uType < 0.5) {            // 암석
    float h = fbm(sp * 2.4);
    float d = fbm(sp * 9.0);
    col = mix(uC1, uC2, smoothstep(0.32, 0.68, h));
    col = mix(col, uC3, smoothstep(0.55, 0.78, d) * 0.6);
    col *= 0.7 + 0.45 * ridged(sp * 6.0);
    float canyon = pow(ridge1(sp * 1.6), 14.0);
    col = mix(col, uC1 * 0.45, canyon * 0.7);
  } else if (uType < 1.5) {     // 바다
    float h = fbm(sp * 2.2);
    float land = smoothstep(0.52, 0.545, h);
    vec3 water = mix(uC1 * 0.55, uC1 * 1.35, smoothstep(0.38, 0.52, h));
    vec3 ground = mix(uC3, uC2, smoothstep(0.54, 0.6, h));
    ground = mix(ground, uC2 * 0.6, smoothstep(0.62, 0.75, h + fbm(sp * 8.0) * 0.12));
    float ice = smoothstep(0.78, 0.86, abs(p.y) + (h - 0.5) * 0.25);
    col = mix(water, ground, land);
    col = mix(col, vec3(0.93), ice);
    spec = (1.0 - land) * (1.0 - ice);
    float cl = smoothstep(0.52, 0.74, fbm(sp * 3.0 + vec3(uTime * 0.012, 0.0, uTime * 0.007)));
    col = mix(col, vec3(1.0), cl * 0.88);
    spec *= 1.0 - cl;
  } else if (uType < 2.5) {     // 가스 거인
    float w = fbm(vec3(p.x * 2.0, p.y * 7.0, p.z * 2.0) + uSeed + vec3(uTime * 0.008, 0.0, 0.0));
    float b = sin(p.y * 15.0 + w * 5.5 + uSeed * 3.0) * 0.5 + 0.5;
    col = mix(uC1, uC2, b);
    col = mix(col, uC3, smoothstep(0.55, 0.82, fbm(vec3(p.x * 3.0, p.y * 13.0, p.z * 3.0) + uSeed * 2.0)) * 0.7);
    vec3 sc = normalize(vec3(0.62, -0.28, 0.73));
    float sd = distance(p, sc) + (fbm(p * 14.0) - 0.5) * 0.08;
    float storm = smoothstep(0.2, 0.03, sd);
    col = mix(col, mix(uC3 * 1.15, uC2, smoothstep(0.03, 0.12, sd)), storm * 0.85);
  } else if (uType < 3.5) {     // 얼음
    float h = fbm(sp * 3.0);
    col = mix(uC1, vec3(0.94, 0.97, 1.0), smoothstep(0.3, 0.72, h));
    float cr = pow(ridge1(sp * 4.0), 26.0) + pow(ridge1(sp * 9.0 + 3.0), 30.0) * 0.6;
    col = mix(col, uC2, clamp(cr, 0.0, 1.0) * 0.85);
    emis = uC1 * cr * 0.18;
    spec = 0.6;
  } else if (uType < 4.5) {     // 용암
    float h = fbm(sp * 3.0);
    float cr = pow(ridge1(sp * 3.2 + vec3(0.0, uTime * 0.01, 0.0)), 7.0);
    cr = max(cr, pow(ridge1(sp * 8.0), 14.0) * 0.8);
    col = mix(uC1, uC1 * 2.4 + 0.03, h);
    float pulse = 0.65 + 0.35 * sin(uTime * 1.6 + h * 12.0);
    emis = mix(uC2, uC3, cr) * cr * pulse * 2.6;
    col *= 1.0 - cr;
  } else if (uType < 5.5) {     // 수정
    float h = fbm(sp * 3.5);
    float f = 1.0 - max(dot(N, V), 0.0);
    vec3 ir = 0.5 + 0.5 * cos(6.2831 * (h * 1.6 + f * 0.9 + vec3(0.0, 0.33, 0.67)));
    float facet = fbm(floor(sp * 9.0) * 0.45);
    col = mix(uC1, uC2 * (0.6 + ir * 0.9), smoothstep(0.35, 0.6, facet));
    col = mix(col, uC3, smoothstep(0.62, 0.7, facet) * 0.5);
    spec = 1.2;
    emis = uC3 * pow(ridge1(sp * 5.0), 18.0) * 0.9 + uC2 * pow(f, 3.0) * 0.25;
  } else {                      // 항성
    float n = fbm(sp * 3.5 + vec3(uTime * 0.04));
    float n2 = fbm(sp * 11.0 - vec3(uTime * 0.07));
    float gran = ridged(sp * 22.0 + uTime * 0.05);
    vec3 c = mix(uC1, uC2, smoothstep(0.3, 0.7, n));
    c = mix(c, uC3, smoothstep(0.55, 0.8, n2) * 0.6);
    c *= 0.85 + gran * 0.5;
    float limb = pow(max(dot(N, V), 0.0), 0.45);
    gl_FragColor = vec4(c * (1.3 + n2 * 1.2) * (0.45 + 0.8 * limb), 1.0);
    return;
  }

  vec3 H = normalize(L + V);
  float s = pow(max(dot(N, H), 0.0), 48.0) * spec * smoothstep(0.0, 0.2, ndl);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 lit = col * (0.035 + wrap * 1.1) + s * 0.7 + uAtmo * rim * wrap * 0.7 + emis;
  gl_FragColor = vec4(lit, 1.0);
}`;

const atmoVert = /* glsl */ `
varying vec3 vN; varying vec3 vW;
void main(){
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const atmoFrag = /* glsl */ `
uniform vec3 uAtmo, uLightDir; uniform float uStrength;
varying vec3 vN; varying vec3 vW;
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float a = pow(clamp(-dot(N, V) * 1.75, 0.0, 1.0), 3.0);
  float lit = smoothstep(-0.45, 0.6, dot(N, normalize(uLightDir)));
  gl_FragColor = vec4(uAtmo * a * (0.15 + lit) * uStrength, 1.0);
}`;

const ringVert = /* glsl */ `
varying vec2 vL; varying vec3 vW;
void main(){
  vL = position.xy;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const ringFrag = /* glsl */ `
uniform vec3 uC1, uC2; uniform float uSeed;
varying vec2 vL; varying vec3 vW;
${NOISE_GLSL}
void main(){
  float r = length(vL);
  float t = (r - 1.35) / 1.15;
  float bands = snoise(vec3(r * 22.0, uSeed, 0.0)) * 0.5 + 0.5;
  float fine = snoise(vec3(r * 90.0, uSeed + 4.0, 0.0)) * 0.5 + 0.5;
  float gap = smoothstep(0.02, 0.05, abs(t - 0.62));
  float a = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.85, t) * (0.25 + 0.75 * bands) * (0.6 + 0.4 * fine) * gap;
  vec3 col = mix(uC1, uC2, bands) * 0.9;
  gl_FragColor = vec4(col, a * 0.85);
}`;

let coronaTex = null;
function getCoronaTexture() {
  if (coronaTex) return coronaTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.22)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.06)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  coronaTex = new THREE.CanvasTexture(c);
  coronaTex.colorSpace = THREE.SRGBColorSpace;
  return coronaTex;
}

const SPHERE = new THREE.SphereGeometry(1, 128, 96);
const SPHERE_LO = new THREE.SphereGeometry(1, 48, 32);

function bodyMaterial(type, colors, atmo, seed) {
  return new THREE.ShaderMaterial({
    vertexShader: planetVert,
    fragmentShader: planetFrag,
    uniforms: {
      uType: { value: type },
      uSeed: { value: seed },
      uTime: { value: 0 },
      uC1: { value: new THREE.Color(colors[0]) },
      uC2: { value: new THREE.Color(colors[1]) },
      uC3: { value: new THREE.Color(colors[2]) },
      uAtmo: { value: new THREE.Color(atmo) },
      uLightDir: { value: new THREE.Vector3(1, 0.3, 0.4).normalize() },
    },
  });
}

export function createPlanet(def, seed) {
  const r = def.radius;
  const group = new THREE.Group();
  const pivot = new THREE.Group();          // 사용자가 돌리는 축
  group.add(pivot);
  const tilt = new THREE.Group();           // 행성 고유 기울기
  tilt.rotation.z = (seed - 0.5) * 0.8;
  tilt.rotation.x = (seed * 7 % 1 - 0.5) * 0.4;
  pivot.add(tilt);

  const mat = bodyMaterial(def.type, def.colors, def.atmo, seed);
  const body = new THREE.Mesh(SPHERE, mat);
  body.scale.setScalar(r);
  tilt.add(body);

  const lightDir = mat.uniforms.uLightDir.value;
  const times = [mat.uniforms.uTime];

  if (def.type !== T.STAR) {
    const atmo = new THREE.Mesh(SPHERE_LO, new THREE.ShaderMaterial({
      vertexShader: atmoVert, fragmentShader: atmoFrag,
      uniforms: { uAtmo: { value: new THREE.Color(def.atmo) }, uLightDir: { value: lightDir }, uStrength: { value: def.type === T.ROCKY && def.id === 'selene' ? 0.4 : 1.6 } },
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }));
    atmo.scale.setScalar(r * 1.2);
    group.add(atmo);
  } else {
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getCoronaTexture(), color: new THREE.Color(def.atmo).multiplyScalar(1.6),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    corona.scale.setScalar(r * 6.5);
    group.add(corona);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getCoronaTexture(), color: new THREE.Color(def.colors[1]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35,
    }));
    glow.scale.setScalar(r * 16);
    group.add(glow);
  }

  if (def.rings) {
    const geo = new THREE.RingGeometry(1.35, 2.5, 160, 1);
    const ring = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: ringVert, fragmentShader: ringFrag,
      uniforms: { uC1: { value: new THREE.Color(def.colors[1]) }, uC2: { value: new THREE.Color(def.colors[2]).lerp(new THREE.Color('#ffffff'), 0.3) }, uSeed: { value: seed * 10 } },
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
    }));
    ring.scale.setScalar(r);
    ring.rotation.x = -Math.PI / 2 + 0.12;
    tilt.add(ring);
  }

  const moons = [];
  for (let i = 0; i < (def.moons || 0); i++) {
    const mm = bodyMaterial(T.ROCKY, ['#3e3c40', '#8d8a86', '#c9c3b8'], '#9aa0b8', seed + i * 0.37);
    mm.uniforms.uLightDir.value = lightDir;
    times.push(mm.uniforms.uTime);
    const moon = new THREE.Mesh(SPHERE_LO, mm);
    moon.scale.setScalar(r * (0.16 + i * 0.06));
    const orbit = new THREE.Group();
    orbit.rotation.z = 0.25 - i * 0.4;
    orbit.rotation.y = i * 2.1;
    orbit.add(moon);
    moon.position.x = r * (2.6 + i * 1.1);
    group.add(orbit);
    moons.push({ orbit, speed: 0.12 / (1 + i) });
  }

  const spin = def.type === T.GAS ? 0.06 : def.type === T.STAR ? 0.02 : 0.04;
  return {
    def, group, pivot, body, radius: r, lightDir,
    update(dt, t) {
      for (const u of times) u.value = t;
      body.rotation.y += spin * dt;
      for (const m of moons) m.orbit.rotation.y += m.speed * dt;
    },
  };
}
