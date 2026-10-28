import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Project,
  Building,
  Floor,
  Apartment,
  TourManifest,
  FloorPlanRoom,
} from '../types/property';
import { formatPriceDisplay, validateExternalTourUrl } from '../utils/propertyLogic';
import { InteractiveFloorPlan, ArchitecturalVisual } from './ArchitecturalVisual';

interface VirtualTour3DProps {
  project: Project;
  building: Building;
  floor: Floor;
  apartment: Apartment;
  manifest?: TourManifest;
  initialRoomId?: string;
  onExitTour: () => void;
  onOpenInquiry: (mode: 'property_details' | 'site_visit_request') => void;
}

type ViewMode = 'interior' | 'dollhouse';
type LightingPreset = 'daylight' | 'golden_hour' | 'evening';

// Pre-allocated module-scope math helpers (Zero GC in render loop)
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();

function createProceduralStoneTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#F2F5FA';
    ctx.fillRect(0, 0, 256, 256);
    // Subtle architectural stone slab joints
    ctx.strokeStyle = '#D5DCE8';
    ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    for (let x = 0; x < 256; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    ctx.fillStyle = '#E9EDF4';
    for (let i = 0; i < 180; i++) {
      const rx = (i * 73) % 256;
      const ry = (i * 41) % 256;
      ctx.fillRect(rx, ry, 6, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function createProceduralArchitecturalPlankTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#E4E9F2';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#CBD3E1';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

export const VirtualTour3D: React.FC<VirtualTour3DProps> = ({
  project,
  building,
  floor,
  apartment,
  manifest,
  initialRoomId,
  onExitTour,
  onOpenInquiry,
}) => {
  const rooms = apartment.rooms;
  const startingRoom = rooms.find((r) => r.id === initialRoomId) || rooms[0];
  const [selectedRoom, setSelectedRoom] = useState<FloorPlanRoom>(startingRoom);
  const [viewMode, setViewMode] = useState<ViewMode>('interior');
  const [lighting, setLighting] = useState<LightingPreset>('daylight');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'floorplan' | 'specs' | 'help'>('none');
  const [webglError, setWebglError] = useState<string | null>(null);
  const [tourReady, setTourReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const viewportRootRef = useRef<HTMLDivElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Store mutable targets in refs so HUD interactions never tear down WebGL
  const desiredCameraPosRef = useRef<[number, number, number]>(startingRoom.cameraPos);
  const desiredCameraTargetRef = useRef<[number, number, number]>(startingRoom.cameraTarget);
  const isTransitioningRef = useRef<boolean>(false);
  const requestRenderRef = useRef<(() => void) | null>(null);
  const applyLightingRef = useRef<((preset: LightingPreset) => void) | null>(null);
  const applyViewModeRef = useRef<((mode: ViewMode) => void) | null>(null);
  const onSelectRoomRef = useRef<(room: FloorPlanRoom) => void>(() => {});

  const handleSelectRoom = useCallback((room: FloorPlanRoom) => {
    setSelectedRoom(room);
    setViewMode('interior');
    desiredCameraPosRef.current = room.cameraPos;
    desiredCameraTargetRef.current = room.cameraTarget;
    isTransitioningRef.current = true;
    applyViewModeRef.current?.('interior');
    requestRenderRef.current?.();
  }, []);

  onSelectRoomRef.current = handleSelectRoom;

  const handleToggleViewMode = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      if (mode === 'dollhouse') {
        desiredCameraPosRef.current = [0.0, 9.5, 9.8];
        desiredCameraTargetRef.current = [0.0, 0.5, 0.0];
      } else {
        desiredCameraPosRef.current = selectedRoom.cameraPos;
        desiredCameraTargetRef.current = selectedRoom.cameraTarget;
      }
      isTransitioningRef.current = true;
      applyViewModeRef.current?.(mode);
      requestRenderRef.current?.();
    },
    [selectedRoom]
  );

  const handleLightingChange = useCallback((preset: LightingPreset) => {
    setLighting(preset);
    applyLightingRef.current?.(preset);
    requestRenderRef.current?.();
  }, []);

  // Keyboard shortcut 'H' for Collapsible Dock and Escape to close drawers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (activeDrawer !== 'none') {
          setActiveDrawer('none');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDrawer]);

  const isTourPublished = manifest && manifest.captureStatus === 'published';
  const isExternalProvider =
    isTourPublished &&
    (manifest.provider === 'matterport_embed' || manifest.provider === 'custom_webgl');

  useEffect(() => {
    if (!isTourPublished || isExternalProvider) return;
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    let frameId = 0;
    let isDisposed = false;

    // 1. Detect software WebGL (SwiftShader / llvmpipe) per threejs skill
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL 3D acceleration is unavailable on this browser or device.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = mountEl.clientWidth || window.innerWidth;
    const height = mountEl.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe9edf4);
    scene.fog = new THREE.FogExp2(0xe9edf4, 0.018);

    // 2. Studio Environment Map via RoomEnvironment + PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 120);
    camera.position.set(...desiredCameraPosRef.current);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...desiredCameraTargetRef.current);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 1.2;
    controls.maxDistance = 22;
    controls.update();

    // 3. Studio 3-Point Daylight Architectural Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8a95a8, 0.78);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(-8, 12, 9);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -10;
      keyLight.shadow.camera.right = 10;
      keyLight.shadow.camera.top = 10;
      keyLight.shadow.camera.bottom = -10;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdbe6ff, 0.5);
    rimLight.position.set(9, 8, -9);
    scene.add(rimLight);

    const interiorLight1 = new THREE.PointLight(0xf5f8ff, 0.55, 9);
    interiorLight1.position.set(-2.4, 2.7, 0.2);
    scene.add(interiorLight1);

    const interiorLight2 = new THREE.PointLight(0xf5f8ff, 0.55, 9);
    interiorLight2.position.set(2.4, 2.7, -0.5);
    scene.add(interiorLight2);

    // 4. Procedural Textures & Calibrated Contemporary Luxury PBR Materials
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const stoneTex = createProceduralStoneTexture();
    stoneTex.anisotropy = maxAnisotropy;
    const plankTex = createProceduralArchitecturalPlankTexture();
    plankTex.anisotropy = maxAnisotropy;

    const stoneFloorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: stoneTex,
      roughness: 0.52,
      metalness: 0.05,
    });
    const suiteFloorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: plankTex,
      roughness: 0.55,
      metalness: 0.04,
    });
    const architecturalWallMat = new THREE.MeshStandardMaterial({
      color: 0xeef2f8,
      roughness: 0.8,
      metalness: 0.02,
    });
    const charcoalFrameMat = new THREE.MeshStandardMaterial({
      color: 0x17191d,
      roughness: 0.3,
      metalness: 0.78,
    });
    const whiteUpholsteryMat = new THREE.MeshStandardMaterial({
      color: 0xdce3ef,
      roughness: 0.85,
      metalness: 0.02,
    });
    const monolithStoneMat = new THREE.MeshStandardMaterial({
      color: 0x222731,
      roughness: 0.28,
      metalness: 0.14,
    });
    const architecturalJoineryMat = new THREE.MeshStandardMaterial({
      color: 0x323946,
      roughness: 0.58,
      metalness: 0.1,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xdce6f7,
      transparent: true,
      opacity: isSoftwareGl ? 0.26 : 0.34,
      roughness: 0.1,
      metalness: 0.1,
      depthWrite: false,
    });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x263244,
      roughness: 0.82,
      metalness: 0.02,
    });

    // 5. Build Multi-Room Architectural Residence Hierarchy (Composite THREE.Groups)
    const residenceGroup = new THREE.Group();
    scene.add(residenceGroup);

    // Surround Plaza Ground Plane (y = -0.15)
    const plazaGround = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0xdce2ec, roughness: 0.9 })
    );
    plazaGround.rotation.x = -Math.PI / 2;
    plazaGround.position.y = -0.15;
    scene.add(plazaGround);

    // Disjoint Floor Slabs (y >= 0.02 offsets so coplanar surfaces never Z-fight)
    const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.14, 9.6), charcoalFrameMat);
    basePlinth.position.set(0, -0.07, 0);
    residenceGroup.add(basePlinth);

    const mainStoneFloor = new THREE.Mesh(
      new THREE.BoxGeometry(11.2, 0.04, 9.2),
      stoneFloorMat
    );
    mainStoneFloor.position.set(0, 0.02, 0);
    mainStoneFloor.receiveShadow = true;
    residenceGroup.add(mainStoneFloor);

    // Primary Suite Flooring Zone (offset y = 0.05)
    const bedroomFloor = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.02, 3.8),
      suiteFloorMat
    );
    bedroomFloor.position.set(2.8, 0.05, -2.2);
    residenceGroup.add(bedroomFloor);

    // Living Salon Cool Grey Architectural Rug (offset y = 0.055)
    const salonRug = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.015, 2.8),
      new THREE.MeshStandardMaterial({ color: 0xe9edf4, roughness: 0.92 })
    );
    salonRug.position.set(-2.4, 0.055, -0.4);
    residenceGroup.add(salonRug);

    // Structural Walls & Partition Dividers
    const wallHeight = 3.1;
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(11.2, wallHeight, 0.22),
      architecturalWallMat
    );
    backWall.position.set(0, wallHeight / 2, -4.5);
    residenceGroup.add(backWall);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, wallHeight, 9.2),
      architecturalWallMat
    );
    leftWall.position.set(-5.5, wallHeight / 2, 0);
    residenceGroup.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, wallHeight, 9.2),
      architecturalWallMat
    );
    rightWall.position.set(5.5, wallHeight / 2, 0);
    residenceGroup.add(rightWall);

    // Interior Architectural Partition (dividing Kitchen & Primary Suite)
    const suitePartition = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, wallHeight, 0.18),
      architecturalWallMat
    );
    suitePartition.position.set(2.9, wallHeight / 2, -0.2);
    residenceGroup.add(suitePartition);

    // Central Foyer Portal Columns
    for (const cx of [-0.6, 0.6]) {
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, wallHeight, 0.28),
        charcoalFrameMat
      );
      col.position.set(cx, wallHeight / 2, -1.6);
      residenceGroup.add(col);
    }

    // Panoramic Steel Curtain Wall (South-West Window Wall separating Salon & Terrace at z = 1.8)
    const mullionPositions = [-5.2, -3.5, -1.8, -0.1, 1.8, 3.6, 5.2];
    for (const mx of mullionPositions) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, wallHeight, 0.12),
        charcoalFrameMat
      );
      post.position.set(mx, wallHeight / 2, 1.8);
      residenceGroup.add(post);
    }
    const transomTop = new THREE.Mesh(
      new THREE.BoxGeometry(11.0, 0.12, 0.14),
      charcoalFrameMat
    );
    transomTop.position.set(0, wallHeight - 0.06, 1.8);
    residenceGroup.add(transomTop);

    const windowGlass = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, wallHeight - 0.2, 0.04),
      glassMat
    );
    windowGlass.position.set(0, wallHeight / 2, 1.8);
    windowGlass.renderOrder = 2;
    residenceGroup.add(windowGlass);

    // Ceiling Soffit Group (hidden in Dollhouse mode so user can inspect interior from above)
    const ceilingGroup = new THREE.Group();
    const ceilingSlab = new THREE.Mesh(
      new THREE.BoxGeometry(11.4, 0.16, 6.6),
      architecturalWallMat
    );
    ceilingSlab.position.set(0, wallHeight + 0.08, -1.3);
    ceilingGroup.add(ceilingSlab);
    residenceGroup.add(ceilingGroup);

    // COMPOSITE GROUP 1: Living & Salon Atelier Furniture
    const livingGroup = new THREE.Group();
    livingGroup.position.set(-2.4, 0.06, -0.5);
    const sofaBaseMain = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.36, 0.95),
      whiteUpholsteryMat
    );
    sofaBaseMain.position.set(0, 0.18, -0.8);
    livingGroup.add(sofaBaseMain);
    const sofaBackMain = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.44, 0.22),
      whiteUpholsteryMat
    );
    sofaBackMain.position.set(0, 0.56, -1.16);
    livingGroup.add(sofaBackMain);
    const sofaChaise = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.36, 1.8),
      whiteUpholsteryMat
    );
    sofaChaise.position.set(-0.92, 0.18, -0.35);
    livingGroup.add(sofaChaise);
    const coffeeTablePlinth = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.28, 0.8),
      stoneFloorMat
    );
    coffeeTablePlinth.position.set(0.35, 0.14, 0.25);
    livingGroup.add(coffeeTablePlinth);
    const coffeeTableTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.05, 0.92),
      monolithStoneMat
    );
    coffeeTableTop.position.set(0.35, 0.3, 0.25);
    livingGroup.add(coffeeTableTop);
    const lampStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.05, 1.85, 12),
      charcoalFrameMat
    );
    lampStem.position.set(-1.6, 0.92, -1.1);
    livingGroup.add(lampStem);
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.32, 16),
      monolithStoneMat
    );
    lampShade.position.set(-1.6, 1.85, -1.1);
    livingGroup.add(lampShade);
    residenceGroup.add(livingGroup);

    // COMPOSITE GROUP 2: Kitchen & Dining Atelier
    const kitchenGroup = new THREE.Group();
    kitchenGroup.position.set(2.6, 0.06, 0.85);
    const islandBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.86, 1.0),
      architecturalJoineryMat
    );
    islandBase.position.set(0, 0.43, 0);
    kitchenGroup.add(islandBase);
    const islandCounter = new THREE.Mesh(
      new THREE.BoxGeometry(2.72, 0.08, 1.12),
      whiteUpholsteryMat
    );
    islandCounter.position.set(0, 0.9, 0);
    kitchenGroup.add(islandCounter);
    const faucetStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.35, 10),
      charcoalFrameMat
    );
    faucetStem.position.set(-0.4, 1.1, -0.2);
    kitchenGroup.add(faucetStem);
    for (const sx of [-0.8, 0.0, 0.8]) {
      const stoolSeat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.18, 0.62, 14),
        architecturalJoineryMat
      );
      stoolSeat.position.set(sx, 0.31, 0.72);
      kitchenGroup.add(stoolSeat);
    }
    const cabinetryWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 2.5, 2.4),
      architecturalJoineryMat
    );
    cabinetryWall.position.set(2.4, 1.25, 0.0);
    kitchenGroup.add(cabinetryWall);
    residenceGroup.add(kitchenGroup);

    // COMPOSITE GROUP 3: Primary Bedroom Sanctuary
    const bedroomGroup = new THREE.Group();
    bedroomGroup.position.set(2.8, 0.06, -2.5);
    const bedFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.28, 2.2),
      architecturalJoineryMat
    );
    bedFrame.position.set(0, 0.14, 0);
    bedroomGroup.add(bedFrame);
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.24, 2.0),
      whiteUpholsteryMat
    );
    mattress.position.set(0, 0.38, 0.02);
    bedroomGroup.add(mattress);
    const headboard = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.15, 0.14),
      architecturalJoineryMat
    );
    headboard.position.set(0, 0.58, -1.12);
    bedroomGroup.add(headboard);
    for (const nx of [-1.35, 1.35]) {
      const nightstand = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.48, 0.42),
        stoneFloorMat
      );
      nightstand.position.set(nx, 0.24, -0.88);
      bedroomGroup.add(nightstand);
    }
    residenceGroup.add(bedroomGroup);

    // COMPOSITE GROUP 4: Cantilevered Stone Loggia & Planters
    const terraceGroup = new THREE.Group();
    terraceGroup.position.set(0, 0.06, 3.2);
    const glassBalustrade = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, 1.05, 0.04),
      glassMat
    );
    glassBalustrade.position.set(0, 0.52, 1.25);
    glassBalustrade.renderOrder = 3;
    terraceGroup.add(glassBalustrade);
    const handrail = new THREE.Mesh(
      new THREE.BoxGeometry(11.0, 0.06, 0.08),
      charcoalFrameMat
    );
    handrail.position.set(0, 1.06, 1.25);
    terraceGroup.add(handrail);

    for (const px of [-4.4, 0.0, 4.4]) {
      const planterBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.55, 0.9),
        stoneFloorMat
      );
      planterBox.position.set(px, 0.28, 0.7);
      terraceGroup.add(planterBox);
      const cypressCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.36, 1.9, 12),
        foliageMat
      );
      cypressCone.position.set(px, 1.45, 0.7);
      terraceGroup.add(cypressCone);
    }
    residenceGroup.add(terraceGroup);

    // 6. Interactive 3D Room Hotspots in Cobalt Blue (#2855E8) (Raycast Layer 1)
    const hotspotMeshes: THREE.Mesh[] = [];
    const hotspotGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.06, 24);
    const hotspotRingGeo = new THREE.RingGeometry(0.36, 0.44, 24);
    hotspotRingGeo.rotateX(-Math.PI / 2);

    rooms.forEach((rm) => {
      const markerMat = new THREE.MeshStandardMaterial({
        color: 0x2855e8,
        roughness: 0.28,
        metalness: 0.35,
      });
      const marker = new THREE.Mesh(hotspotGeo, markerMat);
      marker.position.set(rm.cameraTarget[0], 0.09, rm.cameraTarget[2]);
      marker.layers.enable(1);
      marker.userData = { room: rm };
      residenceGroup.add(marker);
      hotspotMeshes.push(marker);

      const ring = new THREE.Mesh(
        hotspotRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0x17191d,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      );
      ring.position.set(rm.cameraTarget[0], 0.075, rm.cameraTarget[2]);
      residenceGroup.add(ring);
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 7. On-Demand Coalesced Render + Software-WebGL Pacing (`afterDraw`)
    let renderBusy = false;
    let renderDirty = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (isDisposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function requestRender() {
      if (isDisposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (isDisposed) return;
        renderDirty = false;
        const dt = Math.min(clock.getDelta(), 0.1);

        if (isTransitioningRef.current) {
          _targetPos.set(...desiredCameraPosRef.current);
          _targetLook.set(...desiredCameraTargetRef.current);

          const alpha = isSoftwareGl ? 0.45 : 1 - Math.exp(-7.5 * dt);
          camera.position.lerp(_targetPos, alpha);
          controls.target.lerp(_targetLook, alpha);

          if (
            camera.position.distanceToSquared(_targetPos) < 0.002 &&
            controls.target.distanceToSquared(_targetLook) < 0.002
          ) {
            camera.position.copy(_targetPos);
            controls.target.copy(_targetLook);
            isTransitioningRef.current = false;
          } else {
            renderDirty = true;
          }
        }

        controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;

    applyViewModeRef.current = (mode: ViewMode) => {
      ceilingGroup.visible = mode === 'interior';
    };

    applyLightingRef.current = (preset: LightingPreset) => {
      if (preset === 'daylight') {
        scene.background = new THREE.Color(0xe9edf4);
        scene.fog = new THREE.FogExp2(0xe9edf4, 0.018);
        keyLight.color.setHex(0xffffff);
        keyLight.intensity = 1.85;
        hemiLight.intensity = 0.95;
      } else if (preset === 'golden_hour') {
        scene.background = new THREE.Color(0xdce2ec);
        scene.fog = new THREE.FogExp2(0xdce2ec, 0.022);
        keyLight.color.setHex(0xf2f5fa);
        keyLight.intensity = 1.45;
        hemiLight.intensity = 0.78;
      } else {
        scene.background = new THREE.Color(0x17191d);
        scene.fog = new THREE.FogExp2(0x17191d, 0.03);
        keyLight.color.setHex(0x88aacc);
        keyLight.intensity = 0.55;
        hemiLight.intensity = 0.35;
      }
    };

    const onControlStart = () => {
      isTransitioningRef.current = false;
    };
    const onControlChange = () => {
      requestRender();
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', onControlChange);

    // Raycast click on 3D room hotspots
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hotspotMeshes, false);
      if (hits.length > 0) {
        const hitRoom = hits[0].object.userData.room as FloorPlanRoom | undefined;
        if (hitRoom) {
          onSelectRoomRef.current(hitRoom);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!mountEl || isDisposed) return;
      const w = mountEl.clientWidth || window.innerWidth;
      const h = mountEl.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    // WebGL context loss safety
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('WebGL rendering context was interrupted. Use the interactive floor plan below.');
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    requestRender();
    setTourReady(true);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlChange);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      stoneTex.dispose();
      plankTex.dispose();
      envTarget.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [isTourPublished, isExternalProvider, rooms]);

  // Fallback / Unavailable Tour State (Journey B: Never show a fake tour when uncaptured)
  if (!isTourPublished) {
    return (
      <div className="min-h-screen bg-white text-[#17191D] flex flex-col">
        <header className="flex items-center justify-between gap-6 px-6 py-4 bg-white border-b border-[#E9EDF4]">
          <div className="text-xs font-mono text-[#525866]">
            {project.name} <span aria-hidden="true">→</span> {building.name}{' '}
            <span aria-hidden="true">→</span> {floor.label} <span aria-hidden="true">→</span>{' '}
            <strong className="text-[#17191D]">Unit {apartment.unitCode}</strong>
          </div>
          <button
            type="button"
            onClick={onExitTour}
            className="px-4 py-2 text-xs font-medium bg-[#17191D] text-white hover:bg-[#2855E8] arch-transition whitespace-nowrap shrink-0"
          >
            Return to Apartment Details
          </button>
        </header>

        <main className="max-w-6xl mx-auto w-full px-6 py-10 space-y-8">
          <div className="border border-[#E9EDF4] bg-[#E9EDF4]/35 p-8">
            <div className="text-xs font-mono text-[#2855E8]">
              3D CAPTURE STATUS: {(manifest?.captureStatus || 'not_captured').toUpperCase().replace(/_/g, ' ')}
            </div>
            <h1 className="text-3xl font-semibold text-[#17191D] mt-2">
              3D Digital Twin Not Yet Published for Residence {apartment.unitCode}
            </h1>
            <p className="mt-3 text-base text-[#525866] max-w-3xl leading-relaxed">
              {manifest?.reviewerNotes ||
                'This residence does not yet have an approved 3D scan published for public walkthrough. In accordance with our verification standards, we provide the interactive 2D architectural floor plan and verified specification dossier below rather than an unverified simulation.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onOpenInquiry('site_visit_request')}
                className="px-5 py-2.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] arch-transition whitespace-nowrap shrink-0"
              >
                Request On-Site Architectural Viewing
              </button>
              <button
                type="button"
                onClick={() => onOpenInquiry('property_details')}
                className="px-5 py-2.5 text-xs font-medium border border-[#17191D] text-[#17191D] bg-white hover:bg-[#E9EDF4] arch-transition whitespace-nowrap shrink-0"
              >
                Request Capture Notification &amp; Dossier
              </button>
            </div>
          </div>

          <InteractiveFloorPlan
            rooms={apartment.rooms}
            selectedRoomId={selectedRoom.id}
            onSelectRoom={setSelectedRoom}
            unitCode={apartment.unitCode}
            areaSqm={apartment.areaSqm}
            areaConvention={apartment.areaConvention}
            synchronizedWith3D={false}
          />
        </main>
      </div>
    );
  }

  const externalValidation = isExternalProvider
    ? validateExternalTourUrl(manifest.externalEmbedUrl, manifest.provider)
    : { valid: true };

  const toggleFullscreen = () => {
    const el = viewportRootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={viewportRootRef}
      className="relative w-screen h-screen overflow-hidden bg-[#17191D] text-white select-none"
      data-testid="virtual-tour-viewport"
      data-tour-state={tourReady ? 'ready' : 'initializing'}
      data-active-room={selectedRoom.id}
      data-view-mode={viewMode}
    >
      {/* 1. Isolated WebGL Canvas Mount Container (100% Unobstructed Center) */}
      {!isExternalProvider && !webglError ? (
        <div
          ref={canvasMountRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          aria-label={`Interactive 3D Virtual Tour of ${apartment.title}`}
        />
      ) : isExternalProvider && externalValidation.valid ? (
        <iframe
          src={manifest.externalEmbedUrl}
          title={`Hosted 3D Tour for ${apartment.title}`}
          className="w-full h-full border-0"
          allow="fullscreen; xr-spatial-tracking"
        />
      ) : (
        <div className="w-full h-full overflow-y-auto bg-white text-[#17191D] p-8 pt-24">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="p-6 border border-[#E9EDF4] bg-[#E9EDF4]/40">
              <p className="text-xs font-mono text-[#2855E8]">FALLBACK ARCHITECTURAL VIEWER</p>
              <h2 className="text-2xl font-semibold mt-1">
                {webglError || externalValidation.reason || 'Interactive 2D Floor Plan & Elevation Mode'}
              </h2>
              <p className="text-sm text-[#525866] mt-2">
                Explore the verified floor plate and room specifications below.
              </p>
            </div>
            <InteractiveFloorPlan
              rooms={apartment.rooms}
              selectedRoomId={selectedRoom.id}
              onSelectRoom={setSelectedRoom}
              unitCode={apartment.unitCode}
              areaSqm={apartment.areaSqm}
              areaConvention={apartment.areaConvention}
            />
          </div>
        </div>
      )}

      {/* 2. Top Architectural HUD Header (Near Black + Pure White + Cobalt Blue Accent) */}
      <header className="absolute top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 bg-[#17191D]/92 backdrop-blur-md border-b border-white/15">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className="font-display text-base font-semibold text-white tracking-tight mr-1">
            Veridian 3D Twin
          </span>
          <span aria-hidden="true" className="text-white/25">|</span>
          <span className="font-mono text-[#9BA3B4]">{project.name}</span>
          <span aria-hidden="true" className="text-white/30">·</span>
          <span className="font-mono text-[#9BA3B4]">{building.name}</span>
          <span aria-hidden="true" className="text-white/30">·</span>
          <span className="font-mono text-[#9BA3B4]">Level 0{floor.floorNumber}</span>
          <span aria-hidden="true" className="text-white/30">·</span>
          <span className="font-semibold text-white">Residence {apartment.unitCode}</span>
          <span aria-hidden="true" className="text-white/30">→</span>
          <span className="font-mono text-[#E9EDF4]">
            {viewMode === 'dollhouse' ? '3D Dollhouse Cutaway' : selectedRoom.name}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="hidden xl:inline text-xs font-mono text-[#9BA3B4] tabular-nums mr-1">
            {apartment.areaSqm} sq.m · {apartment.orientation} ·{' '}
            {formatPriceDisplay(apartment.priceStatus, apartment.priceAmount, apartment.currency)}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:inline-flex px-3 py-1.5 text-xs font-mono bg-white/5 text-[#E9EDF4] hover:bg-white/15 border border-white/15 arch-transition whitespace-nowrap shrink-0"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
          <button
            type="button"
            onClick={() => onOpenInquiry('site_visit_request')}
            className="px-4 py-1.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] arch-transition whitespace-nowrap shrink-0"
          >
            Schedule Site Visit
          </button>
          <button
            type="button"
            onClick={onExitTour}
            className="px-4 py-1.5 text-xs font-medium bg-white text-[#17191D] hover:bg-[#E9EDF4] arch-transition whitespace-nowrap shrink-0"
          >
            Exit 3D Tour
          </button>
        </div>
      </header>

      {/* 3. Subtle Floating Spatial Context Card (Top-Left below header) */}
      {activeDrawer === 'none' && !dockCollapsed && (
        <div className="hidden lg:flex absolute top-20 left-6 z-10 flex-col gap-1.5 p-4 bg-[#17191D]/90 backdrop-blur-md border border-white/15 max-w-xs pointer-events-auto">
          <div className="flex items-center justify-between gap-4 text-[11px] font-mono text-[#E9EDF4]">
            <span>{viewMode === 'dollhouse' ? 'AXONOMETRIC CUTAWAY' : 'ACTIVE ZONE'}</span>
            <span className="tabular-nums">{selectedRoom.areaSqm} m²</span>
          </div>
          <div className="text-lg font-display font-semibold text-white">
            {viewMode === 'dollhouse' ? `Full Floor Plate · Unit ${apartment.unitCode}` : selectedRoom.name}
          </div>
          <p className="text-xs text-[#9BA3B4] leading-relaxed">
            {selectedRoom.finishSummary}
          </p>
          <div className="pt-2 mt-1 border-t border-white/15 flex items-center justify-between text-[11px] font-mono text-[#9BA3B4]">
            <span>SPAN: {selectedRoom.dimensionsLabel}</span>
            <button
              type="button"
              onClick={() => setActiveDrawer('floorplan')}
              className="text-white underline hover:text-[#E9EDF4]"
            >
              Open 2D CAD Plan
            </button>
          </div>
        </div>
      )}

      {/* 4. Active Contextual Drawer (Floor Plan / Property Specs / Controls Guide) */}
      {activeDrawer !== 'none' && (
        <div
          className="absolute inset-x-4 top-16 bottom-28 z-30 max-w-5xl mx-auto bg-[#17191D]/98 text-white border border-white/20 shadow-2xl overflow-y-auto p-6 lg:p-8"
          role="dialog"
          aria-label="Tour Information Panel"
        >
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/15">
            <div>
              <p className="text-xs font-mono text-[#E9EDF4]">IN-TOUR ARCHITECTURAL OVERLAY</p>
              <h3 className="text-2xl lg:text-3xl font-semibold text-white mt-0.5">
                {activeDrawer === 'floorplan' && `Synchronized CAD Floor Plan — Residence ${apartment.unitCode}`}
                {activeDrawer === 'specs' && `Verified Residence Dossier — ${apartment.title}`}
                {activeDrawer === 'help' && '3D Spatial Navigation & Capabilities Guide'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveDrawer('none')}
              className="px-4 py-2 text-xs font-medium bg-white text-[#17191D] hover:bg-[#E9EDF4] whitespace-nowrap shrink-0"
            >
              Close Panel (Esc)
            </button>
          </div>

          {activeDrawer === 'floorplan' && (
            <InteractiveFloorPlan
              rooms={apartment.rooms}
              selectedRoomId={selectedRoom.id}
              onSelectRoom={(rm) => {
                handleSelectRoom(rm);
                setActiveDrawer('none');
              }}
              unitCode={apartment.unitCode}
              areaSqm={apartment.areaSqm}
              areaConvention={apartment.areaConvention}
              synchronizedWith3D={true}
              variant="dark"
            />
          )}

          {activeDrawer === 'specs' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-5">
                <ArchitecturalVisual
                  preset={apartment.visualPreset}
                  alt={apartment.title}
                  className="h-72 border border-white/15"
                  caption={`Residence ${apartment.unitCode} · ${apartment.orientation}`}
                />
              </div>
              <div className="md:col-span-7 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-[#111317] border border-white/15 text-xs font-mono tabular-nums">
                  <div>
                    <div className="text-[#9BA3B4]">INTERNAL AREA</div>
                    <div className="text-base font-semibold text-white mt-1">
                      {apartment.areaSqm} sq.m
                    </div>
                  </div>
                  <div>
                    <div className="text-[#9BA3B4]">CONFIGURATION</div>
                    <div className="text-base font-semibold text-white mt-1">
                      {apartment.bedrooms} Bed · {apartment.bathrooms} Bath
                    </div>
                  </div>
                  <div>
                    <div className="text-[#9BA3B4]">VERIFIED PRICE</div>
                    <div className="text-base font-semibold text-white mt-1">
                      {formatPriceDisplay(apartment.priceStatus, apartment.priceAmount, apartment.currency)}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-mono text-[#E9EDF4] mb-2.5">
                    MATERIALS, JOINERY &amp; FINISH SCHEDULE
                  </h4>
                  <ul className="space-y-2 text-sm text-[#E9EDF4]">
                    {apartment.materialsAndFinishes.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-[#2855E8]">—</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenInquiry('property_details')}
                    className="px-5 py-2.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4]"
                  >
                    Inquire About Unit {apartment.unitCode}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenInquiry('site_visit_request')}
                    className="px-5 py-2.5 text-xs font-medium border border-white/25 text-white hover:bg-white/10"
                  >
                    Request Private Viewing
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeDrawer === 'help' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-[#E9EDF4]">
              <div className="p-5 bg-[#111317] border border-white/15 space-y-2.5">
                <h4 className="text-lg font-semibold text-white">Spatial Navigation Controls</h4>
                <p>— <strong>Orbit / Look Around:</strong> Left-click and drag (or single-finger touch drag).</p>
                <p>— <strong>Zoom:</strong> Scroll wheel or two-finger pinch.</p>
                <p>— <strong>Pan:</strong> Right-click and drag (or two-finger drag).</p>
                <p>— <strong>Room Waypoints:</strong> Click any Cobalt Blue disc on the 3D floor or select a room button in the bottom dock to glide smoothly to that zone.</p>
                <p>— <strong>Zen Mode:</strong> Press <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/20 font-mono text-xs">H</kbd> or click <em>Hide Controls</em> to inspect the 3D viewport unobstructed.</p>
              </div>
              <div className="p-5 bg-[#111317] border border-white/15 space-y-2.5">
                <h4 className="text-lg font-semibold text-white">Asset Provenance &amp; Manifest</h4>
                <p className="text-xs font-mono text-[#E9EDF4]">
                  MANIFEST ID: {manifest?.id} · VERIFIED: {manifest?.lastVerificationDate}
                </p>
                <p className="text-xs text-[#9BA3B4]">{manifest?.assetType} · {manifest?.captureMethod}</p>
                <ul className="text-xs space-y-1.5 pt-2 text-[#E9EDF4]">
                  {(manifest?.supportedCapabilities || []).map((cap) => (
                    <li key={cap}>· {cap}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Centered Collapsible Bottom Control Dock */}
      <div
        className="absolute bottom-4 inset-x-4 mx-auto z-20 max-w-[980px] transition-transform duration-200"
        style={{
          transform: dockCollapsed ? 'translateY(calc(100% - 34px))' : 'translateY(0)',
        }}
      >
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="px-4 py-1 text-xs font-mono bg-[#17191D]/95 text-[#E9EDF4] border border-b-0 border-white/20 hover:text-white whitespace-nowrap shrink-0"
            aria-expanded={!dockCollapsed}
          >
            {dockCollapsed ? 'Show Controls (H)' : 'Hide Controls (H)'}
          </button>
        </div>

        <div className="bg-[#17191D]/95 backdrop-blur-md border border-white/20 px-5 py-3.5 shadow-2xl space-y-3">
          {/* Active Room Readout & Mode/Lighting Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-[#9BA3B4]">ACTIVE VIEWPOINT:</span>
              <span className="font-semibold text-white">{selectedRoom.name}</span>
              <span aria-hidden="true" className="text-white/30">·</span>
              <span className="font-mono text-[#E9EDF4] tabular-nums">
                {selectedRoom.areaSqm} sq.m ({selectedRoom.dimensionsLabel})
              </span>
            </div>

            {/* View Mode & Sun Lighting Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleToggleViewMode('interior')}
                className={`px-3 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                  viewMode === 'interior'
                    ? 'bg-[#2855E8] text-white'
                    : 'bg-white/10 text-[#E9EDF4] hover:bg-white/20'
                }`}
              >
                Interior View
              </button>
              <button
                type="button"
                onClick={() => handleToggleViewMode('dollhouse')}
                className={`px-3 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                  viewMode === 'dollhouse'
                    ? 'bg-[#2855E8] text-white'
                    : 'bg-white/10 text-[#E9EDF4] hover:bg-white/20'
                }`}
              >
                3D Dollhouse
              </button>
              <span aria-hidden="true" className="text-white/20 px-1">|</span>
              {(['daylight', 'golden_hour', 'evening'] as LightingPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleLightingChange(preset)}
                  className={`px-2.5 py-1 text-xs font-mono whitespace-nowrap shrink-0 ${
                    lighting === preset
                      ? 'bg-white text-[#17191D] font-semibold'
                      : 'bg-white/5 text-[#9BA3B4] hover:bg-white/15'
                  }`}
                >
                  {preset === 'daylight' ? 'Daylight' : preset === 'golden_hour' ? 'Soft Light' : 'Evening'}
                </button>
              ))}
            </div>
          </div>

          {/* Room Navigation & Overlay Drawers */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Room viewpoints">
              {rooms.map((rm, idx) => {
                const isSelected = viewMode === 'interior' && rm.id === selectedRoom.id;
                return (
                  <button
                    key={rm.id}
                    type="button"
                    onClick={() => handleSelectRoom(rm)}
                    className={`px-3 py-1.5 text-xs font-medium arch-transition whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-[#2855E8] text-white'
                        : 'bg-white/10 text-[#E9EDF4] hover:bg-white/20'
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-75 mr-1">0{idx + 1}</span>
                    {rm.name}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setActiveDrawer((prev) => (prev === 'floorplan' ? 'none' : 'floorplan'))
                }
                className={`px-3 py-1.5 text-xs font-medium border whitespace-nowrap shrink-0 ${
                  activeDrawer === 'floorplan'
                    ? 'bg-[#2855E8] text-white border-[#2855E8]'
                    : 'bg-transparent text-white border-white/30 hover:bg-white/10'
                }`}
              >
                Floor Plan
              </button>
              <button
                type="button"
                onClick={() => setActiveDrawer((prev) => (prev === 'specs' ? 'none' : 'specs'))}
                className={`px-3 py-1.5 text-xs font-medium border whitespace-nowrap shrink-0 ${
                  activeDrawer === 'specs'
                    ? 'bg-[#2855E8] text-white border-[#2855E8]'
                    : 'bg-transparent text-white border-white/30 hover:bg-white/10'
                }`}
              >
                Unit Info
              </button>
              <button
                type="button"
                onClick={() => setActiveDrawer((prev) => (prev === 'help' ? 'none' : 'help'))}
                className={`px-3 py-1.5 text-xs font-medium border whitespace-nowrap shrink-0 ${
                  activeDrawer === 'help'
                    ? 'bg-[#2855E8] text-white border-[#2855E8]'
                    : 'bg-transparent text-white border-white/30 hover:bg-white/10'
                }`}
              >
                Controls Guide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
