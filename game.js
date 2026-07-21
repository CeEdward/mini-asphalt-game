// ============================================
// Asphalt Racer 3D — iPhone Optimized Prototype
// ============================================

const CONFIG = {
    laneWidth: 3.5,
    roadWidth: 12,
    segmentLength: 10,
    segmentCount: 24,
    maxSpeed: 140,
    acceleration: 60,
    braking: 100,
    turnSpeed: 3.0,
    friction: 0.96,
    offRoadFriction: 0.85,
    sceneryCount: 40,
    obstacleSpawnRate: 0.015
};

const state = {
    speed: 0,
    score: 0,
    distance: 0,
    gameOver: false,
    steering: 0,
    targetSteering: 0,
    accelerating: false,
    braking: false,
    collisionTimer: 0,
    difficulty: 1
};

let scene, camera, renderer;
let car, carBody, roadSegments = [], obstacles = [], sceneryItems = [];
let clock;

// ============================================
// INIT
// ============================================

function init() {
    const container = document.getElementById('game-container');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 30, 120);

    // Camera
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);

    // Renderer — optimized for mobile
    renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    sunLight.position.set(20, 50, 20);
    scene.add(sunLight);

    // Objects
    createCar();
    createRoad();
    createScenery();

    // Events
    window.addEventListener('resize', onWindowResize);
    setupControls();

    // Start loop
    clock = new THREE.Clock();
    requestAnimationFrame(animate);
}

// ============================================
// CAR
// ============================================

function createCar() {
    car = new THREE.Group();

    // Main body — lower
    const bodyGeom = new THREE.BoxGeometry(2.2, 0.7, 4.2);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xDD0000 });
    carBody = new THREE.Mesh(bodyGeom, bodyMat);
    carBody.position.y = 0.6;
    car.add(carBody);

    // Upper body / cabin
    const cabinGeom = new THREE.BoxGeometry(1.8, 0.6, 2.2);
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0xAA0000 });
    const cabin = new THREE.Mesh(cabinGeom, cabinMat);
    cabin.position.set(0, 1.25, -0.3);
    car.add(cabin);

    // Windshield
    const windGeom = new THREE.BoxGeometry(1.6, 0.5, 0.1);
    const windMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const windshield = new THREE.Mesh(windGeom, windMat);
    windshield.position.set(0, 1.3, 0.81);
    windshield.rotation.x = -0.2;
    car.add(windshield);

    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 8);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

    const wheelPositions = [
        [-1.2, 0.35, 1.3],
        [1.2, 0.35, 1.3],
        [-1.2, 0.35, -1.3],
        [1.2, 0.35, -1.3]
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeom, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(...pos);
        car.add(wheel);
    });

    // Headlights
    const lightGeom = new THREE.BoxGeometry(0.4, 0.2, 0.1);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xFFFFAA });

    const leftLight = new THREE.Mesh(lightGeom, lightMat);
    leftLight.position.set(-0.7, 0.7, 2.1);
    car.add(leftLight);

    const rightLight = new THREE.Mesh(lightGeom, lightMat);
    rightLight.position.set(0.7, 0.7, 2.1);
    car.add(rightLight);

    // Taillights
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });

    const leftTail = new THREE.Mesh(lightGeom, tailMat);
    leftTail.position.set(-0.7, 0.8, -2.1);
    car.add(leftTail);

    const rightTail = new THREE.Mesh(lightGeom, tailMat);
    rightTail.position.set(0.7, 0.8, -2.1);
    car.add(rightTail);

    car.position.set(0, 0, 0);
    scene.add(car);
}

// ============================================
// ROAD
// ============================================

function createRoad() {
    for (let i = 0; i < CONFIG.segmentCount; i++) {
        const segment = createRoadSegment();
        segment.position.z = i * CONFIG.segmentLength - 20;
        roadSegments.push(segment);
        scene.add(segment);
    }
}

function createRoadSegment() {
    const group = new THREE.Group();

    // Asphalt
    const roadGeom = new THREE.PlaneGeometry(CONFIG.roadWidth, CONFIG.segmentLength);
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const road = new THREE.Mesh(roadGeom, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    group.add(road);

    // Center dashed line
    const lineGeom = new THREE.PlaneGeometry(0.15, CONFIG.segmentLength / 2);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

    const line1 = new THREE.Mesh(lineGeom, lineMat);
    line1.rotation.x = -Math.PI / 2;
    line1.position.y = 0.02;
    line1.position.z = CONFIG.segmentLength / 4;
    group.add(line1);

    const line2 = new THREE.Mesh(lineGeom, lineMat);
    line2.rotation.x = -Math.PI / 2;
    line2.position.y = 0.02;
    line2.position.z = -CONFIG.segmentLength / 4;
    group.add(line2);

    // Side lines
    const sideLineGeom = new THREE.PlaneGeometry(0.2, CONFIG.segmentLength);
    const sideLineMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

    const leftLine = new THREE.Mesh(sideLineGeom, sideLineMat);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-CONFIG.roadWidth / 2, 0.02, 0);
    group.add(leftLine);

    const rightLine = new THREE.Mesh(sideLineGeom, sideLineMat);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(CONFIG.roadWidth / 2, 0.02, 0);
    group.add(rightLine);

    // Grass sides
    const grassGeom = new THREE.PlaneGeometry(30, CONFIG.segmentLength);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x2d8a2d });

    const leftGrass = new THREE.Mesh(grassGeom, grassMat);
    leftGrass.rotation.x = -Math.PI / 2;
    leftGrass.position.set(-CONFIG.roadWidth / 2 - 15, -0.01, 0);
    group.add(leftGrass);

    const rightGrass = new THREE.Mesh(grassGeom, grassMat);
    rightGrass.rotation.x = -Math.PI / 2;
    rightGrass.position.set(CONFIG.roadWidth / 2 + 15, -0.01, 0);
    group.add(rightGrass);

    return group;
}

