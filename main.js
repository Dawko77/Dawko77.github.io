import * as THREE from 'three';

// --- Configuration ---
const STAR_COUNT = 15000;
const STAR_FIELD_RADIUS = 2000; // Spread of stars
const STAR_FIELD_LENGTH = 4000; // Depth of field
const INITIAL_SPEED = 20;
const MAX_SPEED = 100;
const MIN_SPEED = 0.5;

// --- State ---
let speed = INITIAL_SPEED;
let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;

// --- Setup ---
const scene = new THREE.Scene();
// Fog to hide star spawn/despawn
scene.fog = new THREE.FogExp2(0x000000, 0.0005);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.z = 1; // Start slightly forward

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// --- Star Field Generation ---
// We use a BufferGeometry for performance with thousands of points
const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(STAR_COUNT * 3);
const starColors = new Float32Array(STAR_COUNT * 3);
const starSizes = new Float32Array(STAR_COUNT);

const colorPalette = [
    new THREE.Color('#ffffff'), // White
    new THREE.Color('#aaddff'), // Blue-ish
    new THREE.Color('#ffddaa'), // Yellow-ish
    new THREE.Color('#ffaaaa'), // Red-ish tint
];

for (let i = 0; i < STAR_COUNT; i++) {
    const i3 = i * 3;
    // Random position in a cylinder/tunnel shape
    // X and Y are completely random within radius
    const x = (Math.random() - 0.5) * 2 * STAR_FIELD_RADIUS;
    const y = (Math.random() - 0.5) * 2 * STAR_FIELD_RADIUS;
    // Z is spread out deep into the screen
    const z = -Math.random() * STAR_FIELD_LENGTH;

    starPositions[i3] = x;
    starPositions[i3 + 1] = y;
    starPositions[i3 + 2] = z;

    // Color
    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    // Add slight variation
    starColors[i3] = color.r;
    starColors[i3 + 1] = color.g;
    starColors[i3 + 2] = color.b;
    
    // Size variation based on "distance" feel (though actual size is handled by material)
    starSizes[i] = Math.random() * 2;
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

// Custom Shader Material for better control over particle look and "motion blur" feel
// For now, we'll use PointsMaterial for simplicity and performance testing, 
// then upgrade to shader if needed for trails.
// Let's stick to PointsMaterial but use `sizeAttenuation: true` for parallax size effect.
const starMaterial = new THREE.PointsMaterial({
    size: 2,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true, // Key for depth perception
    blending: THREE.AdditiveBlending
});

const starField = new THREE.Points(starGeometry, starMaterial);
scene.add(starField);

// --- Event Listeners ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('mousemove', (event) => {
    // Normalize mouse position -1 to 1
    targetMouseX = (event.clientX / window.innerWidth) * 2 - 1;
    targetMouseY = -(event.clientY / window.innerHeight) * 2 + 1;
});

document.addEventListener('wheel', (event) => {
    // Scroll adjusts speed
    speed += event.deltaY * -0.05;
    speed = Math.max(MIN_SPEED, Math.min(speed, MAX_SPEED));
});

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    
    // Smooth mouse movement
    mouseX += (targetMouseX - mouseX) * 2 * delta;
    mouseY += (targetMouseY - mouseY) * 2 * delta;

    // Move stars
    // Instead of moving thousands of stars, we'll move the starfield object 
    // and reset stars that pass the camera.
    // Actually, modifying buffer positions is expensive every frame for JS.
    // A better shader approach would be ideal, but for "realistic motion parallax"
    // simply moving points by Z is classically effective if optimized.
    // Let's try the vertex shader approach or simply move the Z attribute.
    
    const positions = starGeometry.attributes.position.array;
    
    // Move Camera vs Move Stars?
    // Moving stars towards +Z (camera is at 0,0,1 looking at -Z)
    // Wait, typical setup: Camera at 0,0,0 looking -Z. Stars at negative Z.
    // Stars move +Z to pass camera.
    
    // Camera parallax steering
    camera.position.x += (mouseX * 50 - camera.position.x) * 0.05;
    camera.position.y += (mouseY * 50 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, -200); // Look slightly ahead
    // Steer angle
    camera.rotation.z = mouseX * 0.2; // Bank into the turn

    // Update Star Positions
    // For 15k stars, loop is okay in modern JS engines
    for (let i = 0; i < STAR_COUNT; i++) {
        const i3 = i * 3;
        
        // Move star towards camera (Positive Z)
        positions[i3 + 2] += speed;

        // Warp effect: stretch stars?
        // Simple trick: Just move them. Parallax is geometric.

        // Check if star passed camera
        if (positions[i3 + 2] > 100) {
            // Reset to far back
            positions[i3 + 2] = -STAR_FIELD_LENGTH;
            // Respawn X/Y for randomness
             positions[i3] = (Math.random() - 0.5) * 2 * STAR_FIELD_RADIUS;
             positions[i3 + 1] = (Math.random() - 0.5) * 2 * STAR_FIELD_RADIUS;
        }
    }
    
    starGeometry.attributes.position.needsUpdate = true; // IMPORTANT

    renderer.render(scene, camera);
}

animate();
