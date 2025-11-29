// launcher.js
// Режим автозапуска: пытаемся WebXR, иначе — fallback.
// Управляет UI и загружает/останавливает режимы.

import { startWebXR, stopWebXR, isWebXRSupported } from './app-webxr.js';
import { startFallback, stopFallback } from './app-fallback.js';

const btnAuto = document.getElementById('btn-autostart');
const btnWebXR = document.getElementById('btn-webxr');
const btnFallback = document.getElementById('btn-fallback');
const btnStop = document.getElementById('btn-stop');

const dWebXR = document.getElementById('d-webxr');
const dAR = document.getElementById('d-ar');
const dHit = document.getElementById('d-hit');
const dCam = document.getElementById('d-camera');
const dGL = document.getElementById('d-gl');
const messages = document.getElementById('messages');

let currentMode = null; // 'webxr' | 'fallback' | null

function msg(text) {
  messages.textContent = text;
  console.log('[launcher]', text);
}

// Диагностика
async function runDiagnostics() {
  dWebXR.textContent = '⏳';
  dAR.textContent = '⏳';
  dHit.textContent = '⏳';
  dCam.textContent = '⏳';
  dGL.textContent = '⏳';

  // WebXR existence
  if ('xr' in navigator) {
    dWebXR.textContent = '✓';
  } else {
    dWebXR.textContent = '❌';
  }

  // immersive-ar support
  try {
    if (navigator.xr) {
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      dAR.textContent = supported ? '✓' : '❌';
    } else {
      dAR.textContent = '❌';
    }
  } catch (e) {
    dAR.textContent = '⚠';
  }

  // HitTest: try an inline session with optionalFeatures (best-effort)
  try {
    if (navigator.xr) {
      const test = await navigator.xr.requestSession?.('inline', { optionalFeatures: ['hit-test'] });
      if (test) {
        dHit.textContent = '✓';
        await test.end();
      } else {
        dHit.textContent = '❌';
      }
    } else {
      dHit.textContent = '❌';
    }
  } catch (e) {
    dHit.textContent = '❌';
  }

  // camera (getUserMedia)
  try {
    await navigator.mediaDevices.getUserMedia({ video: true });
    dCam.textContent = '✓';
  } catch (e) {
    dCam.textContent = '❌';
  }

  // WebGL.makeXRCompatible test
  try {
    // create temporary canvas/gl if renderer not loaded
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl && gl.makeXRCompatible) {
      await gl.makeXRCompatible();
      dGL.textContent = '✓';
    } else if (gl) {
      dGL.textContent = '⚠';
    } else {
      dGL.textContent = '❌';
    }
  } catch (e) {
    dGL.textContent = '❌';
  }
}

runDiagnostics();

// UI handlers
btnAuto.onclick = async () => {
  msg('Автовыбор: пробую WebXR → если нет, fallback');
  await stopEverything();
  const webxrOk = await isWebXRSupported();
  if (webxrOk) {
    const started = await startWebXR({ onExit: onModeExit, onMessage: msg });
    if (started) { currentMode = 'webxr'; msg('Запущен WebXR'); return; }
  }
  // fallback
  await startFallback({ onExit: onModeExit, onMessage: msg });
  currentMode = 'fallback';
  msg('Запущен fallback (camera)');
};

btnWebXR.onclick = async () => {
  msg('Запуск WebXR (по запросу)');
  await stopEverything();
  const ok = await isWebXRSupported();
  if (!ok) { msg('WebXR не поддержан — используйте fallback'); return; }
  const started = await startWebXR({ onExit: onModeExit, onMessage: msg });
  if (started) {
    currentMode = 'webxr';
    msg('Запущен WebXR');
  } else {
    msg('Не удалось стартовать WebXR — попробуйте fallback');
  }
};

btnFallback.onclick = async () => {
  msg('Запуск fallback (camera)');
  await stopEverything();
  await startFallback({ onExit: onModeExit, onMessage: msg });
  currentMode = 'fallback';
};

btnStop.onclick = async () => {
  msg('Остановка всех режимов');
  await stopEverything();
  currentMode = null;
};

async function stopEverything() {
  try { await stopWebXR(); } catch (e) { /* ignore */ }
  try { await stopFallback(); } catch (e) { /* ignore */ }
}

function onModeExit() {
  msg('Режим завершён');
  currentMode = null;
  runDiagnostics();
}