// ============================================
// SCENERY
// ============================================

function createScenery() {
    for (let i = 0; i < CONFIG.sceneryCount; i++) {
        const item = createTree();
        resetSceneryItem(item, true);
        sceneryItems.push(item);
        scene.add(item);
    }
}

function createTree() {
    const group = new THREE.Group();

    // Trunk
    const trunkGeom = new THREE.CylinderGeometry(0.25, 0.35, 1.5, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 0.75;
    group.add(trunk);

    // Leaves — low poly cone
    const leavesGeom = new THREE.ConeGeometry(1.5, 3, 6);
    const leavesMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const leaves = new THREE.Mesh(leavesGeom, leavesMat);
    leaves.position.y = 2.5;
    group.add(leaves);

    return group;
}

function resetSceneryItem(item, initial = false) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const distFromRoad = 8 + Math.random() * 25;
    item.position.x = side * distFromRoad;
    item.position.z = initial ? Math.random() * 200 : 200 + Math.random() * 50;
    item.position.y = 0;

    const scale = 0.7 + Math.random() * 0.6;
    item.scale.set(scale, scale, scale);
}

// ============================================
// OBSTACLES
// ============================================

function spawnObstacle() {
    const rate = CONFIG.obstacleSpawnRate * state.difficulty;
    if (Math.random() > rate) return;
    if (obstacles.length > 8) return;

    const obstacle = createObstacleCar();

    const lane = Math.floor(Math.random() * 3) - 1;
    obstacle.position.set(lane * CONFIG.laneWidth, 0, 150 + Math.random() * 50);

    const colors = [0x0044FF, 0xFFCC00, 0xFFFFFF, 0x888888, 0xFF6600];
    const color = colors[Math.floor(Math.random() * colors.length)];
    obstacle.children[0].material = new THREE.MeshLambertMaterial({ color: color });

    obstacles.push(obstacle);
    scene.add(obstacle);
}

function createObstacleCar() {
    const group = new THREE.Group();

    const bodyGeom = new THREE.BoxGeometry(2, 1.2, 4);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x0044FF });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.7;
    group.add(body);

    const cabinGeom = new THREE.BoxGeometry(1.6, 0.6, 2);
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const cabin = new THREE.Mesh(cabinGeom, cabinMat);
    cabin.position.set(0, 1.5, -0.3);
    group.add(cabin);

    return group;
}

// ============================================
// CONTROLS
// ============================================

function setupControls() {
    const buttons = {
        'btn-left': { start: () => state.targetSteering = -1, end: () => state.targetSteering = 0 },
        'btn-right': { start: () => state.targetSteering = 1, end: () => state.targetSteering = 0 },
        'btn-gas': { start: () => state.accelerating = true, end: () => state.accelerating = false },
        'btn-brake': { start: () => state.braking = true, end: () => state.braking = false }
    };

    for (const [id, handlers] of Object.entries(buttons)) {
        const btn = document.getElementById(id);
        if (!btn) continue;

        // Touch
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handlers.start();
            btn.style.transform = 'scale(0.92)';
        });

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handlers.end();
            btn.style.transform = '';
        });

        btn.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            handlers.end();
            btn.style.transform = '';
        });

        // Mouse (for desktop testing)
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handlers.start();
        });

        btn.addEventListener('mouseup', (e) => {
            e.preventDefault();
            handlers.end();
        });

        btn.addEventListener('mouseleave', (e) => {
            e.preventDefault();
            handlers.end();
        });
    }

    // Keyboard (for desktop testing)
    document.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        switch(e.key) {
            case 'ArrowLeft': case 'a': state.targetSteering = -1; break;
            case 'ArrowRight': case 'd': state.targetSteering = 1; break;
            case 'ArrowUp': case 'w': state.accelerating = true; break;
            case 'ArrowDown': case 's': state.braking = true; break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.key) {
            case 'ArrowLeft': case 'a': state.targetSteering = 0; break;
            case 'ArrowRight': case 'd': state.targetSteering = 0; break;
            case 'ArrowUp': case 'w': state.accelerating = false; break;
            case 'ArrowDown': case 's': state.braking = false; break;
        }
    });
}

