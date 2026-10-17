// 공용 GLSL 노이즈 (Ashima 3D simplex + fbm 계열)
export const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// 0..1
float fbm(vec3 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * snoise(p); p *= 2.02; a *= 0.5; }
  return s * 0.5 + 0.5;
}

// 능선(갈라짐) 노이즈: 1에 가까울수록 선 위
float ridge1(vec3 p){ return 1.0 - abs(snoise(p)); }

float ridged(vec3 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { float n = 1.0 - abs(snoise(p)); s += a * n * n; p *= 2.03; a *= 0.5; }
  return s;
}
`;

// 지형용 2D value noise — GLSL과 JS가 같은 식을 써서 CPU에서도 지면 높이를 알 수 있다
export const VNOISE_GLSL = /* glsl */ `
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm2(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
float ridge2(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { float n = 1.0 - abs(vnoise(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.07 + vec2(5.3, 1.3); a *= 0.5; }
  return s;
}
uniform float uAmp, uRidge, uSeed;
float terrainH(vec2 xz){
  vec2 p = xz * 0.0011 + vec2(uSeed * 13.0, uSeed * 7.0);
  float h = fbm2(p);
  float r = ridge2(p * 0.8);
  return (pow(h, 1.6) * (1.0 - uRidge) * 1.6 + r * uRidge * 1.3) * uAmp;
}
`;

const fract = (x) => x - Math.floor(x);
function hash12(x, y) {
  let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d; b += d; c += d;
  return fract((a + b) * c);
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash12(ix, iy), b = hash12(ix + 1, iy);
  const c = hash12(ix, iy + 1), d = hash12(ix + 1, iy + 1);
  const ab = a + (b - a) * ux, cd = c + (d - c) * ux;
  return ab + (cd - ab) * uy;
}
function fbm2(x, y) {
  let s = 0, a = 0.5;
  for (let i = 0; i < 6; i++) { s += a * vnoise(x, y); x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; a *= 0.5; }
  return s;
}
function ridge2(x, y) {
  let s = 0, a = 0.5;
  for (let i = 0; i < 5; i++) { const n = 1 - Math.abs(vnoise(x, y) * 2 - 1); s += a * n * n; x = x * 2.07 + 5.3; y = y * 2.07 + 1.3; a *= 0.5; }
  return s;
}
export function terrainHeight(x, z, amp, ridge, seed) {
  const px = x * 0.0011 + seed * 13, pz = z * 0.0011 + seed * 7;
  const h = fbm2(px, pz);
  const r = ridge2(px * 0.8, pz * 0.8);
  return (Math.pow(h, 1.6) * (1 - ridge) * 1.6 + r * ridge * 1.3) * amp;
}
