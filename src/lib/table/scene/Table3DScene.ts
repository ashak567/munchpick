import * as THREE from 'three';
import { MascotCharacter } from '@/lib/mascots/registry';
import { CharacterVisualState, SocialReactionKind } from '../group-events';

export interface SeatConfig {
  characterId: MascotCharacter | 'user';
  name: string;
  angle: number; // radians
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  color: number;
}

export type CameraViewMode = 'overview' | 'speaker' | 'user_pov';

export class Table3DScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animationFrameId: number | null = null;
  private clock: THREE.Clock;

  // Scene Objects
  private tableMesh!: THREE.Mesh;
  private roomGroup!: THREE.Group;
  private charactersGroup: THREE.Group;
  private characterMeshes: Map<MascotCharacter, THREE.Group> = new Map();
  private characterStates: Map<MascotCharacter, CharacterVisualState> = new Map();
  private characterReactions: Map<MascotCharacter, SocialReactionKind | null> = new Map();

  // Lighting
  private ambientLight!: THREE.AmbientLight;
  private mainLight!: THREE.DirectionalLight;
  private tableSpotlight!: THREE.SpotLight;
  private speakerLight!: THREE.PointLight;

  // Camera & Orbit Controller
  private cameraViewMode: CameraViewMode = 'overview';
  private activeSpeakerId: MascotCharacter | 'user' | null = null;

  // Spherical Orbit Coordinates (radius, phi elevation, theta azimuth)
  private spherical = { radius: 7.2, phi: 0.88, theta: 0 };
  private targetSpherical = { radius: 7.2, phi: 0.88, theta: 0 };
  private targetLookAt = new THREE.Vector3(0, 0.85, 0);
  private currentLookAt = new THREE.Vector3(0, 0.85, 0);

  // Interaction State
  private isPointerDown = false;
  private pointerStart = { x: 0, y: 0 };
  private mouseParallax = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private isReducedMotion = false;
  private isDarkTheme = false;

  // Seats: 9 characters + 1 user seat = 10 total seats
  public seats: SeatConfig[] = [];

  constructor(container: HTMLElement, isDark: boolean = false, isReduced: boolean = false) {
    this.container = container;
    this.isDarkTheme = isDark;
    this.isReducedMotion = isReduced;
    this.clock = new THREE.Clock();

    // 1. Scene setup (Transparent background to let global AmbientBackground show through)
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // 2. Camera Setup with Mobile-aware Initial Framing
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    const aspect = width / height;
    const isMobile = aspect < 1.0;

    // Adjust camera field of view and distance based on viewport aspect ratio
    const initialFov = isMobile ? 48 : 38;
    const initialRadius = isMobile ? 8.6 : 7.2;
    this.spherical.radius = initialRadius;
    this.targetSpherical.radius = initialRadius;

    this.camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 100);
    this.updateCameraPositionDirect();

    // 3. Renderer with full transparency & high performance
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Ensure touch interactions don't scroll the parent page
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';

    this.container.appendChild(this.renderer.domElement);

    // 4. Setup Lights, Floating Dais, Table, Seats, and Characters
    this.charactersGroup = new THREE.Group();
    this.scene.add(this.charactersGroup);

    this.setupLighting();
    this.setupFloatingDais();
    this.setupTable();
    this.calculateSeats();
    this.setupCharacters();

    // 5. Setup Listeners & Animation Loop
    this.setupEventListeners();
    this.startAnimationLoop();
  }

  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(
      this.isDarkTheme ? 0x8295b3 : 0xfff6ea,
      this.isDarkTheme ? 0.9 : 1.3
    );
    this.scene.add(this.ambientLight);

    // Main Sunlight / Moonlight Directional Light
    this.mainLight = new THREE.DirectionalLight(
      this.isDarkTheme ? 0xaad0ff : 0xfffaf0,
      this.isDarkTheme ? 1.2 : 1.7
    );
    this.mainLight.position.set(4, 9, 5);
    this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.width = 1024;
    this.mainLight.shadow.mapSize.height = 1024;
    this.mainLight.shadow.bias = -0.0004;
    this.scene.add(this.mainLight);

    // Center Table Spotlight for focus
    this.tableSpotlight = new THREE.SpotLight(
      this.isDarkTheme ? 0x8fd9a8 : 0xffebad,
      this.isDarkTheme ? 1.6 : 1.9,
      14,
      Math.PI / 3.2,
      0.45,
      1.0
    );
    this.tableSpotlight.position.set(0, 5.5, 0);
    this.tableSpotlight.target.position.set(0, 0.85, 0);
    this.scene.add(this.tableSpotlight);
    this.scene.add(this.tableSpotlight.target);

    // Active Speaker Pointlight
    this.speakerLight = new THREE.PointLight(0x8fd9a8, 0, 5);
    this.speakerLight.position.set(0, 2, 0);
    this.scene.add(this.speakerLight);
  }

  private setupFloatingDais() {
    this.roomGroup = new THREE.Group();

    // 1. Floating Circular Pavilion Floor
    const floorGeo = new THREE.CylinderGeometry(4.6, 4.8, 0.25, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: this.isDarkTheme ? 0x161d2d : 0xfcf8f2,
      roughness: 0.75,
      metalness: 0.08
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.125;
    floor.receiveShadow = true;
    this.roomGroup.add(floor);

    // 2. Beveled Rim Edge
    const rimGeo = new THREE.TorusGeometry(4.7, 0.08, 16, 48);
    const rimMat = new THREE.MeshStandardMaterial({
      color: this.isDarkTheme ? 0x27344f : 0xe7dacb,
      roughness: 0.5
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.01;
    this.roomGroup.add(rim);

    // 3. Soft Ambient Glow Halo Ring on Floor (Munch emerald signature)
    const ringGeo = new THREE.RingGeometry(3.6, 4.2, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: this.isDarkTheme ? 0x8fd9a8 : 0x8fd9a8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: this.isDarkTheme ? 0.22 : 0.28
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    this.roomGroup.add(ring);

    this.scene.add(this.roomGroup);
  }

  private setupTable() {
    // 1. Warm Polished Tabletop
    const tableTopGeo = new THREE.CylinderGeometry(2.3, 2.3, 0.14, 48);
    const tableTopMat = new THREE.MeshStandardMaterial({
      color: this.isDarkTheme ? 0x242e42 : 0xfffaf2,
      roughness: 0.35,
      metalness: 0.05
    });
    this.tableMesh = new THREE.Mesh(tableTopGeo, tableTopMat);
    this.tableMesh.position.y = 0.95;
    this.tableMesh.castShadow = true;
    this.tableMesh.receiveShadow = true;
    this.scene.add(this.tableMesh);

    // 2. Table Pedestal Leg
    const legGeo = new THREE.CylinderGeometry(0.45, 0.85, 0.95, 24);
    const legMat = new THREE.MeshStandardMaterial({
      color: this.isDarkTheme ? 0x182030 : 0xede0d2,
      roughness: 0.65
    });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.y = 0.475;
    leg.castShadow = true;
    this.scene.add(leg);

    // 3. Centerpiece: Munch Clover Terrarium Plate
    const centerPlateGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.04, 24);
    const centerPlateMat = new THREE.MeshStandardMaterial({
      color: this.isDarkTheme ? 0x2f3c57 : 0xe8dcce,
      roughness: 0.3
    });
    const plate = new THREE.Mesh(centerPlateGeo, centerPlateMat);
    plate.position.y = 1.03;
    this.scene.add(plate);

    // Center Clover Dome (Translucent glowing dome)
    const domeGeo = new THREE.SphereGeometry(0.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshPhysicalMaterial({
      color: 0x8fd9a8,
      transparent: true,
      opacity: 0.8,
      roughness: 0.15,
      transmission: 0.85,
      ior: 1.4
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 1.05;
    this.scene.add(dome);
  }

  private calculateSeats() {
    // 10 Seats evenly spaced around the circular table
    const characters: Array<{ id: MascotCharacter | 'user'; name: string; color: number }> = [
      { id: 'user', name: 'You', color: 0x8fd9a8 },
      { id: 'munch', name: 'Munch', color: 0x8fd9a8 },
      { id: 'ollie', name: 'Ollie', color: 0xcdb4ff },
      { id: 'ellie', name: 'Ellie', color: 0xbce3ff },
      { id: 'pandy', name: 'Pandy', color: 0x5a5a5a },
      { id: 'dobby', name: 'Dobby', color: 0xead5c3 },
      { id: 'coco', name: 'Coco', color: 0xffaf7a },
      { id: 'froggy', name: 'Froggy', color: 0x8fd9a8 },
      { id: 'bubbles', name: 'Bubbles', color: 0xbce3ff },
      { id: 'chicky', name: 'Chicky', color: 0xffe08a }
    ];

    const radius = 3.15;
    const count = characters.length; // 10

    this.seats = characters.map((c, i) => {
      // User is placed at South position (front of table facing North)
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const pos = new THREE.Vector3(x, 0, z);
      const lookAt = new THREE.Vector3(0, 0.95, 0); // look toward table center

      return {
        characterId: c.id,
        name: c.name,
        angle,
        position: pos,
        lookAt,
        color: c.color
      };
    });
  }

  private setupCharacters() {
    for (const seat of this.seats) {
      if (seat.characterId === 'user') {
        // User Seat Cushion / Stool
        const stool = this.buildStoolMesh(seat.color);
        stool.position.copy(seat.position);
        stool.lookAt(seat.lookAt);
        this.scene.add(stool);
        continue;
      }

      const mascotId = seat.characterId as MascotCharacter;
      const charGroup = new THREE.Group();
      charGroup.position.copy(seat.position);
      charGroup.position.y = 0.48; // seated height
      charGroup.lookAt(seat.lookAt);

      // 1. Seat Stool
      const stool = this.buildStoolMesh(seat.color);
      stool.position.set(0, -0.48, 0);
      charGroup.add(stool);

      // 2. Character Model Geometry
      const avatarBody = this.buildCharacterAvatar(mascotId, seat.color);
      charGroup.add(avatarBody);

      // 3. Selection Halo / Glow ring under character
      const haloGeo = new THREE.RingGeometry(0.38, 0.46, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: seat.color,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.name = 'halo';
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -0.46;
      charGroup.add(halo);

      this.charactersGroup.add(charGroup);
      this.characterMeshes.set(mascotId, charGroup);
      this.characterStates.set(mascotId, 'idle');
      this.characterReactions.set(mascotId, null);
    }
  }

  private buildStoolMesh(accentColor: number): THREE.Group {
    const stool = new THREE.Group();
    const cushionGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.09, 24);
    const cushionMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.55
    });
    const cushion = new THREE.Mesh(cushionGeo, cushionMat);
    cushion.position.y = 0.44;
    cushion.castShadow = true;
    stool.add(cushion);

    const legGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.44, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3d3d3d, roughness: 0.5 });
    const leg1 = new THREE.Mesh(legGeo, legMat);
    leg1.position.set(0.16, 0.22, 0.16);
    stool.add(leg1);
    const leg2 = new THREE.Mesh(legGeo, legMat);
    leg2.position.set(-0.16, 0.22, 0.16);
    stool.add(leg2);
    const leg3 = new THREE.Mesh(legGeo, legMat);
    leg3.position.set(0, 0.22, -0.2);
    stool.add(leg3);

    return stool;
  }

  private buildCharacterAvatar(characterId: MascotCharacter, mainColor: number): THREE.Group {
    const avatar = new THREE.Group();
    avatar.name = 'avatar_body';

    const bodyMat = new THREE.MeshStandardMaterial({
      color: mainColor,
      roughness: 0.45,
      metalness: 0.05
    });

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const cheekMat = new THREE.MeshStandardMaterial({ color: 0xffcfb3, roughness: 0.7 });

    // Base Round Soft Body
    const bodyGeo = new THREE.SphereGeometry(0.4, 24, 20);
    bodyGeo.scale(1.0, 1.05, 0.95);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.4;
    bodyMesh.castShadow = true;
    avatar.add(bodyMesh);

    // Eyes
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), eyeMat);
    eyeL.position.set(-0.12, 0.44, 0.35);
    avatar.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), eyeMat);
    eyeR.position.set(0.12, 0.44, 0.35);
    avatar.add(eyeR);

    // Cheeks
    const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), cheekMat);
    cheekL.scale.set(1, 0.6, 0.5);
    cheekL.position.set(-0.2, 0.36, 0.31);
    avatar.add(cheekL);
    const cheekR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), cheekMat);
    cheekR.scale.set(1, 0.6, 0.5);
    cheekR.position.set(0.2, 0.36, 0.31);
    avatar.add(cheekR);

    // Mascot-Specific 3D Geometry Details
    if (characterId === 'munch') {
      const leafGeo = new THREE.SphereGeometry(0.13, 12, 12);
      leafGeo.scale(1, 0.3, 1.25);
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.Mesh(leafGeo, bodyMat);
        leaf.position.set(0, 0.84, 0);
        leaf.rotation.y = (i * Math.PI) / 2;
        leaf.rotation.x = 0.35;
        avatar.add(leaf);
      }
    } else if (characterId === 'ollie') {
      const hornGeo = new THREE.ConeGeometry(0.09, 0.2, 10);
      const hornL = new THREE.Mesh(hornGeo, bodyMat);
      hornL.position.set(-0.22, 0.8, 0.05);
      hornL.rotation.z = 0.25;
      avatar.add(hornL);
      const hornR = new THREE.Mesh(hornGeo, bodyMat);
      hornR.position.set(0.22, 0.8, 0.05);
      hornR.rotation.z = -0.25;
      avatar.add(hornR);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.11, 8), new THREE.MeshStandardMaterial({ color: 0xffe08a }));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.37, 0.4);
      avatar.add(beak);
    } else if (characterId === 'ellie') {
      const earGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.04, 20);
      const earL = new THREE.Mesh(earGeo, bodyMat);
      earL.position.set(-0.45, 0.48, -0.05);
      earL.rotation.y = 0.4;
      avatar.add(earL);
      const earR = new THREE.Mesh(earGeo, bodyMat);
      earR.position.set(0.45, 0.48, -0.05);
      earR.rotation.y = -0.4;
      avatar.add(earR);
      const trunk = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 10, 20, Math.PI), bodyMat);
      trunk.position.set(0, 0.3, 0.34);
      trunk.rotation.x = Math.PI / 2;
      avatar.add(trunk);
    } else if (characterId === 'pandy') {
      const earGeo = new THREE.SphereGeometry(0.11, 12, 12);
      const earL = new THREE.Mesh(earGeo, eyeMat);
      earL.position.set(-0.26, 0.78, 0);
      avatar.add(earL);
      const earR = new THREE.Mesh(earGeo, eyeMat);
      earR.position.set(0.26, 0.78, 0);
      avatar.add(earR);
      bodyMesh.material = whiteMat;
    } else if (characterId === 'dobby') {
      const earGeo = new THREE.CylinderGeometry(0.07, 0.13, 0.32, 10);
      const earMat = new THREE.MeshStandardMaterial({ color: 0xa77a50 });
      const earL = new THREE.Mesh(earGeo, earMat);
      earL.position.set(-0.35, 0.5, 0.07);
      earL.rotation.z = 0.5;
      avatar.add(earL);
      const earR = new THREE.Mesh(earGeo, earMat);
      earR.position.set(0.35, 0.5, 0.07);
      earR.rotation.z = -0.5;
      avatar.add(earR);
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), whiteMat);
      snout.position.set(0, 0.33, 0.36);
      avatar.add(snout);
    } else if (characterId === 'coco') {
      const earGeo = new THREE.ConeGeometry(0.13, 0.23, 10);
      const earL = new THREE.Mesh(earGeo, bodyMat);
      earL.position.set(-0.22, 0.8, 0.05);
      earL.rotation.z = 0.3;
      avatar.add(earL);
      const earR = new THREE.Mesh(earGeo, bodyMat);
      earR.position.set(0.22, 0.8, 0.05);
      earR.rotation.z = -0.3;
      avatar.add(earR);
    } else if (characterId === 'froggy') {
      const eyeBulgeGeo = new THREE.SphereGeometry(0.13, 12, 12);
      const bulgeL = new THREE.Mesh(eyeBulgeGeo, bodyMat);
      bulgeL.position.set(-0.23, 0.68, 0.1);
      avatar.add(bulgeL);
      const bulgeR = new THREE.Mesh(eyeBulgeGeo, bodyMat);
      bulgeR.position.set(0.23, 0.68, 0.1);
      avatar.add(bulgeR);
      eyeL.position.set(-0.23, 0.7, 0.21);
      eyeR.position.set(0.23, 0.7, 0.21);
    } else if (characterId === 'bubbles') {
      const finGeo = new THREE.ConeGeometry(0.11, 0.28, 10);
      const finMat = new THREE.MeshStandardMaterial({ color: 0xffe08a });
      const dorsal = new THREE.Mesh(finGeo, finMat);
      dorsal.position.set(0, 0.84, -0.05);
      dorsal.rotation.x = -0.4;
      avatar.add(dorsal);
      const tail = new THREE.Mesh(finGeo, finMat);
      tail.position.set(0, 0.4, -0.45);
      tail.rotation.x = Math.PI / 2;
      avatar.add(tail);
    } else if (characterId === 'chicky') {
      const comb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), new THREE.MeshStandardMaterial({ color: 0xff8e8e }));
      comb.scale.set(0.5, 1.3, 0.75);
      comb.position.set(0, 0.84, 0.05);
      avatar.add(comb);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.13, 8), new THREE.MeshStandardMaterial({ color: 0xffa726 }));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.36, 0.4);
      avatar.add(beak);
    }

    return avatar;
  }

  // Unified Pointer & Touch Event Handling for Orbit and Parallax
  private setupEventListeners() {
    window.addEventListener('resize', this.onWindowResize);

    const dom = this.container;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const aspect = width / height;
    const isMobile = aspect < 1.0;

    this.camera.aspect = aspect;
    this.camera.fov = isMobile ? 48 : 38;
    this.camera.updateProjectionMatrix();

    if (this.cameraViewMode === 'overview') {
      this.targetSpherical.radius = isMobile ? 8.6 : 7.2;
    }

    this.renderer.setSize(width, height);
  };

  private onPointerDown = (e: PointerEvent) => {
    // Only drag with primary mouse button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.isPointerDown = true;
    this.pointerStart.x = e.clientX;
    this.pointerStart.y = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.isPointerDown) {
      const deltaX = e.clientX - this.pointerStart.x;
      const deltaY = e.clientY - this.pointerStart.y;
      this.pointerStart.x = e.clientX;
      this.pointerStart.y = e.clientY;

      // Snappy orbit update
      this.targetSpherical.theta -= deltaX * 0.0055;
      this.targetSpherical.phi -= deltaY * 0.0055;

      // Clamp polar angle so table cannot flip upside down (between ~20 deg and ~80 deg)
      this.targetSpherical.phi = Math.max(0.35, Math.min(1.40, this.targetSpherical.phi));
    } else if (!this.isReducedMotion) {
      // Subtle mouse-follow parallax when idle
      const rect = this.container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
      const y = (e.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
      this.mouseParallax.targetX = x * 0.35;
      this.mouseParallax.targetY = y * 0.2;
    }
  };

  private onPointerUp = () => {
    this.isPointerDown = false;
  };

  private onWheel = (e: WheelEvent) => {
    const zoomDelta = e.deltaY * 0.003;
    this.targetSpherical.radius = Math.max(5.2, Math.min(9.5, this.targetSpherical.radius + zoomDelta));
  };

  private updateCameraPositionDirect() {
    // Convert spherical coordinates to Cartesian Vector3
    const r = this.spherical.radius;
    const phi = this.spherical.phi;
    const theta = this.spherical.theta;

    const sinPhiRadius = r * Math.sin(phi);
    const x = sinPhiRadius * Math.sin(theta);
    const y = r * Math.cos(phi);
    const z = sinPhiRadius * Math.cos(theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.currentLookAt);
  }

  // Theme & Perspective Modes
  public updateTheme(isDark: boolean) {
    this.isDarkTheme = isDark;

    if (this.ambientLight) {
      this.ambientLight.color.setHex(isDark ? 0x8295b3 : 0xfff6ea);
      this.ambientLight.intensity = isDark ? 0.9 : 1.3;
    }
    if (this.mainLight) {
      this.mainLight.color.setHex(isDark ? 0xaad0ff : 0xfffaf0);
      this.mainLight.intensity = isDark ? 1.2 : 1.7;
    }
    if (this.tableSpotlight) {
      this.tableSpotlight.color.setHex(isDark ? 0x8fd9a8 : 0xffebad);
      this.tableSpotlight.intensity = isDark ? 1.6 : 1.9;
    }
  }

  public setReducedMotion(reduced: boolean) {
    this.isReducedMotion = reduced;
  }

  public setCameraMode(mode: CameraViewMode) {
    this.cameraViewMode = mode;
    const aspect = this.container ? this.container.clientWidth / Math.max(this.container.clientHeight, 1) : 1;
    const isMobile = aspect < 1.0;

    if (mode === 'overview') {
      this.targetSpherical.radius = isMobile ? 8.6 : 7.2;
      this.targetSpherical.phi = 0.88;
      this.targetSpherical.theta = 0;
      this.targetLookAt.set(0, 0.85, 0);
    } else if (mode === 'user_pov') {
      // Perspective from User seat looking across the circle
      this.targetSpherical.radius = 4.8;
      this.targetSpherical.phi = 1.2;
      this.targetSpherical.theta = 0;
      this.targetLookAt.set(0, 1.1, 1.2);
    } else if (mode === 'speaker' && this.activeSpeakerId && this.activeSpeakerId !== 'user') {
      const seat = this.seats.find((s) => s.characterId === this.activeSpeakerId);
      if (seat) {
        // Center camera angle on the active speaker
        this.targetSpherical.theta = seat.angle + Math.PI / 2;
        this.targetSpherical.radius = isMobile ? 6.5 : 5.6;
        this.targetSpherical.phi = 1.05;
        this.targetLookAt.copy(seat.position).add(new THREE.Vector3(0, 0.5, 0));
      }
    }
  }

  public setActiveSpeaker(speakerId: MascotCharacter | 'user' | null) {
    this.activeSpeakerId = speakerId;

    // Update Halos under characters
    for (const [charId, group] of this.characterMeshes.entries()) {
      const halo = group.getObjectByName('halo') as THREE.Mesh;
      if (halo && halo.material instanceof THREE.MeshBasicMaterial) {
        halo.material.opacity = charId === speakerId ? 0.85 : 0;
      }
    }

    // Update Speaker Focus Spotlight
    if (speakerId && speakerId !== 'user') {
      const seat = this.seats.find((s) => s.characterId === speakerId);
      if (seat) {
        this.speakerLight.position.set(seat.position.x, 2.0, seat.position.z);
        this.speakerLight.intensity = 2.4;
        this.speakerLight.color.setHex(seat.color);
        if (this.cameraViewMode === 'speaker') {
          this.setCameraMode('speaker');
        }
      }
    } else {
      this.speakerLight.intensity = 0;
    }
  }

  public updateCharacterState(charId: MascotCharacter, state: CharacterVisualState) {
    this.characterStates.set(charId, state);
  }

  public updateCharacterReaction(charId: MascotCharacter, reaction: SocialReactionKind | null) {
    this.characterReactions.set(charId, reaction);
  }

  // Animation Loop (Zero React Re-renders, 60-120fps direct hardware rendering)
  private startAnimationLoop() {
    const render = () => {
      this.animationFrameId = requestAnimationFrame(render);
      const delta = Math.min(this.clock.getDelta(), 0.1);
      const time = this.clock.getElapsedTime();

      // 1. Mouse Parallax Smoothing (when not actively dragging)
      if (!this.isPointerDown && !this.isReducedMotion) {
        this.mouseParallax.x += (this.mouseParallax.targetX - this.mouseParallax.x) * 0.1;
        this.mouseParallax.y += (this.mouseParallax.targetY - this.mouseParallax.y) * 0.1;
      }

      // 2. High-Performance Snappy Camera Interpolation (no lag/sluggish damping)
      const lerpSpeed = 0.14;
      this.spherical.radius += (this.targetSpherical.radius - this.spherical.radius) * lerpSpeed;
      this.spherical.phi += (this.targetSpherical.phi - this.spherical.phi) * lerpSpeed;
      this.spherical.theta += (this.targetSpherical.theta - this.spherical.theta) * lerpSpeed;
      this.currentLookAt.lerp(this.targetLookAt, lerpSpeed);

      // Compute camera Cartesian position
      const r = this.spherical.radius;
      const phi = this.spherical.phi;
      const theta = this.spherical.theta;

      const sinPhiRadius = r * Math.sin(phi);
      let posX = sinPhiRadius * Math.sin(theta);
      let posY = r * Math.cos(phi);
      let posZ = sinPhiRadius * Math.cos(theta);

      if (!this.isPointerDown && !this.isReducedMotion) {
        posX += this.mouseParallax.x;
        posY -= this.mouseParallax.y;
      }

      this.camera.position.set(posX, posY, posZ);
      this.camera.lookAt(this.currentLookAt);

      // 3. Characters Visual Dynamics & Social Gestures
      for (const [charId, group] of this.characterMeshes.entries()) {
        const body = group.getObjectByName('avatar_body');
        if (!body) continue;

        const state = this.characterStates.get(charId) || 'idle';
        const reaction = this.characterReactions.get(charId);
        const isSpeaking = this.activeSpeakerId === charId;

        if (!this.isReducedMotion) {
          const seat = this.seats.find((s) => s.characterId === charId);
          const phase = (seat?.angle || 0) * 2;
          const bob = Math.sin(time * 2.4 + phase) * 0.02;

          if (isSpeaking || state === 'speaking') {
            // Natural rhythmic speaking bob
            body.position.y = 0.4 + Math.abs(Math.sin(time * 7.5)) * 0.06;
            body.rotation.y = Math.sin(time * 3.8) * 0.07;
            body.scale.set(1 + Math.sin(time * 7.5) * 0.03, 1 - Math.sin(time * 7.5) * 0.02, 1);
          } else if (reaction === 'nod' || reaction === 'agree') {
            body.position.y = 0.4 + Math.sin(time * 6.5) * 0.04;
            body.rotation.x = Math.sin(time * 6.5) * 0.12;
          } else if (reaction === 'cheer' || reaction === 'laugh') {
            body.position.y = 0.4 + Math.abs(Math.sin(time * 8.5)) * 0.1;
            body.rotation.z = Math.sin(time * 5.5) * 0.08;
          } else if (reaction === 'surprised' || state === 'interrupted') {
            // Recoil
            body.position.y = 0.46;
            body.rotation.x = -0.14;
          } else if (state === 'thinking') {
            body.position.y = 0.44 + Math.sin(time * 1.5) * 0.015;
            body.rotation.z = 0.08;
          } else {
            // Normal gentle resting breath
            body.position.y = 0.4 + bob;
            body.rotation.x = 0;
            body.rotation.z = 0;
          }
        }
      }

      this.renderer.render(this.scene, this.camera);
    };

    render();
  }

  public dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);

    const dom = this.container;
    if (dom) {
      dom.removeEventListener('pointerdown', this.onPointerDown);
      dom.removeEventListener('wheel', this.onWheel);
    }

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
