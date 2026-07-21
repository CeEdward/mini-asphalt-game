// ============================================
// Asphalt Racer 3D — Full Edition
// ============================================

const CONFIG = {
    laneWidth: 3.5,
    roadWidth: 12,
    segmentLength: 10,
    segmentCount: 20,
    maxSpeed: 160,
    acceleration: 70,
    braking: 110,
    turnSpeed: 3.5,
    friction: 0.96,
    offRoadFriction: 0.82,
    nitroMultiplier: 1.8,
    sceneryCount: 30,
    cloudCount: 8,
    obstacleSpawnRate: 0.012,
    coinSpawnRate: 0.025,
    aiCount: 2
};

const state = {
    screen: 'menu',
    speed: 0,
    score: 0,
    coins: 0,
    distance: 0,
    nitro: 100,
    gameOver: false,
    steering: 0,
    targetSteering: 0,
    accelerating: false,
    braking: false,
    nitroActive: false,
    drift: 0,
    collisionTimer: 0,
    difficulty: 1,
    selectedCar: 'sport',
    selectedTrack: 'day',
    highScore: parseInt(localStorage.getItem('ar_highscore') || '0')
};

let scene, camera, renderer, shadowLight;
let car, carBody, wheels = [];
let roadSegments = [], sceneryItems = [], clouds = [];
let obstacles = [], coins = [], aiCars = [];
let clock, audioMgr, particleSystem;

// ============================================
// UTILS
// ============================================

function haptic(type = 'light') {
    if (!navigator.vibrate) return;
    const p = { light: 15, medium: 30, heavy: 50, coin: [10, 20, 10], crash: [50, 30, 80] };
    navigator.vibrate(p[type] || 20);
}

function createAsphaltTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#454545' : '#353535';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 512, Math.random() * 512);
        ctx.lineTo(Math.random() * 512, Math.random() * 512);
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4);
    tex.anisotropy = 4;
    return tex;
}

function createSandTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#C2B280';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 10000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#d4c494' : '#b0a070';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
}

