import * as THREE from 'three';
import { NOISE_GLSL } from './noise.js';
import { PLANETS, T, createPlanet } from './planets.js';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 레퍼런스(트럼플러 14)처럼 빛나는 성단이 저 멀리 앞쪽에 있다
export const CLUSTER = new THREE.Vector3(0, 260, -5400);

const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skyFrag = /* glsl */ `
uniform vec3 uClusterDir;
varying vec3 vDir;
${NOISE_GLSL}
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
void main(){
  vec3 d = normalize(vDir);
  float n1 = fbm(d * 1.6 + 3.1);
  float n2 = fbm(d * 3.2 + n1 * 1.6);
  float n3 = fbm(d * 7.0 + 7.3);
  float cd = dot(d, uClusterDir) * 0.5 + 0.5;

  vec3 col = vec3(0.003, 0.005, 0.016);
  // 푸른 전리 가스
  float blue = smoothstep(0.34, 0.92, n2) * (0.25 + 1.1 * pow(cd, 4.0));
  col += vec3(0.08, 0.17, 0.48) * blue;
  col += vec3(0.32, 0.45, 0.95) * pow(blue, 3.0) * 0.55;
  col += vec3(0.25, 0.35, 0.8) * pow(cd, 40.0) * 0.6;
  // 갈색 먼지 기둥
  float dust = smoothstep(0.48, 0.8, fbm(d * 2.6 + n3 * 0.9 + 11.0));
  vec3 dustCol = mix(vec3(0.22, 0.09, 0.03), vec3(0.62, 0.34, 0.16), n3);
  col = mix(col, dustCol * (0.35 + 0.5 * n2), dust * 0.8);
  // 어두운 먼지 띠
  float lane = smoothstep(0.55, 0.78, fbm(d * 4.5 + 21.0));
  col *= 1.0 - lane * 0.65;
  // 아주 작은 배경 별
  vec3 g = d * 260.0;
  vec3 c = floor(g);
  float h = hash13(c);
  vec3 jp = c + vec3(hash13(c + 1.7), hash13(c + 4.3), hash13(c + 9.1));
  float sd = length(g - jp);
  float star = step(0.93, h) * smoothstep(0.32, 0.0, sd) * (0.4 + 2.5 * pow(hash13(c + 2.2), 6.0));
  vec3 sc = mix(vec3(1.0, 0.8, 0.6), vec3(0.7, 0.82, 1.0), hash13(c + 5.5));
  col += sc * star * (1.0 - lane * 0.8);
  gl_FragColor = vec4(col, 1.0);
}`;

const starVert = /* glsl */ `
attribute float aSize; attribute vec3 aColor; attribute float aBright;
uniform float uScale, uTime;
varying vec3 vColor; varying float vBright;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 0.82 + 0.18 * sin(uTime * (1.5 + aBright) + position.x * 0.37 + position.y * 0.11);
  gl_PointSize = clamp(aSize * uScale / -mv.z, 2.0, 160.0);
  vColor = aColor * tw;
  vBright = aBright;
  gl_Position = projectionMatrix * mv;
}`;

const starFrag = /* glsl */ `
varying vec3 vColor; varying float vBright;
void main(){
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r = length(uv);
  float core = exp(-r * r * 28.0) * 1.6;
  float halo = exp(-r * 5.0) * 0.4 * smoothstep(1.0, 0.6, r);
  float sx = exp(-abs(uv.y) * 70.0) * pow(1.0 - min(abs(uv.x), 1.0), 2.0);
  float sy = exp(-abs(uv.x) * 70.0) * pow(1.0 - min(abs(uv.y), 1.0), 2.0);
  float spikes = (sx + sy) * vBright;
  float a = core + halo * (0.4 + vBright) + spikes;
  gl_FragColor = vec4(vColor * a, 1.0);
}`;

const dustVert = /* glsl */ `
uniform vec3 uCam; uniform float uScale;
varying float vA;
void main(){
  vec3 p = mod(position - uCam, 600.0) - 300.0 + uCam;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA = 1.0 - smoothstep(150.0, 300.0, length(p - uCam));
  gl_PointSize = clamp(1.6 * uScale / -mv.z, 1.0, 6.0);
  gl_Position = projectionMatrix * mv;
}`;

