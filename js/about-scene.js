import * as THREE from 'three';
import { loadCarModel, normalizeModel } from './car-model.js';

const ACCENT_COLOR = 0xe10600;
const CAR_SIZE = 0.4;
const ORBIT_RADIUS = 0.6;
const ORBIT_SPEED = 0.0014; // rad/ms
const DRIFT_OFFSET = Math.PI / 6; // slide angle, for the drifting-donut look
const SMOKE_INTERVAL_MS = 110;
const SMOKE_LIFETIME_MS = 1500;

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

// Irregular puff texture: several overlapping, randomly offset radial
// blobs instead of one perfect circle, so puffs read as turbulent smoke
// rather than flat dots. Pre-rendering a handful of variants (instead of
// redrawing per spawn) keeps this cheap while still giving visual variety.
function buildSmokeTexture() {
  const size = 96;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const mid = size / 2;
  const blobCount = 5 + Math.floor(Math.random() * 3);

  for (let i = 0; i < blobCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * mid * 0.45;
    const bx = mid + Math.cos(angle) * dist;
    const by = mid + Math.sin(angle) * dist;
    const r = mid * (0.45 + Math.random() * 0.4);
    const warmth = Math.random();
    const rC = 205 + warmth * 20;
    const gC = 200 + warmth * 10;
    const bC = 195 - warmth * 15;
    const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    gradient.addColorStop(0, `rgba(${rC},${gC},${bC},0.55)`);
    gradient.addColorStop(0.6, `rgba(${rC},${gC},${bC},0.28)`);
    gradient.addColorStop(1, `rgba(${rC},${gC},${bC},0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(c);
}

function buildSmokeTextures(count = 4) {
  return Array.from({ length: count }, buildSmokeTexture);
}

function createSmokeSystem(scene, textures) {
  const puffs = [];

  function spawn(position) {
    const texture = textures[Math.floor(Math.random() * textures.length)];
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.6 });
    const sprite = new THREE.Sprite(material);
    sprite.material.rotation = Math.random() * Math.PI * 2;
    sprite.position.copy(position);
    sprite.position.y = 0.01 + Math.random() * 0.01;
    sprite.scale.setScalar(0.035 + Math.random() * 0.015);
    scene.add(sprite);
    puffs.push({
      sprite,
      born: performance.now(),
      baseX: position.x,
      baseZ: position.z,
      driftX: (Math.random() - 0.5) * 0.00004,
      driftZ: (Math.random() - 0.5) * 0.00004,
      spin: (Math.random() - 0.5) * 0.0015,
      startScale: sprite.scale.x,
    });
  }

  function update(now) {
    for (let i = puffs.length - 1; i >= 0; i -= 1) {
      const p = puffs[i];
      const age = now - p.born;
      if (age > SMOKE_LIFETIME_MS) {
        scene.remove(p.sprite);
        p.sprite.material.dispose();
        puffs.splice(i, 1);
        continue;
      }
      const t = age / SMOKE_LIFETIME_MS;
      const ease = 1 - (1 - t) * (1 - t);
      p.sprite.material.opacity = 0.6 * (1 - t);
      p.sprite.scale.setScalar(p.startScale + ease * 0.2);
      p.sprite.position.x = p.baseX + p.driftX * age;
      p.sprite.position.z = p.baseZ + p.driftZ * age;
      p.sprite.position.y = 0.01 + ease * 0.06;
      p.sprite.material.rotation += p.spin;
    }
  }

  function dispose() {
    puffs.forEach((p) => {
      scene.remove(p.sprite);
      p.sprite.material.dispose();
    });
    puffs.length = 0;
  }

  return { spawn, update, dispose };
}

// Decorative mini-scene next to the About text: the car loops around a
// tight circle, sliding at an angle like a donut, with tire-smoke puffs
// spawned behind it. Purely cosmetic — hidden entirely on any failure.
export function initAboutScene({ canvas, panel, onFail }) {
  const fail = () => {
    if (onFail) onFail();
  };

  if (!canvas || !panel || !isWebGLAvailable()) {
    fail();
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    fail();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(0, 1.9, 2.2);
  camera.lookAt(0, 0.05, 0);

  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(2, 3, 2);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x4a4a54, 0.95));

  const rim = new THREE.PointLight(ACCENT_COLOR, 1.2, 6);
  rim.position.set(-1.2, 0.8, -1.2);
  scene.add(rim);

  const car = new THREE.Group();
  scene.add(car);

  const smokeTextures = buildSmokeTextures();
  const smoke = createSmokeSystem(scene, smokeTextures);

  function resize() {
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);
  resize();

  let visible = true;
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => { visible = entry.isIntersecting; }),
    { threshold: 0.05 }
  );
  observer.observe(panel);

  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
  });

  let lastSmokeAt = 0;
  let carReady = false;

  function animate(now) {
    requestAnimationFrame(animate);
    if (!visible || !running) return;

    const theta = now * ORBIT_SPEED;
    car.position.x = Math.sin(theta) * ORBIT_RADIUS;
    car.position.z = Math.cos(theta) * ORBIT_RADIUS;

    const travelAngle = Math.atan2(Math.sin(theta), Math.cos(theta)) + Math.PI / 2;
    car.rotation.y = travelAngle + DRIFT_OFFSET;

    if (carReady && now - lastSmokeAt > SMOKE_INTERVAL_MS) {
      lastSmokeAt = now;
      const rearOffset = new THREE.Vector3(-0.12, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.rotation.y);
      smoke.spawn(new THREE.Vector3(car.position.x + rearOffset.x, 0, car.position.z + rearOffset.z));
    }
    smoke.update(now);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);

  loadCarModel()
    .then((model) => {
      normalizeModel(model, CAR_SIZE);
      car.add(model);
      carReady = true;
    })
    .catch(fail);
}
