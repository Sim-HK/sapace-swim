import * as THREE from 'three';
import { NOISE_GLSL, VNOISE_GLSL, terrainHeight } from './noise.js';
import { T } from './planets.js';

const TERRAIN_SIZE = 6400;
const TERRAIN_SEG = 320;
const GRID = TERRAIN_SIZE / TERRAIN_SEG;

const terrainVert = /* glsl */ `
${VNOISE_GLSL}
varying vec3 vW; varying vec3 vN; varying float vH;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  float e = 5.0;
  float h = terrainH(w.xz);
  float hx = terrainH(w.xz + vec2(e, 0.0));
  float hz = terrainH(w.xz + vec2(0.0, e));
  vN = normalize(vec3(h - hx, e, h - hz));
  w.y = h;
  vW = w.xyz;
  vH = h / max(uAmp, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FOG = /* glsl */ `
uniform vec3 uFogCol; uniform float uFogDen;
vec3 applyFog(vec3 c, vec3 w){
  float d = length(w - cameraPosition);
  float f = 1.0 - exp(-pow(d * uFogDen, 1.5));
  return mix(c, uFogCol, clamp(f, 0.0, 1.0));
}`;

const terrainFrag = /* glsl */ `
uniform vec3 uLow, uMid, uHigh, uRock, uSunDir, uSunCol, uAmbient;
uniform float uEmis, uIri, uTime;
varying vec3 vW; varying vec3 vN; varying float vH;
${NOISE_GLSL}
${FOG}
void main(){
  vec3 N = normalize(vN);
  float h = vH + snoise(vW * 0.02) * 0.05 + snoise(vW * 0.09) * 0.025;
  vec3 col = mix(uLow, uMid, smoothstep(0.1, 0.38, h));
  col = mix(col, uHigh, smoothstep(0.5, 0.78, h));
  float slope = 1.0 - N.y;
  col = mix(col, uRock, smoothstep(0.22, 0.55, slope) * 0.85);
  vec3 V = normalize(cameraPosition - vW);
  if (uIri > 0.5) {
    vec3 ir = 0.5 + 0.5 * cos(6.2831 * (h * 2.2 + dot(N, V) * 0.8 + vec3(0.0, 0.33, 0.67)));
    col = mix(col, ir * uHigh * 1.4, 0.5 * smoothstep(0.25, 0.7, h + slope));
  }
  float diff = max(dot(N, uSunDir), 0.0);
  vec3 lit = col * (uAmbient + diff * uSunCol);
  if (uEmis > 0.0) {
    float cr = pow(1.0 - abs(snoise(vec3(vW.xz * 0.005, uTime * 0.05))), 12.0);
    lit += uLow * uEmis * (smoothstep(0.22, 0.0, h) * 1.4 + cr * smoothstep(0.55, 0.1, h) * 1.6);
  }
  gl_FragColor = vec4(applyFog(lit, vW), 1.0);
}`;

const planeVert = /* glsl */ `
varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const waterFrag = /* glsl */ `
uniform vec3 uWaterCol, uSkyCol, uSunDir, uSunCol;
uniform float uTime, uWaterEmis;
varying vec3 vW;
${NOISE_GLSL}
${FOG}
void main(){
  vec2 p = vW.xz;
  float n1 = snoise(vec3(p * 0.012, uTime * 0.3));
  float n2 = snoise(vec3(p * 0.04, uTime * 0.55 + 3.0));
  vec3 N = normalize(vec3(n1 * 0.12 + n2 * 0.06, 1.0, n2 * 0.12 - n1 * 0.05));
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  vec3 col = mix(uWaterCol, uSkyCol, fres * 0.85);
  vec3 H = normalize(V + uSunDir);
  col += uSunCol * pow(max(dot(N, H), 0.0), 220.0) * 2.5;
  if (uWaterEmis > 0.0) {
    float g = snoise(vec3(p * 0.004, uTime * 0.12)) * 0.5 + 0.5;
    float vein = pow(1.0 - abs(snoise(vec3(p * 0.01, uTime * 0.2))), 8.0);
    vec3 glow = uWaterCol * (1.0 + g * 1.4 + vein * 2.0);
    col = mix(col, glow, uWaterEmis);
  }
  gl_FragColor = vec4(applyFog(col, vW), 1.0);
}`;