const dustFrag = /* glsl */ `
varying float vA;
void main(){
  float r = length(gl_PointCoord * 2.0 - 1.0);
  gl_FragColor = vec4(vec3(0.55, 0.65, 0.9) * (1.0 - r) * vA * 0.7, 1.0);
}`;

const STAR_COLORS = [
  [0.65, 0.78, 1.0], [0.8, 0.88, 1.0], [1.0, 1.0, 1.0], [1.0, 0.92, 0.75], [1.0, 0.75, 0.48], [1.0, 0.55, 0.38],
];

function makeCloudTexture(rand) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 40; i++) {
    const x = 128 + (rand() - 0.5) * 120, y = 128 + (rand() - 0.5) * 120;
    const rr = 20 + rand() * 70;
    const grd = g.createRadialGradient(x, y, 0, x, y, rr);
    grd.addColorStop(0, `rgba(255,255,255,${0.08 + rand() * 0.12})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  }
  // 가장자리 페이드
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(128, 128, 30, 128, 128, 128);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Space {
  constructor() {
    this.scene = new THREE.Scene();
    this.rand = mulberry32(1407);
    this.uTime = { value: 0 };
    this.uScale = { value: 1000 };
    this.buildSky();
    this.buildStars();
    this.buildNebula();
    this.buildDust();
    this.buildPlanets();
  }

  buildSky() {
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(16000, 64, 32),
      new THREE.ShaderMaterial({
        vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false,
        uniforms: { uClusterDir: { value: CLUSTER.clone().normalize() } },
      }),
    );
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
  }

  starPoints(count, gen) {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    const size = new Float32Array(count), bright = new Float32Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const s = gen(v, i);
      pos.set([v.x, v.y, v.z], i * 3);
      col.set(s.color, i * 3);
      size[i] = s.size; bright[i] = s.bright;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: starVert, fragmentShader: starFrag,
      uniforms: { uScale: this.uScale, uTime: this.uTime },
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  buildStars() {
    const R = this.rand;
    const gauss = () => (R() + R() + R() + R() - 2) / 2;
    // 넓게 퍼진 별
    this.starPoints(9000, (v) => {
      v.set(R() - 0.5, R() - 0.5, R() - 0.5).normalize().multiplyScalar(1200 + Math.pow(R(), 0.6) * 9000);
      const big = R() < 0.03;
      const c = STAR_COLORS[Math.floor(R() * STAR_COLORS.length)];
      const k = 0.5 + R() * 0.7;
      return { color: c.map((x) => x * k * (big ? 1.6 : 1)), size: big ? 30 + R() * 30 : 6 + R() * 10, bright: big ? 0.6 + R() * 0.6 : 0 };
    });
    // 성단: 푸르고 밝은 젊은 별들이 빽빽이
    this.starPoints(2600, (v) => {
      const core = R() < 0.35;
      const s = core ? 260 : 900;
      v.set(gauss() * s, gauss() * s * 0.8, gauss() * s).add(CLUSTER);
      const giant = R() < (core ? 0.08 : 0.025);
      const c = R() < 0.7 ? STAR_COLORS[Math.floor(R() * 3)] : STAR_COLORS[3 + Math.floor(R() * 3)];
      const k = 0.6 + R() * 0.8;
      return { color: c.map((x) => x * k * (giant ? 2.2 : 1.1)), size: giant ? 120 + R() * 140 : 14 + R() * 26, bright: giant ? 0.9 + R() * 0.6 : R() < 0.2 ? 0.4 : 0 };
    });
  }

  buildNebula() {
    const R = this.rand;
    const tex = makeCloudTexture(R);
    const tex2 = makeCloudTexture(R);
    const add = (pos, scale, color, opacity, additive) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: R() < 0.5 ? tex : tex2, color, opacity, transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      s.material.rotation = R() * Math.PI * 2;
      s.position.copy(pos);
      s.scale.setScalar(scale);
      this.scene.add(s);
    };
    const gauss = () => (R() + R() + R() - 1.5) / 1.5;
    // 성단 주위 푸른 빛
    for (let i = 0; i < 30; i++) {
      const p = new THREE.Vector3(gauss() * 2200, gauss() * 1400, gauss() * 1800).add(CLUSTER);
      const c = new THREE.Color().setHSL(0.6 + R() * 0.05, 0.75, 0.45 + R() * 0.15);
      add(p, 1600 + R() * 2600, c, 0.025 + R() * 0.035, true);
    }
    // 갈색 먼지 구름 (레퍼런스의 오른쪽 기둥들)
    for (let i = 0; i < 46; i++) {
      const side = R() < 0.65 ? 1 : -1;
      const p = new THREE.Vector3(side * (900 + R() * 2600), (R() - 0.5) * 2400, -600 - R() * 5200);
      const c = new THREE.Color().setHSL(0.06 + R() * 0.04, 0.5, 0.05 + R() * 0.07);
      add(p, 900 + R() * 2000, c, 0.25 + R() * 0.3, false);
    }
    // 길 위의 옅은 가스
    for (let i = 0; i < 28; i++) {
      const p = new THREE.Vector3((R() - 0.5) * 2000, (R() - 0.5) * 900, -200 - R() * 4200);
      const c = new THREE.Color().setHSL(R() < 0.7 ? 0.6 : 0.9, 0.6, 0.4);
      add(p, 500 + R() * 900, c, 0.012 + R() * 0.015, true);
    }
  }

  buildDust() {
    const n = 1800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) pos[i] = this.rand() * 600;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dustUniforms = { uCam: { value: new THREE.Vector3() }, uScale: this.uScale };
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: dustVert, fragmentShader: dustFrag, uniforms: this.dustUniforms,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  buildPlanets() {
    const R = this.rand;
    const starSlots = {
      helios: new THREE.Vector3(1100, 280, -1100),
      cyanis: new THREE.Vector3(-1700, 420, -3300),
      ember: new THREE.Vector3(1500, -380, -3900),
    };
    this.planets = [];
    let z = -120;
    let k = 0;
    PLANETS.forEach((def, i) => {
      const p = createPlanet(def, (i * 0.618 + 0.13) % 1);
      if (def.type === T.STAR) {
        p.group.position.copy(starSlots[def.id]);
      } else {
        z -= 230 + def.radius * 2.6;
        const side = k % 2 === 0 ? 1 : -1;
        p.group.position.set(side * (220 + def.radius * 2 + R() * 320), (R() - 0.5) * 380, z);
        k++;
      }
      p.labelEl = null;
      this.planets.push(p);
      this.scene.add(p.group);
    });
    // 가장 가까운 항성 쪽에서 빛을 받는다
    const stars = this.planets.filter((p) => p.def.type === T.STAR);
    for (const p of this.planets) {
      if (p.def.type === T.STAR) continue;
      let best = null, bd = Infinity;
      for (const s of stars) {
        const d = s.group.position.distanceTo(p.group.position);
        if (d < bd) { bd = d; best = s; }
      }
      p.lightDir.copy(best.group.position).sub(p.group.position).normalize();
      p.star = best;
    }
  }

  update(dt, t, camera, heightPx) {
    this.uTime.value = t;
    this.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    this.sky.position.copy(camera.position);
    this.dustUniforms.uCam.value.copy(camera.position);
    for (const p of this.planets) p.update(dt, t);
  }

  // 화면 좌표(0..1)에서 가장 가까운 행성을 찾는다. 손 떨림을 고려해 여유 반경을 둔다.
  project(camera, w, h) {
    const v = new THREE.Vector3();
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    for (const p of this.planets) {
      v.copy(p.group.position).project(camera);
      const dist = camera.position.distanceTo(p.group.position);
      p.screen = {
        x: (v.x * 0.5 + 0.5) * w,
        y: (-v.y * 0.5 + 0.5) * h,
        visible: v.z < 1 && v.z > -1,
        r: (p.radius / (dist * tanHalf)) * (h / 2),
        dist,
      };
    }
  }

  pick(pointer, w, h) {
    let best = null, bd = Infinity;
    const px = pointer.x * w, py = pointer.y * h;
    for (const p of this.planets) {
      const s = p.screen;
      if (!s || !s.visible) continue;
      const maxDist = p.def.type === T.STAR ? 9000 : 4200;
      if (s.dist > maxDist) continue;
      const tol = Math.max(s.r * 1.15, 38);
      const d = Math.hypot(px - s.x, py - s.y);
      if (d < tol && s.dist < bd) { bd = s.dist; best = p; }
    }
    return best;
  }
}
