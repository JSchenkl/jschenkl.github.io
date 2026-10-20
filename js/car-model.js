import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const CAR_MODEL_URL = 'assets/models/bmw_m4_gt3.glb';

let loadPromise = null;

// Fetches + parses the BMW model exactly once (shared across hero and
// ticker scenes) and hands each caller back a fresh clone — clone() only
// duplicates the transform-node hierarchy, geometries/materials/textures
// stay shared, so this costs no extra memory or network traffic.
export function loadCarModel() {
  if (!loadPromise) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loadPromise = new Promise((resolve, reject) => {
      loader.load(CAR_MODEL_URL, (gltf) => resolve(gltf.scene), undefined, reject);
    });
  }
  return loadPromise.then((scene) => scene.clone());
}

// Centers the model on the X/Z origin, sits it on the y=0 ground plane,
// and normalizes its scale to targetSize (longest dimension, scene units).
export function normalizeModel(model, targetSize) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / maxDim;
  model.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= scaledBox.min.y;
}