const cloudFrag = /* glsl */ `
uniform vec3 uCloudCol, uSunCol;
uniform float uTime, uCover;
varying vec3 vW;
${NOISE_GLSL}
${FOG}
void main(){
  vec2 p = vW.xz * 0.0006 + vec2(uTime * 0.012, uTime * 0.005);
  float n = fbm(vec3(p, uTime * 0.015));
  float a = smoothstep(uCover, uCover + 0.22, n);
  float d = length(vW - cameraPosition);
  a *= smoothstep(9000.0, 2500.0, d);
  vec3 col = uCloudCol * (0.7 + 0.6 * n) + uSunCol * 0.08;
  gl_FragColor = vec4(applyFog(col, vW), a * 0.92);
}`;

const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const skyFrag = /* glsl */ `
uniform vec3 uZenith, uHorizon, uSunDir, uSunCol, uMoonDir, uMoonCol;
uniform float uRing, uStars, uTime;
varying vec3 vDir;
${NOISE_GLSL}
void main(){
  vec3 d = normalize(vDir);
  float t = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(t, 0.45));
  if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.55, clamp(-d.y * 4.0, 0.0, 1.0));
  if (uStars > 0.0) {
    float s = pow(max(snoise(d * 380.0), 0.0), 16.0) * 6.0;
    col += vec3(s) * uStars * smoothstep(0.0, 0.3, d.y);
  }
  if (uRing > 0.5) {
    vec3 rn = normalize(vec3(0.25, 0.4, 1.0));
    float k = dot(d, rn);
    float band = smoothstep(0.02, 0.05, k) * smoothstep(0.26, 0.2, k);
    float stripes = 0.45 + 0.55 * (snoise(vec3(k * 70.0, 0.0, 1.0)) * 0.5 + 0.5);
    col = mix(col, uMoonCol * 1.1, band * stripes * 0.6 * smoothstep(-0.02, 0.12, d.y));
  }
  float md = dot(d, uMoonDir);
  float mr = 0.13;
  if (md > cos(mr)) {
    vec3 ax = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec3 ay = cross(ax, uMoonDir);
    vec2 q = vec2(dot(d, ax), dot(d, ay)) / sin(mr);
    float z = sqrt(max(1.0 - dot(q, q), 0.0));
    vec3 n = normalize(ax * q.x + ay * q.y - uMoonDir * z);
    float l = max(dot(n, uSunDir), 0.0);
    float tex = fbm(vec3(q * 2.5, 3.0));
    vec3 mc = uMoonCol * (0.55 + 0.6 * tex) * (0.06 + l * 1.1);
    float edge = smoothstep(1.0, 0.96, length(q));
    col = mix(col, mc + col * 0.3, edge);
  }
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 1200.0) * 14.0 + pow(sd, 60.0) * 0.4 + pow(sd, 6.0) * 0.18);
  gl_FragColor = vec4(col, 1.0);
}`;

const partVert = /* glsl */ `
uniform vec3 uCam;
varying float vA;
void main(){
  vec3 p = mod(position - uCam, 500.0) - 250.0 + uCam;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA = 1.0 - smoothstep(120.0, 250.0, length(p - uCam));
  gl_PointSize = clamp(300.0 / -mv.z, 1.0, 8.0);
  gl_Position = projectionMatrix * mv;
}`;
const partFrag = /* glsl */ `
uniform vec3 uCol;
varying float vA;
void main(){
  float r = length(gl_PointCoord * 2.0 - 1.0);
  gl_FragColor = vec4(uCol, (1.0 - r) * vA * 0.8);
}`;

const C = (h) => new THREE.Color(h);
const WHITE = C('#f4f7ff');