// ============================================
// GAME LOOP
// ============================================

function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05);

    if (!state.gameOver) {
        updatePhysics(dt);
        updateRoad(dt);
        updateScenery(dt);
        spawnObstacle();
        updateObstacles(dt);
        updateCamera();
        updateHUD();
        updateDifficulty();
    }

    renderer.render(scene, camera);
}

// ============================================
// PHYSICS
// ============================================

function updatePhysics(dt) {
    // Smooth steering
    state.steering += (state.targetSteering - state.steering) * 10 * dt;

    // Acceleration / braking
    if (state.accelerating) {
        state.speed += CONFIG.acceleration * dt;
    } else if (state.braking) {
        state.speed -= CONFIG.braking * dt;
    } else {
        state.speed *= CONFIG.friction;
    }

    // Off-road penalty
    const roadHalfWidth = CONFIG.roadWidth / 2 - 1;
    if (Math.abs(car.position.x) > roadHalfWidth) {
        state.speed *= CONFIG.offRoadFriction;
    }

    // Clamp speed
    state.speed = Math.max(0, Math.min(state.speed, CONFIG.maxSpeed));

    // Steering
    if (state.speed > 1) {
        const steerFactor = state.speed / CONFIG.maxSpeed;
        car.position.x += state.steering * CONFIG.turnSpeed * dt * (0.5 + 0.5 * steerFactor);
    }

    // Clamp position
    car.position.x = Math.max(-20, Math.min(20, car.position.x));

    // Car tilt
    car.rotation.z = -state.steering * 0.08 * Math.min(state.speed / 60, 1);
    car.rotation.y = -state.steering * 0.03 * Math.min(state.speed / 60, 1);

    // Collision recovery flash
    if (state.collisionTimer > 0) {
        state.collisionTimer -= dt;
        carBody.material.color.setHex(state.collisionTimer > 0.1 ? 0xFFFFFF : 0xDD0000);
    }

    // Score
    state.distance += state.speed * dt;
    state.score = Math.floor(state.distance / 10);
}

// ============================================
// ROAD UPDATE
// ============================================

function updateRoad(dt) {
    const moveDist = state.speed * dt;

    roadSegments.forEach(segment => {
        segment.position.z -= moveDist;
    });

    let furthestZ = -9999;
    roadSegments.forEach(s => {
        if (s.position.z > furthestZ) furthestZ = s.position.z;
    });

    roadSegments.forEach(segment => {
        if (segment.position.z < -CONFIG.segmentLength * 2) {
            segment.position.z = furthestZ + CONFIG.segmentLength;
            furthestZ = segment.position.z;
        }
    });
}

// ============================================
// SCENERY UPDATE
// ============================================

function updateScenery(dt) {
    const moveDist = state.speed * dt;

    sceneryItems.forEach(item => {
        item.position.z -= moveDist;
        if (item.position.z < -60) {
            resetSceneryItem(item);
        }
    });
}

// ============================================
// OBSTACLES UPDATE
// ============================================

function updateObstacles(dt) {
    const moveDist = state.speed * dt;

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.position.z -= moveDist;

        // Collision check
        const dx = Math.abs(obs.position.x - car.position.x);
        const dz = Math.abs(obs.position.z - car.position.z);

        if (dx < 2.0 && dz < 3.5 && state.collisionTimer <= 0) {
            handleCollision();
        }

        // Remove far obstacles
        if (obs.position.z < -50) {
            scene.remove(obs);
            obstacles.splice(i, 1);
        }
    }
}

function handleCollision() {
    state.speed *= 0.3;
    state.collisionTimer = 0.5;
    state.score = Math.max(0, state.score - 50);
    carBody.material.color.setHex(0xFFFFFF);
}

// ============================================
// DIFFICULTY
// ============================================

function updateDifficulty() {
    state.difficulty = 1 + state.score / 2000;
}

// ============================================
// CAMERA
// ============================================

function updateCamera() {
    const targetX = car.position.x * 0.4;
    const targetY = 4 + state.speed / 40;
    const targetZ = car.position.z - 9 - state.speed / 20;

    camera.position.x += (targetX - camera.position.x) * 0.08;
    camera.position.y += (targetY - camera.position.y) * 0.08;
    camera.position.z += (targetZ - camera.position.z) * 0.08;

    const lookAtX = car.position.x * 0.3;
    const lookAtZ = car.position.z + 15 + state.speed / 10;
    camera.lookAt(lookAtX, 0, lookAtZ);
}

// ============================================
// HUD
// ============================================

function updateHUD() {
    document.getElementById('speed').textContent = Math.floor(state.speed);
    document.getElementById('score').textContent = state.score;
}

// ============================================
// RESIZE
// ============================================

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// START
// ============================================

init();
