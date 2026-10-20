import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const YAW_RANGE = 0.4;
const PITCH_RANGE = 0.12;
const LERP_FACTOR = 0.06;
const IDLE_TIMEOUT_MS = 2500;
const AUTO_ROTATE_SPEED = 0.002;
const ACCENT_COLOR = 0xe10600;
const CAR_MODEL_URL = 'assets/models/bmw_m4_gt3.glb';
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

// Centers the loaded model on the X/Z origin, sits it on the y=0 ground
// plane, and normalizes its scale so different source models frame
// consistently regardless of their original real-world units.
function normalizeModel(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = TARGET_SIZE / maxDim;
  model.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= scaledBox.min.y;
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

    const idleFor = performance.now() - lastPointerMove;
    const wantsAutoRotate = isTouch || idleFor > IDLE_TIMEOUT_MS;
    autoRotateWeight += ((wantsAutoRotate ? 1 : 0) - autoRotateWeight) * 0.03;
    autoAngle += AUTO_ROTATE_SPEED;

    const blendedYaw = targetYaw * (1 - autoRotateWeight) + autoAngle * autoRotateWeight;
    car.rotation.y += (blendedYaw - car.rotation.y) * LERP_FACTOR;
    car.rotation.x += (targetPitch * (1 - autoRotateWeight) - car.rotation.x) * LERP_FACTOR;

    renderer.render(scene, camera);
  }

  // Grid + lights render immediately; the car model pops in once it loads.
  showCanvas(canvas, fallback);
  animate();

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    CAR_MODEL_URL,
    (gltf) => {
      normalizeModel(gltf.scene);
      car.add(gltf.scene);
    },
    undefined,
    () => {
      showFallback(canvas, fallback);
    }
  );
}