function createCarTexture(hex) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    const num = parseInt(hex.replace('#', ''), 16);
    const R = (num >> 16) & 255, G = (num >> 8) & 255, B = num & 255;
    const grd = ctx.createLinearGradient(0, 0, 128, 128);
    grd.addColorStop(0, `rgb(${Math.min(255,R+60)},${Math.min(255,G+60)},${Math.min(255,B+60)})`);
    grd.addColorStop(0.5, hex);
    grd.addColorStop(1, `rgb(${Math.max(0,R-60)},${Math.max(0,G-60)},${Math.max(0,B-60)})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(10, 10, 108, 35);
    return new THREE.CanvasTexture(c);
}

// ============================================
// AUDIO
// ============================================

class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.engineNode = null;
        this.engineGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.35;
        this.masterGain.connect(this.ctx.destination);
        this.initEngine();
        this.initMusic();
        this.initialized = true;
    }

    initEngine() {
        this.engineNode = this.ctx.createOscillator();
        this.engineNode.type = 'sawtooth';
        this.engineNode.frequency.value = 60;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        this.engineNode.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);
        this.engineNode.start();
    }

    initMusic() {
        const notes = [130.81, 164.81, 196.00, 261.63, 196.00, 164.81];
        let i = 0;
        const play = () => {
            if (state.screen !== 'game') { setTimeout(play, 400); return; }
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = notes[i % notes.length];
            g.gain.setValueAtTime(0.06, this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
            osc.connect(g);
            g.connect(this.masterGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.35);
            i++;
            setTimeout(play, 280);
        };
        play();
    }

    setEngine(speed) {
        if (!this.initialized) return;
        this.engineNode.frequency.setTargetAtTime(60 + speed * 1.8, this.ctx.currentTime, 0.1);
        const vol = speed > 1 ? 0.06 + (speed / CONFIG.maxSpeed) * 0.1 : 0;
        this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
    }

    playCoin() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.1);
        g.gain.setValueAtTime(0.12, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
    }

    playCrash() {
        if (!this.initialized) return;
        const bs = this.ctx.sampleRate * 0.25;
        const buf = this.ctx.createBuffer(1, bs, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bs; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bs);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.value = 0.25;
        src.connect(g);
        g.connect(this.masterGain);
        src.start();
    }

    playNitro() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.25);
        g.gain.setValueAtTime(0.08, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.25);
    }
}

// ============================================
// PARTICLES
// ============================================

class ParticleSystem {
    constructor() {
        this.maxCount = 300;
        this.particles = [];
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.maxCount * 3);
        this.colors = new Float32Array(this.maxCount * 3);
        this.sizes = new Float32Array(this.maxCount);
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
        this.material = new THREE.PointsMaterial({
            size: 0.3, vertexColors: true, transparent: true,
            opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending
        });
        this.mesh = new THREE.Points(this.geometry, this.material);
        scene.add(this.mesh);
    }

    emit(pos, color, count = 1, speed = 5, life = 0.5, size = 0.3) {
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxCount) this.particles.shift();
            this.particles.push({
                x: pos.x + (Math.random() - 0.5) * 0.5, y: pos.y, z: pos.z + (Math.random() - 0.5) * 0.5,
                vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed * 0.5, vz: (Math.random() - 0.5) * speed,
                life: life, maxLife: life, r: color.r, g: color.g, b: color.b, size: size
            });
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            p.vy -= 9.8 * dt;
            p.life -= dt;
            if (p.life <= 0 || p.y < 0) this.particles.splice(i, 1);
        }
        const pos = this.geometry.attributes.position.array;
        const col = this.geometry.attributes.color.array;
        const siz = this.geometry.attributes.size.array;
        for (let i = 0; i < this.maxCount; i++) {
            if (i < this.particles.length) {
                const p = this.particles[i];
                pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
                const a = p.life / p.maxLife;
                col[i * 3] = p.r * a; col[i * 3 + 1] = p.g * a; col[i * 3 + 2] = p.b * a;
                siz[i] = p.size;
            } else {
                pos[i * 3] = 0; pos[i * 3 + 1] = -1000; pos[i * 3 + 2] = 0; siz[i] = 0;
            }
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
    }
}

// ============================================
// GAME
// ============================================

class Game {
    constructor() {
        this.nitroFlames = [];
    }

    init() {
        const container = document.getElementById('game-container');
        scene = new THREE.Scene();
        this.setTrackEnvironment();

        camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);

        renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambient);

        shadowLight = new THREE.DirectionalLight(0xffffff, 0.9);
        shadowLight.position.set(20, 40, 20);
        shadowLight.castShadow = true;
        shadowLight.shadow.mapSize.width = 1024;
        shadowLight.shadow.mapSize.height = 1024;
        shadowLight.shadow.camera.near = 0.5;
        shadowLight.shadow.camera.far = 150;
        shadowLight.shadow.camera.left = -30;
        shadowLight.shadow.camera.right = 30;
        shadowLight.shadow.camera.top = 30;
        shadowLight.shadow.camera.bottom = -30;
        scene.add(shadowLight);

        audioMgr = new AudioManager();
        particleSystem = new ParticleSystem();

        this.createCar();
        this.createRoad();
        this.createScenery();
        this.createClouds();

        window.addEventListener('resize', () => this.onResize());
        this.setupControls();
        this.setupMenu();

        clock = new THREE.Clock();
        this.animate();
    }

    setTrackEnvironment() {
        if (state.selectedTrack === 'desert') {
            scene.background = new THREE.Color(0xE8C898);
            scene.fog = new THREE.Fog(0xE8C898, 40, 150);
        } else {
            scene.background = new THREE.Color(0x87CEEB);
            scene.fog = new THREE.Fog(0x87CEEB, 40, 150);
        }
    }

    createCar() {
        if (car) scene.remove(car);
        car = new THREE.Group();
        wheels = [];
        this.nitroFlames = [];

        const carColors = { sport: '#DD0000', super: '#FFCC00', jeep: '#0044DD' };
        const carColor = carColors[state.selectedCar] || '#DD0000';
        const settings = {
            sport: { w: 2.2, h: 0.7, l: 4.2, ch: 0.6, wr: 0.35 },
            super: { w: 2.4, h: 0.6, l: 4.5, ch: 0.5, wr: 0.38 },
            jeep: { w: 2.6, h: 1.0, l: 4.8, ch: 0.9, wr: 0.45 }
        };
        const s = settings[state.selectedCar] || settings.sport;

        const bodyTex = createCarTexture(carColor);
        const bodyGeom = new THREE.BoxGeometry(s.w, s.h, s.l);
        const bodyMat = new THREE.MeshStandardMaterial({ map: bodyTex, roughness: 0.3, metalness: 0.6 });
        carBody = new THREE.Mesh(bodyGeom, bodyMat);
        carBody.position.y = s.h / 2 + s.wr;
        carBody.castShadow = true;
        car.add(carBody);

        const cabinGeom = new THREE.BoxGeometry(s.w * 0.8, s.ch, s.l * 0.55);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.2, metalness: 0.8 });
        const cabin = new THREE.Mesh(cabinGeom, cabinMat);
        cabin.position.set(0, carBody.position.y + s.h / 2 + s.ch / 2, -s.l * 0.1);
        cabin.castShadow = true;
        car.add(cabin);

        const wheelGeom = new THREE.CylinderGeometry(s.wr, s.wr, 0.25, 12);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const wPos = [
            [-s.w / 2 - 0.1, s.wr, s.l * 0.3],
            [s.w / 2 + 0.1, s.wr, s.l * 0.3],
            [-s.w / 2 - 0.1, s.wr, -s.l * 0.3],
            [s.w / 2 + 0.1, s.wr, -s.l * 0.3]
        ];
        wPos.forEach(p => {
            const w = new THREE.Mesh(wheelGeom, wheelMat);
            w.rotation.z = Math.PI / 2;
            w.position.set(...p);
            w.castShadow = true;
            car.add(w);
            wheels.push(w);
        });

        const lightGeom = new THREE.BoxGeometry(0.4, 0.2, 0.1);
        const headMat = new THREE.MeshBasicMaterial({ color: 0xFFFFAA });
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
        [-0.7, 0.7].forEach(x => {
            const h = new THREE.Mesh(lightGeom, headMat);
            h.position.set(x, carBody.position.y + 0.1, s.l / 2 + 0.05);
            car.add(h);
            const t = new THREE.Mesh(lightGeom, tailMat);
            t.position.set(x, carBody.position.y + 0.2, -s.l / 2 - 0.05);
            car.add(t);
        });

        // Nitro flames
        [-0.5, 0.5].forEach(x => {
            const fg = new THREE.ConeGeometry(0.15, 0.6, 6);
            const fm = new THREE.MeshBasicMaterial({ color: 0xFF6600, transparent: true, opacity: 0 });
            const f = new THREE.Mesh(fg, fm);
            f.rotation.x = Math.PI / 2;
            f.position.set(x, carBody.position.y, -s.l / 2 - 0.3);
            car.add(f);
            this.nitroFlames.push(f);
        });

        car.position.set(0, 0, 0);
        scene.add(car);
    }

    createRoad() {
        roadSegments.forEach(s => scene.remove(s));
        roadSegments = [];
        const isDesert = state.selectedTrack === 'desert';
        const roadTex = isDesert ? createSandTexture() : createAsphaltTexture();
        const grassColor = isDesert ? 0xE8DCC0 : 0x2d8a2d;

        for (let i = 0; i < CONFIG.segmentCount; i++) {
            const g = new THREE.Group();
            const rg = new THREE.PlaneGeometry(CONFIG.roadWidth, CONFIG.segmentLength);
            const rm = new THREE.MeshStandardMaterial({ map: roadTex, color: 0xffffff, roughness: 0.9 });
            const road = new THREE.Mesh(rg, rm);
            road.rotation.x = -Math.PI / 2;
            road.receiveShadow = true;
            g.add(road);

            if (!isDesert) {
                const lg = new THREE.PlaneGeometry(0.15, CONFIG.segmentLength / 2);
                const lm = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
                [-1, 1].forEach(side => {
                    const line = new THREE.Mesh(lg, lm);
                    line.rotation.x = -Math.PI / 2;
                    line.position.set(0, 0.02, side * CONFIG.segmentLength / 4);
                    g.add(line);
                });
            }

            const slg = new THREE.PlaneGeometry(0.3, CONFIG.segmentLength);
            const slm = new THREE.MeshBasicMaterial({ color: isDesert ? 0xFFFFFF : 0xFFCC00 });
            [-1, 1].forEach(side => {
                const sl = new THREE.Mesh(slg, slm);
                sl.rotation.x = -Math.PI / 2;
                sl.position.set(side * CONFIG.roadWidth / 2, 0.02, 0);
                g.add(sl);
            });

            const gg = new THREE.PlaneGeometry(60, CONFIG.segmentLength);
            const gm = new THREE.MeshLambertMaterial({ color: grassColor });
            const ground = new THREE.Mesh(gg, gm);
            ground.rotation.x = -Math.PI / 2;
            ground.position.y = -0.05;
            ground.receiveShadow = true;
            g.add(ground);

            g.position.z = i * CONFIG.segmentLength - 20;
            roadSegments.push(g);
            scene.add(g);
        }
    }

    createScenery() {
        sceneryItems.forEach(s => scene.remove(s));
        sceneryItems = [];
        const isDesert = state.selectedTrack === 'desert';

        for (let i = 0; i < CONFIG.sceneryCount; i++) {
            const g = new THREE.Group();
            if (isDesert) {
                if (Math.random() > 0.5) {
                    const geom = new THREE.CylinderGeometry(0.3, 0.4, 1.5 + Math.random(), 6);
                    const mat = new THREE.MeshLambertMaterial({ color: 0x2d5a27 });
                    const m = new THREE.Mesh(geom, mat);
                    m.position.y = 0.75;
                    g.add(m);
                    if (Math.random() > 0.5) {
                        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.8, 6), mat);
                        arm.rotation.z = Math.PI / 2;
                        arm.position.set(0.4, 1.0, 0);
                        g.add(arm);
                    }
                } else {
                    const geom = new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.5);
                    const mat = new THREE.MeshLambertMaterial({ color: 0x998877 });
                    const m = new THREE.Mesh(geom, mat);
                    m.position.y = 0.5;
                    g.add(m);
                }
            } else {
                const trunk = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.2, 0.3, 1.5, 5),
                    new THREE.MeshLambertMaterial({ color: 0x8B4513 })
                );
                trunk.position.y = 0.75;
                g.add(trunk);
                const leaves = new THREE.Mesh(
                    new THREE.ConeGeometry(1.2, 2.5, 6),
                    new THREE.MeshLambertMaterial({ color: 0x228B22 })
                );
                leaves.position.y = 2.25;
                g.add(leaves);
            }
            this.resetSceneryItem(g, true);
            g.traverse(c => { if (c.isMesh) c.castShadow = true; });
            sceneryItems.push(g);
            scene.add(g);
        }
    }

    createClouds() {
        clouds.forEach(c => scene.remove(c));
        clouds = [];
        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
        for (let i = 0; i < CONFIG.cloudCount; i++) {
            const g = new THREE.Group();
            const parts = 3 + Math.floor(Math.random() * 3);
            for (let j = 0; j < parts; j++) {
                const m = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 3, 7, 7), mat);
                m.position.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3);
                g.add(m);
            }
            g.position.set((Math.random() - 0.5) * 200, 25 + Math.random() * 15, Math.random() * 200 - 50);
            clouds.push(g);
            scene.add(g);
        }
    }

    resetSceneryItem(item, initial = false) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = 8 + Math.random() * 25;
        item.position.x = side * dist;
        item.position.z = initial ? Math.random() * 200 : 200 + Math.random() * 50;
        item.position.y = 0;
        const s = 0.7 + Math.random() * 0.6;
        item.scale.set(s, s, s);
    }

    spawnCoin() {
        if (Math.random() > CONFIG.coinSpawnRate) return;
        const geom = new THREE.TorusGeometry(0.4, 0.08, 6, 12);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xFFD700, metalness: 0.8, roughness: 0.2,
            emissive: 0xAA8800, emissiveIntensity: 0.3
        });
        const coin = new THREE.Mesh(geom, mat);
        const lane = Math.floor(Math.random() * 3) - 1;
        coin.position.set(lane * CONFIG.laneWidth, 0.6, 150);
        coin.castShadow = true;
        coins.push(coin);
        scene.add(coin);
    }

    spawnObstacle() {
        const rate = CONFIG.obstacleSpawnRate * state.difficulty;
        if (Math.random() > rate || obstacles.length > 6) return;
        const types = ['car', 'barrier', 'puddle'];
        const type = types[Math.floor(Math.random() * types.length)];
        let obs;
        if (type === 'car') {
            obs = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(2, 1.2, 4),
                new THREE.MeshLambertMaterial({ color: [0x4444FF, 0x888888, 0xFF6600][Math.floor(Math.random() * 3)] })
            );
            body.position.y = 0.7;
            body.castShadow = true;
            obs.add(body);
        } else if (type === 'barrier') {
            obs = new THREE.Mesh(new THREE.BoxGeometry(3, 1.0, 0.5), new THREE.MeshLambertMaterial({ color: 0xFFAA00 }));
            obs.position.y = 0.5;
            obs.castShadow = true;
        } else {
            obs = new THREE.Mesh(new THREE.CircleGeometry(1.5, 12), new THREE.MeshLambertMaterial({ color: 0x2244AA, transparent: true, opacity: 0.7 }));
            obs.rotation.x = -Math.PI / 2;
            obs.position.y = 0.03;
        }
        const lane = Math.floor(Math.random() * 3) - 1;
        obs.position.x = lane * CONFIG.laneWidth;
        obs.position.z = 150 + Math.random() * 30;
        obs.userData = { type };
        obstacles.push(obs);
        scene.add(obs);
    }

    spawnAI() {
        if (aiCars.length >= CONFIG.aiCount || Math.random() > 0.005) return;
        const g = new THREE.Group();
        const colors = [0x00AAFF, 0xFF44AA, 0x44FF44];
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(2.2, 0.8, 4.2),
            new THREE.MeshLambertMaterial({ color: colors[Math.floor(Math.random() * colors.length)] })
        );
        body.position.y = 0.6;
        body.castShadow = true;
        g.add(body);
        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.6, 2.2),
            new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        cabin.position.set(0, 1.3, -0.3);
        g.add(cabin);

        const lane = Math.floor(Math.random() * 3) - 1;
        g.position.set(lane * CONFIG.laneWidth, 0, 120 + Math.random() * 40);
        g.userData = { speed: 40 + Math.random() * 40, lane: lane, changeTimer: 0 };
        aiCars.push(g);
        scene.add(g);
    }

    setupControls() {
        const buttons = {
            'btn-left': { start: () => state.targetSteering = -1, end: () => state.targetSteering = 0 },
            'btn-right': { start: () => state.targetSteering = 1, end: () => state.targetSteering = 0 },
            'btn-gas': { start: () => state.accelerating = true, end: () => state.accelerating = false },
            'btn-brake': { start: () => state.braking = true, end: () => state.braking = false },
            'btn-nitro': { start: () => this.activateNitro(), end: () => this.deactivateNitro() }
        };

        for (const [id, handlers] of Object.entries(buttons)) {
            const btn = document.getElementById(id);
            if (!btn) continue;
            const onStart = (e) => { e.preventDefault(); handlers.start(); btn.classList.add('active'); };
            const onEnd = (e) => { e.preventDefault(); handlers.end(); btn.classList.remove('active'); };
            btn.addEventListener('touchstart', onStart);
            btn.addEventListener('touchend', onEnd);
            btn.addEventListener('touchcancel', onEnd);
            btn.addEventListener('mousedown', onStart);
            btn.addEventListener('mouseup', onEnd);
            btn.addEventListener('mouseleave', onEnd);
        }

        document.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            switch (e.key) {
                case 'ArrowLeft': case 'a': state.targetSteering = -1; break;
                case 'ArrowRight': case 'd': state.targetSteering = 1; break;
                case 'ArrowUp': case 'w': state.accelerating = true; break;
                case 'ArrowDown': case 's': state.braking = true; break;
                case 'Shift': case ' ': this.activateNitro(); break;
                case 'Escape': this.togglePause(); break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch (e.key) {
                case 'ArrowLeft': case 'a': state.targetSteering = 0; break;
                case 'ArrowRight': case 'd': state.targetSteering = 0; break;
                case 'ArrowUp': case 'w': state.accelerating = false; break;
                case 'ArrowDown': case 's': state.braking = false; break;
                case 'Shift': case ' ': this.deactivateNitro(); break;
            }
        });
    }

    activateNitro() {
        if (state.nitro > 10 && !state.nitroActive && state.screen === 'game') {
            state.nitroActive = true;
            audioMgr.playNitro();
            haptic('heavy');
        }
    }

    deactivateNitro() {
        state.nitroActive = false;
    }

    setupMenu() {
        document.querySelectorAll('.car-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.car-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                state.selectedCar = btn.dataset.car;
                haptic('light');
            });
        });

        document.querySelectorAll('.track-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.track-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                state.selectedTrack = btn.dataset.track;
                haptic('light');
            });
        });

        document.getElementById('btn-start').addEventListener('click', () => {
            audioMgr.init();
            this.startGame();
        });

        document.getElementById('btn-restart').addEventListener('click', () => {
            this.resetGame();
            this.startGame();
        });

        document.getElementById('btn-menu').addEventListener('click', () => {
            this.showScreen('menu');
        });

        document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());

        document.getElementById('menu-highscore').textContent = state.highScore;
    }

    showScreen(name) {
        state.screen = name;
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        if (name === 'menu') document.getElementById('menu-screen').classList.remove('hidden');
        if (name === 'gameover') document.getElementById('gameover-screen').classList.remove('hidden');
    }

    startGame() {
        this.resetGame();
        state.screen = 'game';
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('controls').classList.remove('hidden');
        document.getElementById('btn-pause').classList.remove('hidden');
    }

    resetGame() {
        state.speed = 0; state.score = 0; state.coins = 0; state.distance = 0;
        state.nitro = 100; state.gameOver = false; state.steering = 0; state.targetSteering = 0;
        state.accelerating = false; state.braking = false; state.nitroActive = false;
        state.drift = 0; state.collisionTimer = 0; state.difficulty = 1;

        obstacles.forEach(o => scene.remove(o)); obstacles = [];
        coins.forEach(c => scene.remove(c)); coins = [];
        aiCars.forEach(a => scene.remove(a)); aiCars = [];

        this.setTrackEnvironment();
        this.createCar();
        this.createRoad();
        this.createScenery();
        this.createClouds();
        car.position.set(0, 0, 0);
        car.rotation.set(0, 0, 0);
    }

    togglePause() {
        if (state.screen === 'game') {
            state.screen = 'paused';
            document.getElementById('pause-overlay').classList.remove('hidden');
        } else if (state.screen === 'paused') {
            state.screen = 'game';
            document.getElementById('pause-overlay').classList.add('hidden');
            clock.getDelta();
        }
    }

    gameOver() {
        state.gameOver = true;
        state.screen = 'gameover';
        if (state.score > state.highScore) {
            state.highScore = state.score;
            localStorage.setItem('ar_highscore', state.highScore);
        }
        document.getElementById('final-score').textContent = state.score;
        document.getElementById('final-coins').textContent = state.coins;
        document.getElementById('final-highscore').textContent = state.highScore;
        document.getElementById('gameover-screen').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('controls').classList.add('hidden');
        document.getElementById('btn-pause').classList.add('hidden');
    }

    // ============================================
    // UPDATE LOOP
    // ============================================

    update(dt) {
        if (state.screen !== 'game') {
            audioMgr.setEngine(0);
            return;
        }
        this.updatePhysics(dt);
        this.updateRoad(dt);
        this.updateScenery(dt);
        this.updateClouds(dt);
        this.updateCoins(dt);
        this.updateObstacles(dt);
        this.updateAI(dt);
        particleSystem.update(dt);
        this.updateNitroFlames(dt);
        this.updateDriftFX(dt);
        this.updateCamera();
        audioMgr.setEngine(state.speed);
        state.difficulty = 1 + state.score / 3000;
        this.updateHUD();
    }

    updatePhysics(dt) {
        state.steering += (state.targetSteering - state.steering) * 10 * dt;

        let maxSpd = CONFIG.maxSpeed;
        let accel = CONFIG.acceleration;

        if (state.nitroActive && state.nitro > 0) {
            maxSpd *= CONFIG.nitroMultiplier;
            accel *= 1.5;
            state.nitro -= 30 * dt;
            if (state.nitro <= 0) { state.nitro = 0; this.deactivateNitro(); }
        } else if (!state.nitroActive && state.nitro < 100) {
            state.nitro += 5 * dt;
        }

        if (state.accelerating) state.speed += accel * dt;
        else if (state.braking) state.speed -= CONFIG.braking * dt;
        else state.speed *= CONFIG.friction;

        const roadHalf = CONFIG.roadWidth / 2 - 1;
        const offRoad = Math.abs(car.position.x) > roadHalf;
        if (offRoad) state.speed *= CONFIG.offRoadFriction;

        let inPuddle = false;
        obstacles.forEach(obs => {
            if (obs.userData.type === 'puddle') {
                const dx = Math.abs(obs.position.x - car.position.x);
                const dz = Math.abs(obs.position.z - car.position.z);
                if (dx < 2 && dz < 2) inPuddle = true;
            }
        });
        if (inPuddle) { state.speed *= 0.98; state.steering *= 0.5; }

        state.speed = Math.max(0, Math.min(state.speed, maxSpd));

        if (state.speed > 1) {
            const sf = state.speed / CONFIG.maxSpeed;
            car.position.x += state.steering * CONFIG.turnSpeed * dt * (0.5 + 0.5 * sf);
        }

        const isDrifting = Math.abs(state.steering) > 0.5 && state.speed > 60 && (state.braking || offRoad);
        state.drift = isDrifting ? Math.min(state.drift + dt * 2, 1) : Math.max(state.drift - dt * 3, 0);

        car.rotation.z = -state.steering * 0.1 * Math.min(state.speed / 60, 1) - state.drift * state.steering * 0.15;
        car.rotation.y = -state.steering * 0.04 * Math.min(state.speed / 60, 1);
        car.rotation.x = state.drift * 0.05;

        wheels.forEach(w => { w.rotation.x += state.speed * dt * 0.5; });

        if (state.collisionTimer > 0) {
            state.collisionTimer -= dt;
            if (carBody) {
                const flash = Math.sin(state.collisionTimer * 20) > 0;
                carBody.material.emissive.setHex(flash ? 0xFF0000 : 0x000000);
            }
        } else {
            if (carBody) carBody.material.emissive.setHex(0x000000);
        }

        state.distance += state.speed * dt;
        state.score = Math.floor(state.distance / 10) + state.coins * 10;

        if (car.position.x > 35 || car.position.x < -35) this.gameOver();
    }

    updateDriftFX(dt) {
        if (state.drift > 0.3 && state.speed > 40) {
            const side = state.steering > 0 ? -1 : 1;
            particleSystem.emit(
                { x: car.position.x + side * 1.0, y: 0.2, z: car.position.z + 1.5 },
                { r: 0.8, g: 0.8, b: 0.8 }, 2, 2, 0.4, 0.4
            );
        }
    }

    updateNitroFlames(dt) {
        if (state.nitroActive) {
            this.nitroFlames.forEach(f => {
                f.scale.y = 1 + Math.random() * 0.5;
                f.material.opacity = 0.7 + Math.random() * 0.3;
            });
            [-0.5, 0.5].forEach(x => {
                particleSystem.emit(
                    { x: car.position.x + x, y: 0.5, z: car.position.z - 2.5 },
                    { r: 1, g: 0.4, b: 0 }, 3, 8, 0.3, 0.5
                );
            });
        } else {
            this.nitroFlames.forEach(f => f.material.opacity = 0);
        }
    }

    updateRoad(dt) {
        const md = state.speed * dt;
        let furthest = -9999;
        roadSegments.forEach(s => {
            s.position.z -= md;
            if (s.position.z > furthest) furthest = s.position.z;
        });
        roadSegments.forEach(s => {
            if (s.position.z < -CONFIG.segmentLength * 2) {
                s.position.z = furthest + CONFIG.segmentLength;
                furthest = s.position.z;
            }
        });
    }

    updateScenery(dt) {
        const md = state.speed * dt;
        sceneryItems.forEach(item => {
            item.position.z -= md;
            if (item.position.z < -60) this.resetSceneryItem(item);
        });
    }

    updateClouds(dt) {
        clouds.forEach(c => {
            c.position.z -= state.speed * dt * 0.08;
            if (c.position.z < -100) c.position.z = 200;
        });
    }

    updateCoins(dt) {
        const md = state.speed * dt;
        for (let i = coins.length - 1; i >= 0; i--) {
            const c = coins[i];
            c.position.z -= md;
            c.rotation.y += dt * 2;
            const dx = Math.abs(c.position.x - car.position.x);
            const dz = Math.abs(c.position.z - car.position.z);
            if (dx < 1.5 && dz < 2.5) {
                state.coins++;
                state.nitro = Math.min(100, state.nitro + 8);
                audioMgr.playCoin();
                haptic('coin');
                particleSystem.emit(
                    { x: c.position.x, y: c.position.y, z: c.position.z },
                    { r: 1, g: 0.9, b: 0.2 }, 8, 5, 0.5, 0.4
                );
                scene.remove(c);
                coins.splice(i, 1);
                continue;
            }
            if (c.position.z < -50) { scene.remove(c); coins.splice(i, 1); }
        }
        this.spawnCoin();
    }

    updateObstacles(dt) {
        const md = state.speed * dt;
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.position.z -= md;
            if (obs.userData.type !== 'puddle') {
                const dx = Math.abs(obs.position.x - car.position.x);
                const dz = Math.abs(obs.position.z - car.position.z);
                if (dx < 2.0 && dz < 3.5 && state.collisionTimer <= 0) this.handleCollision(obs);
            }
            if (obs.position.z < -50) { scene.remove(obs); obstacles.splice(i, 1); }
        }
        this.spawnObstacle();
    }

    updateAI(dt) {
        const md = state.speed * dt;
        for (let i = aiCars.length - 1; i >= 0; i--) {
            const ai = aiCars[i];
            const d = ai.userData;
            ai.position.z -= (d.speed - state.speed) * dt;
            d.changeTimer -= dt;
            if (d.changeTimer <= 0) {
                d.changeTimer = 3 + Math.random() * 5;
                d.lane = Math.floor(Math.random() * 3) - 1;
            }
            const tx = d.lane * CONFIG.laneWidth;
            ai.position.x += (tx - ai.position.x) * 2 * dt;

            const dx = Math.abs(ai.position.x - car.position.x);
            const dz = Math.abs(ai.position.z - car.position.z);
            if (dx < 2.2 && dz < 4 && state.collisionTimer <= 0) this.handleCollision(ai);

            if (ai.position.z < -60 || ai.position.z > 250) {
                scene.remove(ai);
                aiCars.splice(i, 1);
            }
        }
        this.spawnAI();
    }

    handleCollision(obj) {
        state.speed *= 0.25;
        state.collisionTimer = 0.6;
        state.score = Math.max(0, state.score - 50);
        audioMgr.playCrash();
        haptic('crash');
        particleSystem.emit(
            { x: car.position.x, y: 1, z: car.position.z },
            { r: 1, g: 0.8, b: 0.2 }, 15, 10, 0.6, 0.5
        );
    }

    updateCamera() {
        const sf = state.speed / CONFIG.maxSpeed;
        const tx = car.position.x * 0.3 + state.steering * 2;
        const ty = 4.5 + sf * 2;
        const tz = car.position.z - 10 - sf * 5;
        camera.position.x += (tx - camera.position.x) * 0.08;
        camera.position.y += (ty - camera.position.y) * 0.08;
        camera.position.z += (tz - camera.position.z) * 0.08;
        const lx = car.position.x * 0.2 + state.steering * 3;
        const lz = car.position.z + 20 + sf * 10;
        camera.lookAt(lx, 1, lz);
    }

    updateHUD() {
        document.getElementById('speed').textContent = Math.floor(state.speed);
        document.getElementById('score').textContent = state.score;
        document.getElementById('coins').textContent = state.coins;
        const bar = document.getElementById('nitro-bar');
        bar.style.width = state.nitro + '%';
        bar.style.background = state.nitroActive
            ? 'linear-gradient(90deg, #ff6600, #ffcc00)'
            : 'linear-gradient(90deg, #00ccff, #0088ff)';
    }

    onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = Math.min(clock.getDelta(), 0.05);
        this.update(dt);
        renderer.render(scene, camera);
    }
}

const game = new Game();
game.init();
