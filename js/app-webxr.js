// app-webxr.js
// Экспортирует startWebXR, stopWebXR, isWebXRSupported
// Uses Three.js for rendering into XR session (hit-test + simple placement)

import * as THREE from 'three';

let renderer, scene, camera;
let xrSession = null;
let xrRefSpace = null;
let hitTestSource = null;
let reticle = null;
let placed = false;

export async function isWebXRSupported() {
  if (!navigator.xr) return false;
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-ar');
    return !!supported;
  } catch {
    return false;
  }
}

export async function startWebXR(opts = {}) {
  // opts.onExit, opts.onMessage
  if (!navigator.xr) {
    opts.onMessage?.('navigator.xr missing');
    return false;
  }

  // create renderer/scene if absent
  if (!renderer) initThree();

  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', 'local']
    });

    xrSession = session;

    // make GL XR compatible & set baseLayer
    const gl = renderer.getContext();
    await gl.makeXRCompatible();
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

    renderer.xr.setSession(session);

    xrRefSpace = await session.requestReferenceSpace('local');

    // viewer + hitTest
    const viewer = await session.requestReferenceSpace('viewer');
    hitTestSource = await session.requestHitTestSource({ space: viewer });

    // reticle
    if (!reticle) {
      reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.07, 0.1, 32).rotateX(-Math.PI/2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);
    }

    // XR frame loop via session.requestAnimationFrame
    session.requestAnimationFrame(onXRFrame);

    // set click to place object
    window.addEventListener('click', placeAtReticle);

    opts.onMessage?.('WebXR session started');
    return true;
  } catch (err) {
    console.error('startWebXR err', err);
    opts.onMessage?.('Не удалось запустить WebXR: ' + err?.message);
    return false;
  }
}

export async function stopWebXR() {
  if (xrSession) {
    try { await xrSession.end(); } catch(e){ console.warn(e); }
    xrSession = null;
  }
  if (renderer) {
    renderer.setAnimationLoop(null);
    // remove canvas
    const container = document.getElementById('canvas-container');
    if (container && renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    renderer = null;
  }
  hitTestSource = null;
  xrRefSpace = null;
  reticle = null;
  placed = false;
}

// ---------- helpers ----------
function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 20);

  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  const container = document.getElementById('canvas-container');
  container.appendChild(renderer.domElement);

  // simple light
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(hemi);
}

function onXRFrame(time, frame) {
  if (!xrSession) return;
  xrSession.requestAnimationFrame(onXRFrame);

  const pose = frame.getViewerPose(xrRefSpace);
  if (!pose) {
    renderer.render(scene, camera);
    return;
  }

  // hit test
  if (hitTestSource) {
    const hits = frame.getHitTestResults(hitTestSource);
    if (hits.length > 0) {
      const hit = hits[0];
      const hitPose = hit.getPose(xrRefSpace);
      reticle.visible = true;
      reticle.matrix.fromArray(hitPose.transform.matrix);
    } else {
      reticle.visible = false;
    }
  }

  renderer.render(scene, camera);
}

function placeAtReticle() {
  if (!reticle || !reticle.visible || placed) return;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.12,0.12,0.12),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
  );
  box.position.setFromMatrixPosition(reticle.matrix);
  scene.add(box);
  placed = true;
}
