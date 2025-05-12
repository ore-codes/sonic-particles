import * as THREE from 'three';
import { OrbitControls } from 'jsm/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
scene.background = new THREE.Color(0x000011);
camera.position.z = 100;

// Particle setup
let targetOpacity = 0.1;
const particleCount = 1000;
const side = Math.cbrt(particleCount) | 0;
const spacing = 5;
const positions = new Float32Array(particleCount * 3);
const initialPositions = new Float32Array(particleCount * 3);
const geometry = new THREE.BufferGeometry();

let i = 0;
for (let x = 0; x < side; x++) {
  for (let y = 0; y < side; y++) {
    for (let z = 0; z < side; z++) {
      const idx = i * 3;
      positions[idx + 0] = (x - side / 2) * spacing;
      positions[idx + 1] = (y - side / 2) * spacing;
      positions[idx + 2] = (z - side / 2) * spacing;
      initialPositions.set(positions.slice(idx, idx + 3), idx);
      i++;
      if (i >= particleCount) break;
    }
    if (i >= particleCount) break;
  }
  if (i >= particleCount) break;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({
  color: 0x44ccff,
  size: 1.5,
  transparent: true,
  opacity: 0.1
});
const points = new THREE.Points(geometry, material);
scene.add(points);

// Audio setup
let isPlaying = false;
let micMode = false;

const fft = new Tone.FFT(64);
const mic = new Tone.UserMedia();

const synth = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.1,
    release: 0.3
  }
}).connect(fft).toDestination();

const scales = [
  ['C4', 'D4', 'E4', 'G4', 'A4'],
  ['A3', 'C4', 'D4', 'E4', 'G4'],
  ['D4', 'E4', 'F#4', 'A4', 'B4'],
  ['E4', 'F4', 'G4', 'A4', 'C5']
];

let currentScaleIndex = 0;
let melody;
const noteDisplay = document.getElementById('noteDisplay');
const toggleBtn = document.getElementById('toggleBtn');
const micBtn = document.getElementById('micBtn');

toggleBtn.addEventListener('click', async () => {
  if (!isPlaying) {
    await Tone.start();
    Tone.Transport.start();

    melody = new Tone.Loop(time => {
      const currentScale = scales[currentScaleIndex];
      const note = currentScale[Math.floor(Math.random() * currentScale.length)];
      synth.triggerAttackRelease(note, '8n', time);
      Tone.Draw.schedule(() => {
        noteDisplay.textContent = note;
      }, time);
    }, '8n').start(0);

    Tone.Transport.scheduleRepeat(() => {
      currentScaleIndex = (currentScaleIndex + 1) % scales.length;
    }, '2m');

    isPlaying = true;
    micMode = false;
    toggleBtn.textContent = 'Pause';
    micBtn.textContent = 'Enable Mic Mode';
    targetOpacity = 1;
  } else {
    Tone.Transport.stop();
    melody.stop();
    isPlaying = false;
    toggleBtn.textContent = 'Play';
    targetOpacity = 0.1;
  }
});

micBtn.addEventListener('click', async () => {
  if (!micMode) {
    await Tone.start();
    await mic.open();
    mic.connect(fft);
    micMode = true;
    micBtn.textContent = 'Disable Mic Mode';

    if (isPlaying) {
      Tone.Transport.stop();
      melody.stop();
      isPlaying = false;
      toggleBtn.textContent = 'Play';
    }

    targetOpacity = 1;
  } else {
    mic.disconnect();
    mic.close();
    micMode = false;
    micBtn.textContent = 'Enable Mic Mode';
    targetOpacity = 0.1;
  }
});

// Animate
function animate() {
  requestAnimationFrame(animate);

  material.opacity += (targetOpacity - material.opacity) * 0.05;

  const pos = geometry.attributes.position.array;
  if (!isPlaying && !micMode) {
    for (let i = 0; i < particleCount * 3; i++) {
      pos[i] += (initialPositions[i] - pos[i]) * 0.05;
    }
  } else {
    const values = fft.getValue();
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const x = initialPositions[i3 + 0];
      const y = initialPositions[i3 + 1];
      const z = initialPositions[i3 + 2];
      const energy = values[i % values.length];
      const wave = Math.sin(Date.now() * 0.002 + x * 0.05 + y * 0.05) * (energy + 140) * 0.05;

      pos[i3 + 0] = x;
      pos[i3 + 1] = y + wave;
      pos[i3 + 2] = z;
    }
  }

  geometry.attributes.position.needsUpdate = true;
  points.rotation.y += 0.002;
  controls.update();
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
