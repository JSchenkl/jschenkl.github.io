import * as THREE from 'three';
import { loadCarModel, normalizeModel } from './car-model.js';

const YAW_RANGE = 0.7;
const PITCH_RANGE = 0.22;
const LERP_FACTOR = 0.12;
const IDLE_TIMEOUT_MS = 2000;
const AUTO_ROTATE_SPEED = 0.003;
const BOB_AMPLITUDE = 0.035;
const BOB_SPEED = 0.0014;
const RIM_PULSE_AMOUNT = 0.5;
const RIM_PULSE_SPEED = 0.0022;
const ACCENT_COLOR = 0xe10600;
const TARGET_SIZE = 2.6; // longest model dimension, in scene units, after normalization

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

function buildGroundGrid() {
  const grid = new THREE.GridHelper(6, 24, ACCENT_COLOR, 0x2e2e34);
  grid.position.y = -0.05;
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  return grid;
}

function showFallback(canvasEl, fallbackEl) {
  if (canvasEl) canvasEl.style.display = 'none';
  if (fallbackEl) fallbackEl.style.display = 'block';
}

function showCanvas(canvasEl, fallbackEl) {
  if (canvasEl) canvasEl.style.display = '';
  if (fallbackEl) fallbackEl.style.display = 'none';
}

export function initHeroScene({ canvas, fallback, reduceMotion }) {
  if (!canvas || !isWebGLAvailable()) {
    showFallback(canvas, fallback);
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    showFallback(canvas, fallback);
    return;
  }

  const container = canvas.parentElement;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(2.6, 1.6, 3.2);
  camera.lookAt(0, 0.3, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 4, 2);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-2, 2, -1);
  scene.add(fill);

  const rim = new THREE.PointLight(ACCENT_COLOR, 1.4, 10);
  const rimBaseIntensity = rim.intensity;
  rim.position.set(-2, 1, -2);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0x404048, 0.9));

  const car = new THREE.Group();
  scene.add(car);
  scene.add(buildGroundGrid());

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);
  resize();

  let targetYaw = 0;
  let targetPitch = 0;
  let autoRotateWeight = reduceMotion ? 0 : 1;
  let lastPointerMove = performance.now();
  let isTouch = false;
  let autoAngle = 0;

  function onPointerMove(e) {
    if (isTouch || reduceMotion) return;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    targetYaw = nx * YAW_RANGE;
    targetPitch = ny * PITCH_RANGE;
    lastPointerMove = performance.now();
  }
  function onTouchStart() {
    isTouch = true;
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });

  let visible = true;
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => { visible = entry.isIntersecting; }),
    { threshold: 0.05 }
  );
  observer.observe(container);

  let reducedFrameRendered = false;

  function animate() {
    requestAnimationFrame(animate);
    if (!visible) return;

    if (reduceMotion) {
      if (!reducedFrameRendered) {
        car.rotation.y = 0.3;
        renderer.render(scene, camera);
        reducedFrameRendered = true;
      }
      return;
    }

    const now = performance.now();
    const idleFor = now - lastPointerMove;
    const wantsAutoRotate = isTouch || idleFor > IDLE_TIMEOUT_MS;
    autoRotateWeight += ((wantsAutoRotate ? 1 : 0) - autoRotateWeight) * 0.03;
    autoAngle += AUTO_ROTATE_SPEED;

    const blendedYaw = targetYaw * (1 - autoRotateWeight) + autoAngle * autoRotateWeight;
    car.rotation.y += (blendedYaw - car.rotation.y) * LERP_FACTOR;
    car.rotation.x += (targetPitch * (1 - autoRotateWeight) - car.rotation.x) * LERP_FACTOR;
    car.position.y = Math.sin(now * BOB_SPEED) * BOB_AMPLITUDE;
    rim.intensity = rimBaseIntensity + Math.sin(now * RIM_PULSE_SPEED) * RIM_PULSE_AMOUNT;

    renderer.render(scene, camera);
  }

  // Grid + lights render immediately; the car model pops in once it loads.
  showCanvas(canvas, fallback);
  animate();

  loadCarModel()
    .then((model) => {
      normalizeModel(model, TARGET_SIZE);
      car.add(model);
    })
    .catch(() => {
      showFallback(canvas, fallback);
    });
}