function flightParams(def) {
  const [c1, c2, c3] = def.colors.map(C);
  const zen = C(def.sky[0]), hor = C(def.sky[1]);
  const base = {
    amp: 380, ridge: 0.5, water: null, low: c1, mid: c2, high: c3, rock: c1.clone().multiplyScalar(0.7),
    waterCol: c1, waterEmis: 0, emis: 0, iri: 0, cloud: WHITE, cover: 0.6, fog: 0.00026,
    sunCol: C('#fff1dc').multiplyScalar(1.15), moon: C('#b9b4ac'), ring: def.rings ? 1 : 0, stars: 0, particle: C('#ffffff'),
  };
  switch (def.type) {
    case T.OCEAN: return { ...base, amp: 320, ridge: 0.25, water: 0.34, low: c3, mid: c2, high: WHITE, rock: c2.clone().multiplyScalar(0.55), particle: C('#ffffff'), cover: 0.55 };
    case T.ROCKY: return { ...base, amp: 440, ridge: 0.6, cloud: hor, cover: 0.74, particle: c3, stars: def.id === 'selene' ? 1 : 0, fog: def.id === 'selene' ? 0.00012 : 0.00026 };
    case T.GAS: return { ...base, amp: 140, ridge: 0.12, low: c3, mid: c1, high: c2, rock: c1, cloud: c2, cover: 0.38, fog: 0.00045, moon: c2, particle: c2 };
    case T.ICE: return { ...base, amp: 360, ridge: 0.72, water: 0.12, low: c2, mid: c1, high: WHITE, rock: c2.clone().multiplyScalar(0.8), waterCol: c2.clone().multiplyScalar(0.6), cloud: WHITE, particle: WHITE, cover: 0.58 };
    case T.LAVA: return { ...base, amp: 400, ridge: 0.75, water: 0.17, low: c2, mid: c1, high: c1.clone().addScalar(0.08), rock: c1, waterCol: c2, waterEmis: 1, emis: 1.3, cloud: C('#2a201c'), cover: 0.5, fog: 0.00042, particle: c3, sunCol: C('#ffb27a') };
    case T.CRYSTAL: return { ...base, amp: 460, ridge: 0.85, water: 0.15, low: c1, mid: c2.clone().multiplyScalar(0.6), high: c2, rock: c1.clone().multiplyScalar(1.6), iri: 1, waterCol: c3, waterEmis: 0.6, cloud: c2, cover: 0.7, particle: c3 };
    case T.STAR: return { ...base, amp: 160, ridge: 0.3, water: 0.35, low: c1, mid: c2, high: c3, rock: c1, emis: 1.6, waterCol: c2, waterEmis: 1, cloud: c3, cover: 0.62, fog: 0.0004, particle: c3, sunCol: c3.clone().multiplyScalar(1.4), moon: C('#3a2a2a') };
    default: return base;
  }
}

