/**
 * Three.js 3D Visualizer Modules (Clean Engineering Aesthetic)
 * 1. Hero Holographic Energy Core
 * 2. Dashboard Dynamic Power Reactor
 */

window.EnergyVisualizer = (function() {
  let heroRenderer, heroScene, heroCamera, heroAnimId;
  let heroCoreMesh, heroRings = [], heroParticles;
  let heroMouseX = 0, heroMouseY = 0;

  let reactorRenderer, reactorScene, reactorCamera, reactorAnimId;
  let reactorCore, reactorOuterRing, reactorMiddleRing, reactorPlasmaParticles;
  let currentWatts = 450;

  /**
   * Initialize the Hero 3D Scene
   */
  function initHeroScene() {
    const canvas = document.getElementById('hero-3d-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    const width = canvas.clientWidth || 500;
    const height = canvas.clientHeight || 500;

    heroScene = new THREE.Scene();
    heroCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    heroCamera.position.set(0, 4, 24);
    heroCamera.lookAt(0, 0, 0);

    heroRenderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    heroRenderer.setSize(width, height);
    heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Refined studio lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    heroScene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    keyLight.position.set(10, 15, 12);
    heroScene.add(keyLight);

    const fillLight = new THREE.PointLight(0x6366f1, 1.0, 50);
    fillLight.position.set(-10, -8, -10);
    heroScene.add(fillLight);

    // Center Core (Precision Icosahedron)
    const coreGeo = new THREE.IcosahedronGeometry(3.5, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.35,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    heroCoreMesh = new THREE.Mesh(coreGeo, coreMat);
    heroScene.add(heroCoreMesh);

    // Inner Solid Node
    const innerGeo = new THREE.SphereGeometry(2.2, 32, 32);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2
    });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    heroCoreMesh.add(innerSphere);

    // Precision Orbital Rings
    const ringRadii = [6.2, 8.0, 9.8];
    const ringColors = [0x38bdf8, 0x10b981, 0x6366f1];
    
    ringRadii.forEach((rad, idx) => {
      const ringGeo = new THREE.TorusGeometry(rad, 0.05, 16, 120);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColors[idx],
        transparent: true,
        opacity: 0.65
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / (2.2 + idx * 0.35);
      ring.rotation.y = idx * 0.45;
      heroScene.add(ring);
      heroRings.push(ring);
    });

    // Particle Swarm (Clean Data Packets)
    const particleCount = 450;
    const particlesGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 4.8 + Math.random() * 7.0;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Clean white and sapphire hues
      colors[i * 3] = 0.7;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 1.0;
    }

    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particlesMat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.65
    });

    heroParticles = new THREE.Points(particlesGeo, particlesMat);
    heroScene.add(heroParticles);

    // Mouse Parallax
    window.addEventListener('mousemove', (e) => {
      heroMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      heroMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('resize', onHeroResize);
    animateHero();
  }

  function onHeroResize() {
    const canvas = document.getElementById('hero-3d-canvas');
    if (!canvas || !heroRenderer || !heroCamera) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    heroCamera.aspect = width / height;
    heroCamera.updateProjectionMatrix();
    heroRenderer.setSize(width, height);
  }

  function animateHero() {
    heroAnimId = requestAnimationFrame(animateHero);

    if (heroCoreMesh) {
      heroCoreMesh.rotation.y += 0.005;
      heroCoreMesh.rotation.x += 0.002;
    }

    heroRings.forEach((ring, idx) => {
      ring.rotation.z += 0.003 * (idx % 2 === 0 ? 1 : -1);
      ring.rotation.y += 0.002 * (idx + 1);
    });

    if (heroParticles) {
      heroParticles.rotation.y -= 0.002;
    }

    if (heroCamera) {
      heroCamera.position.x += (heroMouseX * 3 - heroCamera.position.x) * 0.04;
      heroCamera.position.y += (heroMouseY * 2 + 4 - heroCamera.position.y) * 0.04;
      heroCamera.lookAt(0, 0, 0);
    }

    heroRenderer.render(heroScene, heroCamera);
  }

  /**
   * Initialize Dashboard Reactor Core Scene
   */
  function initReactorScene() {
    const canvas = document.getElementById('reactor-3d-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    const width = canvas.clientWidth || 300;
    const height = canvas.clientHeight || 300;

    reactorScene = new THREE.Scene();
    reactorCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    reactorCamera.position.set(0, 0, 14);

    reactorRenderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    reactorRenderer.setSize(width, height);
    reactorRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Magnetic Core Geometry
    const coreGeo = new THREE.SphereGeometry(2.2, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: true
    });
    reactorCore = new THREE.Mesh(coreGeo, coreMat);
    reactorScene.add(reactorCore);

    // Inner Core Sphere
    const innerGeo = new THREE.IcosahedronGeometry(1.5, 2);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.5,
      roughness: 0.3
    });
    const innerPlasma = new THREE.Mesh(innerGeo, innerMat);
    reactorCore.add(innerPlasma);

    // Orbiting field rings
    const ring1Geo = new THREE.TorusGeometry(3.6, 0.04, 16, 90);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    reactorOuterRing = new THREE.Mesh(ring1Geo, ring1Mat);
    reactorOuterRing.rotation.x = Math.PI / 3;
    reactorScene.add(reactorOuterRing);

    const ring2Geo = new THREE.TorusGeometry(4.4, 0.04, 16, 90);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    reactorMiddleRing = new THREE.Mesh(ring2Geo, ring2Mat);
    reactorMiddleRing.rotation.y = Math.PI / 3;
    reactorScene.add(reactorMiddleRing);

    // Subtle Particle Ring
    const pCount = 140;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.4 + Math.random() * 2.2;
      pPos[i * 3] = Math.cos(angle) * radius;
      pPos[i * 3 + 1] = Math.sin(angle) * radius;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.1,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6
    });
    reactorPlasmaParticles = new THREE.Points(pGeo, pMat);
    reactorScene.add(reactorPlasmaParticles);

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    reactorScene.add(ambient);

    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(5, 5, 8);
    reactorScene.add(light);

    window.addEventListener('resize', onReactorResize);
    animateReactor();
  }

  function onReactorResize() {
    const canvas = document.getElementById('reactor-3d-canvas');
    if (!canvas || !reactorRenderer || !reactorCamera) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    reactorCamera.aspect = width / height;
    reactorCamera.updateProjectionMatrix();
    reactorRenderer.setSize(width, height);
  }

  function animateReactor() {
    reactorAnimId = requestAnimationFrame(animateReactor);

    const speedMultiplier = Math.min(Math.max(currentWatts / 500, 0.5), 5.0);
    const baseSpeed = 0.008 * speedMultiplier;

    if (reactorCore) {
      reactorCore.rotation.y += baseSpeed;
      reactorCore.rotation.x += baseSpeed * 0.4;
    }

    if (reactorOuterRing) {
      reactorOuterRing.rotation.z += baseSpeed * 0.7;
    }

    if (reactorMiddleRing) {
      reactorMiddleRing.rotation.y += baseSpeed * 0.8;
    }

    if (reactorPlasmaParticles) {
      reactorPlasmaParticles.rotation.z += baseSpeed * 1.0;
    }

    reactorRenderer.render(reactorScene, reactorCamera);
  }

  function updatePower(watts) {
    currentWatts = Number(watts) || 0;
  }

  return {
    initHeroScene,
    initReactorScene,
    updatePower,
    onHeroResize,
    onReactorResize
  };
})();
