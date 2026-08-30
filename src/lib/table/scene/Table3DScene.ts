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

  // Camera & Interaction
  private targetCameraPos: THREE.Vector3 = new THREE.Vector3(0, 5.5, 7.5);
  private targetLookAt: THREE.Vector3 = new THREE.Vector3(0, 0.5, 0);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3(0, 0.5, 0);
  private cameraViewMode: CameraViewMode = 'overview';
  private activeSpeakerId: MascotCharacter | 'user' | null = null;

  private mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private isReducedMotion = false;
  private isDarkTheme = false;

  // Seats: 9 characters + 1 user seat = 10 total seats
  public seats: SeatConfig[] = [];

  constructor(container: HTMLElement, isDark: boolean = false, isReduced: boolean = false) {
    this.container = container;
    this.isDarkTheme = isDark;
    this.isReducedMotion = isReduced;
    this.clock = new THREE.Clock();

    // 1. Scene & Background
    this.scene = new THREE.Scene();
    this.updateBackgroundTheme(isDark);

    // 2. Camera
    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    this.camera.position.copy(this.targetCameraPos);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Attach canvas to DOM
    this.container.appendChild(this.renderer.domElement);

    // 4. Setup Lighting, Room, Table, Seats, and Characters
    this.charactersGroup = new THREE.Group();
    this.scene.add(this.charactersGroup);

    this.setupLighting();
    this.setupRoom();
    this.setupTable();
    this.calculateSeats();
    this.setupCharacters();

    // 5. Attach event listeners & start loop
    this.setupEventListeners();
    this.startAnimationLoop();
  }

  private updateBackgroundTheme(isDark: boolean) {
    if (isDark) {
      this.scene.background = new THREE.Color(0x0a0d17);
      this.scene.fog = new THREE.FogExp2(0x0a0d17, 0.035);
    } else {
      this.scene.background = new THREE.Color(0xfcf6ef);
      this.scene.fog = new THREE.FogExp2(0xfcf6ef, 0.025);
    }
  }

  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(
      this.isDarkTheme ? 0x6a7d9b : 0xfff2e0,
      this.isDarkTheme ? 0.7 : 1.2
    );
    this.scene.add(this.ambientLight);

    // Main Sun / Moon Key Light
    this.mainLight = new THREE.DirectionalLight(
      this.isDarkTheme ? 0x93b4ff : 0xfff6ea,
      this.isDarkTheme ? 1.0 : 1.6
    );
    this.mainLight.position.set(5, 10, 6);
    this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.width = 1024;
    this.mainLight.shadow.mapSize.height = 1024;
    this.mainLight.shadow.bias = -0.0005;
    this.scene.add(this.mainLight);

    // Center Table Warm Spotlight
    this.tableSpotlight = new THREE.SpotLight(
      this.isDarkTheme ? 0x8fd9a8 : 0xffe08a,
      this.isDarkTheme ? 1.5 : 1.8,
      12,
      Math.PI / 3.5,
      0.5,
      1.0
    );
    this.tableSpotlight.position.set(0, 5, 0);
    this.tableSpotlight.target.position.set(0, 0, 0);
    this.scene.add(this.tableSpotlight);
    this.scene.add(this.tableSpotlight.target);

    // Active Speaker Pointlight
    this.speakerLight = new THREE.PointLight(0x8fd9a8, 0, 6);
    this.speakerLight.position.set(0, 2, 0);
    this.scene.add(this.speakerLight);
  }

  private setupRoom() {
    this.roomGroup = new THREE.Group();

    // Floor
    const floorGeo = new THREE.CircleGeometry(9, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: this.isDarkTheme ? 0x121728 : 0xf4ebe1,
      roughness: 0.8,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.roomGroup.add(floor);

    // Room Outer Wall / Backdrop
    const wallGeo = new THREE.CylinderGeometry(9, 9, 7, 32, 1, true, -Math.PI * 0.75, Math.PI * 1.5);
    const wallMat = new THREE.MeshStandardMaterial({
      color: this.isDarkTheme ? 0x182035 : 0xfaeee0,
      side: THREE.BackSide,
      roughness: 0.9
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 3.5;
    this.roomGroup.add(wall);

    // Decorative floor ring (Munch moss/soft boundary)
    const ringGeo = new THREE.RingGeometry(3.6, 3.8, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: this.isDarkTheme ? 0x3d5c48 : 0x8fd9a8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.roomGroup.add(ring);

    this.scene.add(this.roomGroup);
  }

  private setupTable() {
    // 1. Tabletop
    const tableTopGeo = new THREE.CylinderGeometry(2.4, 2.4, 0.15, 64);
    const tableTopMat = new THREE.MeshStandardMaterial({
      color: this.isDarkTheme ? 0x222c42 : 0xfffcf7,
      roughness: 0.4,
      metalness: 0.1
    });
    this.tableMesh = new THREE.Mesh(tableTopGeo, tableTopMat);
    this.tableMesh.position.y = 1.0;
    this.tableMesh.castShadow = true;
    this.tableMesh.receiveShadow = true;
    this.scene.add(this.tableMesh);

    // 2. Table Leg / Pedestal
    const legGeo = new THREE.CylinderGeometry(0.5, 0.9, 1.0, 32);
    const legMat = new THREE.MeshStandardMaterial({
      color: this.isDarkTheme ? 0x161e30 : 0xe7dacb,
      roughness: 0.7
    });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.y = 0.5;
    leg.castShadow = true;
    this.scene.add(leg);

    // 3. Centerpiece: Munch Clover Terrarium
    const centerPlateGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.05, 32);
    const centerPlateMat = new THREE.MeshStandardMaterial({
      color: this.isDarkTheme ? 0x2b3854 : 0xebdecb,
      roughness: 0.3
    });
    const plate = new THREE.Mesh(centerPlateGeo, centerPlateMat);
    plate.position.y = 1.08;
    this.scene.add(plate);

    // Center Clover Emblem Dome
    const domeGeo = new THREE.SphereGeometry(0.45, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshPhysicalMaterial({
      color: 0x8fd9a8,
      transparent: true,
      opacity: 0.75,
      roughness: 0.1,
      transmission: 0.8,
      ior: 1.4
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 1.1;
    this.scene.add(dome);
  }

  private calculateSeats() {
    // 10 Seats evenly spaced around circle:
    // Index 0: User (South position at 0 radians)
    // Indices 1 - 9: Munch, Ollie, Ellie, Pandy, Dobby, Coco, Froggy, Bubbles, Chicky
    const characters: Array<{ id: MascotCharacter | 'user'; name: string; color: number }> = [
      { id: 'user', name: 'You', color: 0x8fd9a8 },
      { id: 'munch', name: 'Munch', color: 0x8fd9a8 },
      { id: 'ollie', name: 'Ollie', color: 0xcdb4ff },
      { id: 'ellie', name: 'Ellie', color: 0xbce3ff },
      { id: 'pandy', name: 'Pandy', color: 0x4a4a4a },
      { id: 'dobby', name: 'Dobby', color: 0xead5c3 },
      { id: 'coco', name: 'Coco', color: 0xffaf7a },
      { id: 'froggy', name: 'Froggy', color: 0x8fd9a8 },
      { id: 'bubbles', name: 'Bubbles', color: 0xbce3ff },
      { id: 'chicky', name: 'Chicky', color: 0xffe08a }
    ];

    const radius = 3.2;
    const count = characters.length; // 10

    this.seats = characters.map((c, i) => {
      // User is placed at -Math.PI / 2 (front/bottom of table relative to default camera)
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const pos = new THREE.Vector3(x, 0, z);
      const lookAt = new THREE.Vector3(0, 1.0, 0); // look at table center

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
    // For each mascot, build a charming procedural 3D avatar
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
      charGroup.position.y = 0.5; // seated height
      charGroup.lookAt(seat.lookAt);

      // 1. Seat Stool
      const stool = this.buildStoolMesh(seat.color);
      stool.position.set(0, -0.5, 0);
      charGroup.add(stool);

      // 2. Character Model Geometry
      const avatarBody = this.buildCharacterAvatar(mascotId, seat.color);
      charGroup.add(avatarBody);

      // 3. Selection Halo / Glow ring under character
      const haloGeo = new THREE.RingGeometry(0.4, 0.48, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: seat.color,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.name = 'halo';
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -0.48;
      charGroup.add(halo);

      this.charactersGroup.add(charGroup);
      this.characterMeshes.set(mascotId, charGroup);
      this.characterStates.set(mascotId, 'idle');
      this.characterReactions.set(mascotId, null);
    }
  }

  private buildStoolMesh(accentColor: number): THREE.Group {
    const stool = new THREE.Group();
    const cushionGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 24);
    const cushionMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.6
    });
    const cushion = new THREE.Mesh(cushionGeo, cushionMat);
    cushion.position.y = 0.45;
    cushion.castShadow = true;
    stool.add(cushion);

    const legGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.45, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.5 });
    const leg1 = new THREE.Mesh(legGeo, legMat);
    leg1.position.set(0.18, 0.225, 0.18);
    stool.add(leg1);
    const leg2 = new THREE.Mesh(legGeo, legMat);
    leg2.position.set(-0.18, 0.225, 0.18);
    stool.add(leg2);
    const leg3 = new THREE.Mesh(legGeo, legMat);
    leg3.position.set(0, 0.225, -0.22);
    stool.add(leg3);

    return stool;
  }

  private buildCharacterAvatar(characterId: MascotCharacter, mainColor: number): THREE.Group {
    const avatar = new THREE.Group();
    avatar.name = 'avatar_body';

    const bodyMat = new THREE.MeshStandardMaterial({
      color: mainColor,
      roughness: 0.5,
      metalness: 0.05
    });

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const cheekMat = new THREE.MeshStandardMaterial({ color: 0xffcfb3, roughness: 0.7 });

    // Base Round Soft Body
    const bodyGeo = new THREE.SphereGeometry(0.42, 32, 24);
    bodyGeo.scale(1.0, 1.05, 0.95);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.42;
    bodyMesh.castShadow = true;
    avatar.add(bodyMesh);

    // Eyes
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), eyeMat);
    eyeL.position.set(-0.13, 0.46, 0.37);
    avatar.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), eyeMat);
    eyeR.position.set(0.13, 0.46, 0.37);
    avatar.add(eyeR);

    // Cheeks
    const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), cheekMat);
    cheekL.scale.set(1, 0.6, 0.5);
    cheekL.position.set(-0.21, 0.38, 0.33);
    avatar.add(cheekL);
    const cheekR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), cheekMat);
    cheekR.scale.set(1, 0.6, 0.5);
    cheekR.position.set(0.21, 0.38, 0.33);
    avatar.add(cheekR);

    // Species-Specific 3D Details
    if (characterId === 'munch') {
      // Four Leaf Clover on Top
      const leafGeo = new THREE.SphereGeometry(0.14, 16, 16);
      leafGeo.scale(1, 0.3, 1.3);
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.Mesh(leafGeo, bodyMat);
        leaf.position.set(0, 0.88, 0);
        leaf.rotation.y = (i * Math.PI) / 2;
        leaf.rotation.x = 0.35;
        avatar.add(leaf);
      }
    } else if (characterId === 'ollie') {
      // Owl Horns/Ears & Beak
      const hornGeo = new THREE.ConeGeometry(0.1, 0.22, 12);
      const hornL = new THREE.Mesh(hornGeo, bodyMat);
      hornL.position.set(-0.24, 0.85, 0.05);
      hornL.rotation.z = 0.25;
      avatar.add(hornL);
      const hornR = new THREE.Mesh(hornGeo, bodyMat);
      hornR.position.set(0.24, 0.85, 0.05);
      hornR.rotation.z = -0.25;
      avatar.add(hornR);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0xffe08a }));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.39, 0.42);
      avatar.add(beak);
    } else if (characterId === 'ellie') {
      // Big Ears & Trunk
      const earGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.05, 24);
      const earL = new THREE.Mesh(earGeo, bodyMat);
      earL.position.set(-0.48, 0.5, -0.05);
      earL.rotation.y = 0.4;
      avatar.add(earL);
      const earR = new THREE.Mesh(earGeo, bodyMat);
      earR.position.set(0.48, 0.5, -0.05);
      earR.rotation.y = -0.4;
      avatar.add(earR);
      const trunk = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 12, 24, Math.PI), bodyMat);
      trunk.position.set(0, 0.32, 0.36);
      trunk.rotation.x = Math.PI / 2;
      avatar.add(trunk);
    } else if (characterId === 'pandy') {
      // Panda Ears & Patches
      const earGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const earL = new THREE.Mesh(earGeo, eyeMat);
      earL.position.set(-0.28, 0.82, 0);
      avatar.add(earL);
      const earR = new THREE.Mesh(earGeo, eyeMat);
      earR.position.set(0.28, 0.82, 0);
      avatar.add(earR);
      bodyMesh.material = whiteMat;
    } else if (characterId === 'dobby') {
      // Puppy Droopy Ears & Snout
      const earGeo = new THREE.CylinderGeometry(0.08, 0.14, 0.35, 12);
      const earL = new THREE.Mesh(earGeo, new THREE.MeshStandardMaterial({ color: 0xa77a50 }));
      earL.position.set(-0.38, 0.52, 0.08);
      earL.rotation.z = 0.5;
      avatar.add(earL);
      const earR = new THREE.Mesh(earGeo, new THREE.MeshStandardMaterial({ color: 0xa77a50 }));
      earR.position.set(0.38, 0.52, 0.08);
      earR.rotation.z = -0.5;
      avatar.add(earR);
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), whiteMat);
      snout.position.set(0, 0.35, 0.38);
      avatar.add(snout);
    } else if (characterId === 'coco') {
      // Pointy Cat Ears
      const earGeo = new THREE.ConeGeometry(0.14, 0.25, 12);
      const earL = new THREE.Mesh(earGeo, bodyMat);
      earL.position.set(-0.24, 0.85, 0.05);
      earL.rotation.z = 0.3;
      avatar.add(earL);
      const earR = new THREE.Mesh(earGeo, bodyMat);
      earR.position.set(0.24, 0.85, 0.05);
      earR.rotation.z = -0.3;
      avatar.add(earR);
    } else if (characterId === 'froggy') {
      // Elevated Frog Eyes
      const eyeBulgeGeo = new THREE.SphereGeometry(0.14, 16, 16);
      const bulgeL = new THREE.Mesh(eyeBulgeGeo, bodyMat);
      bulgeL.position.set(-0.25, 0.72, 0.1);
      avatar.add(bulgeL);
      const bulgeR = new THREE.Mesh(eyeBulgeGeo, bodyMat);
      bulgeR.position.set(0.25, 0.72, 0.1);
      avatar.add(bulgeR);
      eyeL.position.set(-0.25, 0.74, 0.22);
      eyeR.position.set(0.25, 0.74, 0.22);
    } else if (characterId === 'bubbles') {
      // Fish Dorsal & Tail Fin
      const finGeo = new THREE.ConeGeometry(0.12, 0.3, 12);
      const dorsal = new THREE.Mesh(finGeo, new THREE.MeshStandardMaterial({ color: 0xffe08a }));
      dorsal.position.set(0, 0.88, -0.05);
      dorsal.rotation.x = -0.4;
      avatar.add(dorsal);
      const tail = new THREE.Mesh(finGeo, new THREE.MeshStandardMaterial({ color: 0xffe08a }));
      tail.position.set(0, 0.42, -0.48);
      tail.rotation.x = Math.PI / 2;
      avatar.add(tail);
    } else if (characterId === 'chicky') {
      // Comb & Beak
      const comb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshStandardMaterial({ color: 0xff8e8e }));
      comb.scale.set(0.5, 1.4, 0.8);
      comb.position.set(0, 0.88, 0.05);
      avatar.add(comb);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xffa726 }));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.38, 0.42);
      avatar.add(beak);
    }

    return avatar;
  }

  private setupEventListeners() {
    window.addEventListener('resize', this.onWindowResize);
    this.container.addEventListener('mousemove', this.onMouseMove);
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = Math.max(this.container.clientHeight, 1);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.isReducedMotion) return;
    const rect = this.container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    this.mouse.targetX = x * 1.5;
    this.mouse.targetY = y * 1.0;
  };

  // State & Lighting Updates
  public updateTheme(isDark: boolean) {
    this.isDarkTheme = isDark;
    this.updateBackgroundTheme(isDark);

    if (this.ambientLight) {
      this.ambientLight.color.setHex(isDark ? 0x6a7d9b : 0xfff2e0);
      this.ambientLight.intensity = isDark ? 0.7 : 1.2;
    }
    if (this.mainLight) {
      this.mainLight.color.setHex(isDark ? 0x93b4ff : 0xfff6ea);
      this.mainLight.intensity = isDark ? 1.0 : 1.6;
    }
    if (this.tableSpotlight) {
      this.tableSpotlight.color.setHex(isDark ? 0x8fd9a8 : 0xffe08a);
      this.tableSpotlight.intensity = isDark ? 1.5 : 1.8;
    }
  }

  public setReducedMotion(reduced: boolean) {
    this.isReducedMotion = reduced;
  }

  public setCameraMode(mode: CameraViewMode) {
    this.cameraViewMode = mode;
    if (mode === 'overview') {
      this.targetCameraPos.set(0, 5.5, 7.5);
      this.targetLookAt.set(0, 0.5, 0);
    } else if (mode === 'user_pov') {
      // Seated right at User Seat position looking directly across table
      this.targetCameraPos.set(0, 1.7, -3.2);
      this.targetLookAt.set(0, 1.2, 1.5);
    } else if (mode === 'speaker' && this.activeSpeakerId && this.activeSpeakerId !== 'user') {
      const seat = this.seats.find(s => s.characterId === this.activeSpeakerId);
      if (seat) {
        // Position camera to frame speaker warmly
        const dir = seat.position.clone().normalize();
        this.targetCameraPos.set(dir.x * 5.0, 3.8, dir.z * 5.0);
        this.targetLookAt.copy(seat.position).add(new THREE.Vector3(0, 0.6, 0));
      }
    }
  }

  public setActiveSpeaker(speakerId: MascotCharacter | 'user' | null) {
    this.activeSpeakerId = speakerId;

    // Reset previous halos
    for (const [charId, group] of this.characterMeshes.entries()) {
      const halo = group.getObjectByName('halo') as THREE.Mesh;
      if (halo && halo.material instanceof THREE.MeshBasicMaterial) {
        halo.material.opacity = charId === speakerId ? 0.85 : 0;
      }
    }

    // Update speaker spotlight
    if (speakerId && speakerId !== 'user') {
      const seat = this.seats.find(s => s.characterId === speakerId);
      if (seat) {
        this.speakerLight.position.set(seat.position.x, 2.2, seat.position.z);
        this.speakerLight.intensity = 2.5;
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

  // Animation Loop
  private startAnimationLoop() {
    const render = () => {
      this.animationFrameId = requestAnimationFrame(render);
      const delta = Math.min(this.clock.getDelta(), 0.1);
      const time = this.clock.getElapsedTime();

      // 1. Mouse Parallax Smoothing
      this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
      this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

      // 2. Camera Damping
      if (!this.isReducedMotion) {
        const parallaxOffset = new THREE.Vector3(this.mouse.x * 0.8, -this.mouse.y * 0.4, 0);
        const desiredPos = this.targetCameraPos.clone().add(parallaxOffset);
        this.camera.position.lerp(desiredPos, 0.04);
      } else {
        this.camera.position.lerp(this.targetCameraPos, 0.06);
      }

      this.currentLookAt.lerp(this.targetLookAt, 0.05);
      this.camera.lookAt(this.currentLookAt);

      // 3. Characters Animation
      for (const [charId, group] of this.characterMeshes.entries()) {
        const body = group.getObjectByName('avatar_body');
        if (!body) continue;

        const state = this.characterStates.get(charId) || 'idle';
        const reaction = this.characterReactions.get(charId);
        const isSpeaking = this.activeSpeakerId === charId;

        // Base breathing bob
        if (!this.isReducedMotion) {
          const seat = this.seats.find(s => s.characterId === charId);
          const phase = (seat?.angle || 0) * 2;
          const bob = Math.sin(time * 2.5 + phase) * 0.025;

          if (isSpeaking || state === 'speaking') {
            // Speaking rhythm
            body.position.y = 0.42 + Math.abs(Math.sin(time * 8)) * 0.07;
            body.rotation.y = Math.sin(time * 4) * 0.08;
            body.scale.set(1 + Math.sin(time * 8) * 0.04, 1 - Math.sin(time * 8) * 0.03, 1);
          } else if (reaction === 'nod' || reaction === 'agree') {
            // Nodding gesture
            body.position.y = 0.42 + Math.sin(time * 7) * 0.05;
            body.rotation.x = Math.sin(time * 7) * 0.15;
          } else if (reaction === 'cheer' || reaction === 'laugh') {
            // Bouncy cheer
            body.position.y = 0.42 + Math.abs(Math.sin(time * 9)) * 0.12;
            body.rotation.z = Math.sin(time * 6) * 0.1;
          } else if (reaction === 'surprised' || state === 'interrupted') {
            // Recoil
            body.position.y = 0.48;
            body.rotation.x = -0.15;
          } else if (state === 'thinking') {
            body.position.y = 0.46 + Math.sin(time * 1.5) * 0.02;
            body.rotation.z = 0.1;
          } else {
            // Normal gentle breathing
            body.position.y = 0.42 + bob;
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
    this.container.removeEventListener('mousemove', this.onMouseMove);

    // Dispose geometries, materials, and renderer
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