export class Flight {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, 1, 1, 14000);
    this.camera.rotation.order = 'YXZ';
    this.time = { value: 0 };

    const fog = { uFogCol: { value: new THREE.Color() }, uFogDen: { value: 0.0003 } };
    this.fog = fog;
    const sunDir = { value: new THREE.Vector3(0.4, 0.35, -0.85).normalize() };
    const sunCol = { value: new THREE.Color() };
    this.sunDir = sunDir; this.sunCol = sunCol;

    this.terrainU = {
      uAmp: { value: 380 }, uRidge: { value: 0.5 }, uSeed: { value: 0.3 },
      uLow: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHigh: { value: new THREE.Color() },
      uRock: { value: new THREE.Color() }, uAmbient: { value: new THREE.Color() },
      uEmis: { value: 0 }, uIri: { value: 0 }, uTime: this.time, uSunDir: sunDir, uSunCol: sunCol, ...fog,
    };
    const tg = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEG, TERRAIN_SEG);
    tg.rotateX(-Math.PI / 2);
    this.terrain = new THREE.Mesh(tg, new THREE.ShaderMaterial({ vertexShader: terrainVert, fragmentShader: terrainFrag, uniforms: this.terrainU }));
    this.terrain.frustumCulled = false;
    this.scene.add(this.terrain);

    this.waterU = {
      uWaterCol: { value: new THREE.Color() }, uSkyCol: { value: new THREE.Color() }, uWaterEmis: { value: 0 },
      uTime: this.time, uSunDir: sunDir, uSunCol: sunCol, ...fog,
    };
    const wg = new THREE.PlaneGeometry(TERRAIN_SIZE * 2, TERRAIN_SIZE * 2);
    wg.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(wg, new THREE.ShaderMaterial({ vertexShader: planeVert, fragmentShader: waterFrag, uniforms: this.waterU }));
    this.water.frustumCulled = false;
    this.scene.add(this.water);

    this.cloudU = { uCloudCol: { value: new THREE.Color() }, uCover: { value: 0.6 }, uTime: this.time, uSunCol: sunCol, ...fog };
    const cg = new THREE.PlaneGeometry(20000, 20000);
    cg.rotateX(-Math.PI / 2);
    this.clouds = new THREE.Mesh(cg, new THREE.ShaderMaterial({
      vertexShader: planeVert, fragmentShader: cloudFrag, uniforms: this.cloudU,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.clouds.frustumCulled = false;
    this.scene.add(this.clouds);

    this.skyU = {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uMoonDir: { value: new THREE.Vector3(-0.5, 0.35, -0.8).normalize() }, uMoonCol: { value: new THREE.Color() },
      uRing: { value: 0 }, uStars: { value: 0 }, uTime: this.time, uSunDir: sunDir, uSunCol: sunCol,
    };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(12000, 48, 24), new THREE.ShaderMaterial({
      vertexShader: skyVert, fragmentShader: skyFrag, uniforms: this.skyU, side: THREE.BackSide, depthWrite: false,
    }));
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    const n = 1500;
    const pp = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) pp[i] = Math.random() * 500;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    this.partU = { uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color() } };
    const parts = new THREE.Points(pg, new THREE.ShaderMaterial({
      vertexShader: partVert, fragmentShader: partFrag, uniforms: this.partU, transparent: true, depthWrite: false,
    }));
    parts.frustumCulled = false;
    this.scene.add(parts);

    this.state = { yaw: 0, pitch: 0, roll: 0, speed: 0 };
  }

  enter(planet) {
    const def = planet.def;
    const P = flightParams(def);
    this.p = P;
    this.seed = ((def.radius * 0.137) % 1) + 0.1;
    const U = this.terrainU;
    U.uAmp.value = P.amp; U.uRidge.value = P.ridge; U.uSeed.value = this.seed;
    U.uLow.value.copy(P.low); U.uMid.value.copy(P.mid); U.uHigh.value.copy(P.high); U.uRock.value.copy(P.rock);
    U.uEmis.value = P.emis; U.uIri.value = P.iri;
    const zen = C(def.sky[0]), hor = C(def.sky[1]);
    U.uAmbient.value.copy(zen).lerp(hor, 0.5).multiplyScalar(0.45).addScalar(0.03);
    this.sunCol.value.copy(P.sunCol);
    this.fog.uFogCol.value.copy(hor);
    this.fog.uFogDen.value = P.fog;

    this.waterLevel = P.water != null ? P.water * P.amp : -1e5;
    this.water.visible = P.water != null;
    this.waterU.uWaterCol.value.copy(P.waterCol);
    this.waterU.uSkyCol.value.copy(hor);
    this.waterU.uWaterEmis.value = P.waterEmis;

    this.cloudH = P.amp * 1.25 + 220;
    this.cloudU.uCloudCol.value.copy(P.cloud);
    this.cloudU.uCover.value = P.cover;

    this.skyU.uZenith.value.copy(zen);
    this.skyU.uHorizon.value.copy(hor);
    this.skyU.uMoonCol.value.copy(P.moon);
    this.skyU.uRing.value = P.ring;
    this.skyU.uStars.value = P.stars || (zen.r + zen.g + zen.b < 0.06 ? 1 : 0.15);
    this.partU.uCol.value.copy(P.particle);

    const s = this.state;
    s.yaw = 0; s.pitch = -0.05; s.roll = 0; s.speed = 150;
    const cam = this.camera;
    cam.position.set(0, 0, 0);
    cam.position.y = Math.max(this.groundAt(0, 0), this.waterLevel) + 320;
  }

  groundAt(x, z) {
    return terrainHeight(x, z, this.p.amp, this.p.ridge, this.seed);
  }

  setAspect(a) {
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  // ctl: { steerX, steerY (-1..1), boost, brake }
  update(dt, t, ctl) {
    this.time.value = t;
    const s = this.state;
    const cam = this.camera;
    const target = ctl.boost ? 460 : ctl.brake ? 55 : 170;
    s.speed += (target - s.speed) * (1 - Math.exp(-dt * 1.4));
    s.yaw -= ctl.steerX * 1.05 * dt;
    const targetPitch = -ctl.steerY * 0.65;
    s.pitch += (targetPitch - s.pitch) * (1 - Math.exp(-dt * 2.2));
    s.roll += (-ctl.steerX * 0.55 - s.roll) * (1 - Math.exp(-dt * 3));

    const fwd = new THREE.Vector3(-Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.cos(s.yaw) * Math.cos(s.pitch));
    cam.position.addScaledVector(fwd, s.speed * dt);

    // 지면과 물 위로 유지
    const ahead = cam.position.clone().addScaledVector(fwd, 60);
    const ground = Math.max(this.groundAt(cam.position.x, cam.position.z), this.groundAt(ahead.x, ahead.z), this.waterLevel);
    const floor = ground + 28;
    if (cam.position.y < floor) {
      cam.position.y += (floor - cam.position.y) * Math.min(1, dt * 10);
      if (s.pitch < 0.15) s.pitch += dt * 1.2;
    }
    cam.position.y = Math.min(cam.position.y, 2600);
    cam.rotation.set(s.pitch, s.yaw, s.roll, 'YXZ');

    this.terrain.position.set(Math.round(cam.position.x / GRID) * GRID, 0, Math.round(cam.position.z / GRID) * GRID);
    this.water.position.set(cam.position.x, this.waterLevel, cam.position.z);
    this.clouds.position.set(cam.position.x, this.cloudH, cam.position.z);
    this.sky.position.copy(cam.position);
    this.partU.uCam.value.copy(cam.position);

    return { altitude: cam.position.y - ground, speed: s.speed };
  }
}
