import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  SectionItem, 
  SeatItem, 
  AppSettings, 
  User, 
  SEAT_STATUS_LIST 
} from '../types';
import { 
  Check, 
  X, 
  Clock, 
  Star, 
  AlertTriangle, 
  Phone, 
  Eye, 
  RotateCcw, 
  Camera, 
  Sparkles, 
  Layers, 
  Maximize2,
  Minimize2,
  Search,
  Filter,
  UserCheck,
  UserX,
  Compass,
  ArrowRight
} from 'lucide-react';

interface Classroom3DViewProps {
  section: SectionItem;
  settings: AppSettings;
  currentUser: User | null;
  onToggleAttendance: (
    seatNum: number,
    name: string,
    number: string,
    newStatus: 'present' | 'absent' | 'late',
    massarNumber?: string,
    guardianPhone?: string,
    guardianPhoneVerified?: boolean
  ) => void;
  onOpenPositiveParticipation: (
    seatNum: number,
    studentName: string,
    studentNumber: string,
    massarNumber: string,
    rosterId: string | null
  ) => void;
  onOpenStudentRecord: (seat: SeatItem) => void;
  onBackTo2D?: () => void;
}

// Generate Canvas Texture for Blackboard Header
function createBlackboardTexture(title: string, schoolName: string, dateStr: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  // Blackboard dark matte green
  ctx.fillStyle = '#1B3D2F';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle chalk texture/noise
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  for (let i = 0; i < 2000; i++) {
    const rx = Math.random() * canvas.width;
    const ry = Math.random() * canvas.height;
    ctx.fillRect(rx, ry, Math.random() * 3, Math.random() * 3);
  }

  // Border frame
  ctx.strokeStyle = '#D9A441';
  ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  // Text: School Name
  ctx.fillStyle = '#E8E4D9';
  ctx.font = 'bold 32px "Amiri", "Cairo", serif';
  ctx.textAlign = 'center';
  ctx.fillText(schoolName, canvas.width / 2, 70);

  // Text: Section Title
  ctx.fillStyle = '#FFDD80';
  ctx.font = 'bold 48px "Amiri", "Cairo", serif';
  ctx.fillText(title, canvas.width / 2, 160);

  // Underline
  ctx.strokeStyle = 'rgba(255, 221, 128, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(250, 185);
  ctx.lineTo(canvas.width - 250, 185);
  ctx.stroke();

  // Footer text
  ctx.fillStyle = '#C4C0B5';
  ctx.font = '28px "Cairo", sans-serif';
  ctx.fillText(`التاريخ: ${dateStr}  |  المملكة المغربية - وزارة التربية الوطنية`, canvas.width / 2, 260);

  // Welcome chalk note
  ctx.fillStyle = '#A3E635';
  ctx.font = 'italic 26px "Amiri", "Cairo", serif';
  ctx.fillText('« العلم يرفع بيتاً لا عماد له .. والجهل يهدم بيت العز والشرف »', canvas.width / 2, 330);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Generate Nameplate Canvas Texture for Student
function createStudentNameplateTexture(
  seatNum: number,
  studentName: string,
  studentNumber: string,
  status: 'present' | 'absent' | 'late' | null,
  positivePoints: number,
  violationsCount: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Background card color
  let bgColor = '#1E362D';
  let borderColor = '#386B5A';
  let statusText = 'لم يسجل';
  let statusBg = '#334155';

  if (status === 'present') {
    statusText = '✓ حاضر';
    statusBg = '#059669';
    borderColor = '#10B981';
  } else if (status === 'absent') {
    statusText = '✕ غائب';
    statusBg = '#DC2626';
    borderColor = '#EF4444';
  } else if (status === 'late') {
    statusText = '⏳ متأخر';
    statusBg = '#D97706';
    borderColor = '#F59E0B';
  }

  // Draw rounded card
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  // Seat Number Tag (Top Right)
  ctx.fillStyle = '#C98A3C';
  ctx.fillRect(canvas.width - 130, 8, 120, 50);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px "Cairo", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`مقعد #${seatNum}`, canvas.width - 70, 44);

  // Status Badge (Top Left)
  ctx.fillStyle = statusBg;
  ctx.fillRect(8, 8, 130, 50);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px "Cairo", sans-serif';
  ctx.fillText(statusText, 73, 42);

  // Student Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px "Amiri", "Cairo", serif';
  ctx.textAlign = 'center';
  const displayName = studentName || 'مقعد شاغر';
  ctx.fillText(displayName.length > 20 ? displayName.slice(0, 19) + '..' : displayName, canvas.width / 2, 130);

  // Roll Number
  if (studentNumber) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 24px "Cairo", sans-serif';
    ctx.fillText(`الرقم الترتيبي: ${studentNumber}`, canvas.width / 2, 175);
  }

  // Badges: Positive Points or Violations
  if (positivePoints > 0) {
    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 24px "Cairo", sans-serif';
    ctx.fillText(`★ تميز: +${positivePoints}`, canvas.width / 2 - 80, 225);
  }

  if (violationsCount > 0) {
    ctx.fillStyle = '#F87171';
    ctx.font = 'bold 22px "Cairo", sans-serif';
    ctx.fillText(`⚠️ مخالفات: ${violationsCount}`, canvas.width / 2 + 80, 225);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export const Classroom3DView: React.FC<Classroom3DViewProps> = ({
  section,
  settings,
  currentUser,
  onToggleAttendance,
  onOpenPositiveParticipation,
  onOpenStudentRecord,
  onBackTo2D
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedSeatNum, setSelectedSeatNum] = useState<number | null>(null);
  const [cameraView, setCameraView] = useState<'teacher' | 'iso' | 'top' | 'student'>('iso');
  const [filterMode, setFilterMode] = useState<'all' | 'present' | 'absent' | 'late' | 'rewards'>('all');
  const [hideEmptySeats, setHideEmptySeats] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Internal Three.js references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const interactiveObjectsRef = useRef<THREE.Object3D[]>([]);
  const seatMeshesRef = useRef<Map<number, THREE.Group>>(new Map());

  // Date for chalkboard
  const currentDateStr = useMemo(() => {
    return new Date().toLocaleDateString('ar-MA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  // Compute selected seat object
  const selectedSeat = useMemo(() => {
    if (!selectedSeatNum) return null;
    return section.seats.find((s) => s.seat === selectedSeatNum) || null;
  }, [selectedSeatNum, section.seats]);

  // Attendance Statistics
  const stats = useMemo(() => {
    const present = section.seats.filter((s) => s.name && s.name.trim() && s.attendance === 'present').length;
    const absent = section.seats.filter((s) => s.name && s.name.trim() && s.attendance === 'absent').length;
    const late = section.seats.filter((s) => s.name && s.name.trim() && s.attendance === 'late').length;
    const totalAssigned = section.seats.filter((s) => s.name && s.name.trim()).length;
    const unmarked = Math.max(0, totalAssigned - (present + absent + late));
    return { present, absent, late, totalAssigned, unmarked };
  }, [section.seats]);

  // Handle Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!mountRef.current) return;
    if (!document.fullscreenElement) {
      mountRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Switch Camera View Angles smoothly
  const applyCameraPreset = (preset: 'teacher' | 'iso' | 'top' | 'student') => {
    if (!cameraRef.current || !controlsRef.current) return;
    setCameraView(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    switch (preset) {
      case 'teacher':
        // Teacher looking at students from front
        camera.position.set(0, 4.5, 9.5);
        controls.target.set(0, 1.2, -1.0);
        break;
      case 'iso':
        // Classic 45° isometric view
        camera.position.set(9.5, 8.5, 9.5);
        controls.target.set(0, 1.0, 0);
        break;
      case 'top':
        // Top-down bird's eye view
        camera.position.set(0, 15.0, 0.1);
        controls.target.set(0, 0, 0);
        break;
      case 'student':
        // Student perspective looking towards the blackboard
        camera.position.set(0, 3.2, -8.5);
        controls.target.set(0, 2.5, 9.5);
        break;
    }
    controls.update();
  };

  // Setup Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x13211D); // Deep Moroccan teal slate
    scene.fog = new THREE.FogExp2(0x13211D, 0.025);

    // 2. Camera
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(9.5, 8.5, 9.5);
    cameraRef.current = camera;

    // 3. Renderer with PBR settings
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below floor
    controls.minDistance = 3.0;
    controls.maxDistance = 25.0;
    controls.target.set(0, 1.0, 0);
    controlsRef.current = controls;

    // 5. Lighting Rig
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xE8F0ED, 0.65);
    scene.add(ambientLight);

    // Directional Sunlight (through classroom windows on the left)
    const sunLight = new THREE.DirectionalLight(0xFFF7E6, 1.2);
    sunLight.position.set(-12, 12, 6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 40;
    sunLight.shadow.camera.left = -14;
    sunLight.shadow.camera.right = 14;
    sunLight.shadow.camera.top = 14;
    sunLight.shadow.camera.bottom = -14;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Front Chalkboard Spotlight
    const boardSpot = new THREE.SpotLight(0xFFF1D0, 1.4, 18, Math.PI / 4, 0.4);
    boardSpot.position.set(0, 6.5, 6.5);
    boardSpot.target.position.set(0, 2.5, 9.8);
    scene.add(boardSpot);
    scene.add(boardSpot.target);

    // Subtle Classroom Ceiling Lamps
    [-3, 3].forEach((lx) => {
      [-3, 2].forEach((lz) => {
        const ceilingLamp = new THREE.PointLight(0xF4EDE0, 0.45, 9);
        ceilingLamp.position.set(lx, 4.5, lz);
        scene.add(ceilingLamp);
      });
    });

    // 6. Classroom Room Architecture
    // Floor
    const floorGeo = new THREE.PlaneGeometry(24, 26);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x2A3D36,
      roughness: 0.45,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor Grid Tile Lines (Realistic school tiles)
    const gridHelper = new THREE.GridHelper(24, 24, 0x3D5A4F, 0x1F312B);
    gridHelper.position.y = 0.005;
    scene.add(gridHelper);

    // Front Wall (with Blackboard)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xECE7DB,
      roughness: 0.85
    });
    const frontWallGeo = new THREE.PlaneGeometry(24, 7);
    const frontWall = new THREE.Mesh(frontWallGeo, wallMat);
    frontWall.position.set(0, 3.5, 10.0);
    frontWall.rotation.y = Math.PI;
    frontWall.receiveShadow = true;
    scene.add(frontWall);

    // Back Wall
    const backWall = new THREE.Mesh(frontWallGeo, wallMat);
    backWall.position.set(0, 3.5, -10.0);
    scene.add(backWall);

    // Left Wall with simulated window openings
    const sideWallGeo = new THREE.PlaneGeometry(20, 7);
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.position.set(-12, 3.5, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);

    // Right Wall
    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.position.set(12, 3.5, 0);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);

    // 7. Large Moroccan Classroom Chalkboard (السبورة الخضراء)
    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, 3.0, 9.85);

    // Frame
    const boardFrameGeo = new THREE.BoxGeometry(9.4, 3.2, 0.1);
    const boardFrameMat = new THREE.MeshStandardMaterial({
      color: 0x8C5E33,
      roughness: 0.6
    });
    const boardFrame = new THREE.Mesh(boardFrameGeo, boardFrameMat);
    boardGroup.add(boardFrame);

    // Board Surface with Canvas Texture
    const sectionTitle = `${section.level || 'بدون مستوى'} - القسم ${section.classNumber || '1'}`;
    const boardTexture = createBlackboardTexture(
      sectionTitle,
      settings.institution || 'الثانوية الإعدادية ايكسان',
      currentDateStr
    );
    const boardSurfaceGeo = new THREE.PlaneGeometry(9.0, 2.9);
    const boardSurfaceMat = new THREE.MeshStandardMaterial({
      map: boardTexture,
      roughness: 0.85
    });
    const boardSurface = new THREE.Mesh(boardSurfaceGeo, boardSurfaceMat);
    boardSurface.position.z = 0.06;
    boardSurface.rotation.y = Math.PI; // Face the classroom
    boardGroup.add(boardSurface);

    // Chalk Ledge
    const ledgeGeo = new THREE.BoxGeometry(9.2, 0.08, 0.2);
    const ledgeMat = new THREE.MeshStandardMaterial({ color: 0x5C3818, roughness: 0.5 });
    const ledge = new THREE.Mesh(ledgeGeo, ledgeMat);
    ledge.position.set(0, -1.55, 0.1);
    boardGroup.add(ledge);

    // Chalk & Eraser on ledge
    const eraserGeo = new THREE.BoxGeometry(0.35, 0.08, 0.12);
    const eraserMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const eraser = new THREE.Mesh(eraserGeo, eraserMat);
    eraser.position.set(2.0, -1.48, 0.12);
    boardGroup.add(eraser);

    scene.add(boardGroup);

    // 8. Teacher's Podium & Desk (مكتب ومنصة الأستاذ)
    const teacherStation = new THREE.Group();
    teacherStation.position.set(0, 0, 7.2);

    // Small Wooden Platform
    const platformGeo = new THREE.BoxGeometry(4.0, 0.15, 2.0);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x6E4726, roughness: 0.6 });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = 0.075;
    platform.receiveShadow = true;
    teacherStation.add(platform);

    // Teacher Desk
    const deskGeo = new THREE.BoxGeometry(2.4, 0.1, 1.1);
    const woodDeskMat = new THREE.MeshStandardMaterial({ color: 0x8C5E33, roughness: 0.4 });
    const deskTop = new THREE.Mesh(deskGeo, woodDeskMat);
    deskTop.position.set(0, 1.05, 0);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    teacherStation.add(deskTop);

    // Teacher Desk Legs
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.95);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 });
    [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(lx, 0.55, lz);
      leg.castShadow = true;
      teacherStation.add(leg);
    });

    // Laptop on Teacher Desk
    const laptopBaseGeo = new THREE.BoxGeometry(0.45, 0.02, 0.3);
    const laptopMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });
    const laptopBase = new THREE.Mesh(laptopBaseGeo, laptopMat);
    laptopBase.position.set(-0.5, 1.11, 0);
    teacherStation.add(laptopBase);

    const laptopScreenGeo = new THREE.BoxGeometry(0.45, 0.3, 0.02);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x2563EB });
    const laptopScreen = new THREE.Mesh(laptopScreenGeo, screenMat);
    laptopScreen.position.set(-0.5, 1.25, 0.15);
    laptopScreen.rotation.x = -0.3;
    teacherStation.add(laptopScreen);

    // Teacher Chair
    const chairGeo = new THREE.BoxGeometry(0.6, 0.08, 0.6);
    const chairSeat = new THREE.Mesh(chairGeo, woodDeskMat);
    chairSeat.position.set(0, 0.7, 0.9);
    teacherStation.add(chairSeat);

    const chairBackGeo = new THREE.BoxGeometry(0.6, 0.5, 0.06);
    const chairBack = new THREE.Mesh(chairBackGeo, woodDeskMat);
    chairBack.position.set(0, 1.0, 1.18);
    teacherStation.add(chairBack);

    scene.add(teacherStation);

    // 9. Build Student Desks (4 Rows of 5 Double Desks = 40 seats)
    // Clear old interactive objects
    interactiveObjectsRef.current = [];
    seatMeshesRef.current.clear();

    const deskWoodMat = new THREE.MeshStandardMaterial({
      color: 0x9B6A3E, // Warm honey oak classroom desk
      roughness: 0.4,
      metalness: 0.05
    });

    const chairWoodMat = new THREE.MeshStandardMaterial({
      color: 0x80522D,
      roughness: 0.5
    });

    const studentMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1E293B,
      roughness: 0.35,
      metalness: 0.8
    });

    // Desks grid layout
    // 4 Rows along Z (from 4.0 down to -5.0)
    // 5 Desks per Row along X (from -5.2 to +5.2)
    const rowZPositions = [4.2, 1.6, -1.0, -3.6];
    const deskXPositions = [-5.2, -2.6, 0.0, 2.6, 5.2];

    rowZPositions.forEach((rowZ, rowIndex) => {
      const rowNum = rowIndex + 1;
      const startSeatInRow = (rowNum - 1) * 10 + 1;

      deskXPositions.forEach((deskX, deskIndex) => {
        const seat1Num = startSeatInRow + deskIndex * 2;
        const seat2Num = seat1Num + 1;

        const s1 = section.seats.find((s) => s.seat === seat1Num);
        const s2 = section.seats.find((s) => s.seat === seat2Num);

        const hasAnyStudent = Boolean((s1?.name && s1.name.trim()) || (s2?.name && s2.name.trim()));

        // Filter / Hide empty seats if enabled
        if (hideEmptySeats && !hasAnyStudent) return;

        // Container Group for this double desk
        const deskGroup = new THREE.Group();
        deskGroup.position.set(deskX, 0, rowZ);

        // 1. Double Table Top (Width: 1.8m, Depth: 0.65m)
        const tableTopGeo = new THREE.BoxGeometry(1.8, 0.07, 0.65);
        const tableTop = new THREE.Mesh(tableTopGeo, deskWoodMat);
        tableTop.position.y = 0.95;
        tableTop.castShadow = true;
        tableTop.receiveShadow = true;
        deskGroup.add(tableTop);

        // 2. Book Rack / Shelf underneath
        const rackGeo = new THREE.BoxGeometry(1.7, 0.03, 0.55);
        const rackMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
        const rack = new THREE.Mesh(rackGeo, rackMat);
        rack.position.y = 0.72;
        deskGroup.add(rack);

        // 3. Desk Metal Legs
        const deskLegGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.92);
        [[-0.82, -0.25], [0.82, -0.25], [-0.82, 0.25], [0.82, 0.25]].forEach(([lx, lz]) => {
          const dLeg = new THREE.Mesh(deskLegGeo, studentMetalMat);
          dLeg.position.set(lx, 0.47, lz);
          dLeg.castShadow = true;
          deskGroup.add(dLeg);
        });

        // 4. Two Attached Chairs (Seat 1: Right at x = +0.45, Seat 2: Left at x = -0.45)
        const seatConfigs = [
          { seatNum: seat1Num, seatData: s1, offsetX: 0.45 },
          { seatNum: seat2Num, seatData: s2, offsetX: -0.45 }
        ];

        seatConfigs.forEach(({ seatNum, seatData, offsetX }) => {
          const seatGroup = new THREE.Group();
          seatGroup.position.set(offsetX, 0, 0);

          // Chair Seat Pan
          const chairPanGeo = new THREE.BoxGeometry(0.48, 0.04, 0.44);
          const chairPan = new THREE.Mesh(chairPanGeo, chairWoodMat);
          chairPan.position.set(0, 0.58, -0.55);
          chairPan.castShadow = true;
          seatGroup.add(chairPan);

          // Chair Backrest
          const chairBackGeo = new THREE.BoxGeometry(0.46, 0.32, 0.04);
          const chairBackMesh = new THREE.Mesh(chairBackGeo, chairWoodMat);
          chairBackMesh.position.set(0, 0.88, -0.75);
          chairBackMesh.castShadow = true;
          seatGroup.add(chairBackMesh);

          // Chair Legs
          const chairLegGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.56);
          [[-0.2, -0.73], [0.2, -0.73], [-0.2, -0.37], [0.2, -0.37]].forEach(([cx, cz]) => {
            const cl = new THREE.Mesh(chairLegGeo, studentMetalMat);
            cl.position.set(cx, 0.28, cz);
            seatGroup.add(cl);
          });

          // Invisible Raycasting Click Trigger Zone
          const hitBoxGeo = new THREE.BoxGeometry(0.85, 1.6, 0.85);
          const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
          const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
          hitBox.position.set(0, 0.9, -0.2);
          hitBox.userData = {
            seatNum: seatNum,
            studentName: seatData?.name || '',
            isSeatTarget: true
          };
          seatGroup.add(hitBox);
          interactiveObjectsRef.current.push(hitBox);

          // Student Presence & Info Floating 3D Badge
          const hasStudent = Boolean(seatData?.name && seatData.name.trim());
          const attStatus = seatData?.attendance || null;
          const posPoints = seatData?.positiveParticipationCount || 0;
          const violCount = seatData?.violations?.length || 0;

          // Status Light Orb (Green = Present, Red = Absent, Amber = Late, Slate = Unmarked)
          const orbGeo = new THREE.SphereGeometry(0.08, 16, 16);
          let orbColor = 0x64748B;
          let orbEmissive = 0x000000;

          if (attStatus === 'present') {
            orbColor = 0x10B981;
            orbEmissive = 0x059669;
          } else if (attStatus === 'absent') {
            orbColor = 0xEF4444;
            orbEmissive = 0xDC2626;
          } else if (attStatus === 'late') {
            orbColor = 0xF59E0B;
            orbEmissive = 0xD97706;
          }

          const orbMat = new THREE.MeshStandardMaterial({
            color: orbColor,
            emissive: orbEmissive,
            emissiveIntensity: 0.6,
            roughness: 0.2
          });
          const orb = new THREE.Mesh(orbGeo, orbMat);
          orb.position.set(0, 1.25, 0);
          seatGroup.add(orb);

          // 3D Billboard Nameplate above desk
          const nameplateTex = createStudentNameplateTexture(
            seatNum,
            seatData?.name || '',
            seatData?.number || '',
            attStatus,
            posPoints,
            violCount
          );

          const nameplateGeo = new THREE.PlaneGeometry(0.85, 0.42);
          const nameplateMat = new THREE.MeshBasicMaterial({
            map: nameplateTex,
            transparent: true,
            side: THREE.DoubleSide
          });
          const nameplateMesh = new THREE.Mesh(nameplateGeo, nameplateMat);
          nameplateMesh.position.set(0, 1.55, 0);
          nameplateMesh.rotation.y = Math.PI; // Face the teacher / front
          seatGroup.add(nameplateMesh);

          // If Student has positive participation, add a rotating 3D Golden Star!
          if (posPoints > 0) {
            const starShape = new THREE.Shape();
            const points = 5;
            for (let i = 0; i < points * 2; i++) {
              const r = i % 2 === 0 ? 0.12 : 0.05;
              const angle = (i * Math.PI) / points;
              const sx = Math.cos(angle) * r;
              const sy = Math.sin(angle) * r;
              if (i === 0) starShape.moveTo(sx, sy);
              else starShape.lineTo(sx, sy);
            }
            starShape.closePath();

            const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.03, bevelEnabled: false });
            const starMat = new THREE.MeshStandardMaterial({
              color: 0xFBBF24,
              emissive: 0xF59E0B,
              emissiveIntensity: 0.8,
              metalness: 0.9,
              roughness: 0.1
            });
            const starMesh = new THREE.Mesh(starGeo, starMat);
            starMesh.position.set(0, 1.88, 0);
            starMesh.userData = { isRotatingStar: true };
            seatGroup.add(starMesh);
          }

          deskGroup.add(seatGroup);
          seatMeshesRef.current.set(seatNum, seatGroup);
        });

        scene.add(deskGroup);
      });
    });

    // 10. Click Detection via Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveObjectsRef.current, true);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData?.isSeatTarget) {
          const sNum = hit.userData.seatNum;
          setSelectedSeatNum(sNum);
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('click', handlePointerDown);

    // 11. Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Gently rotate any golden reward stars
      scene.traverse((obj) => {
        if (obj.userData?.isRotatingStar) {
          obj.rotation.y += delta * 2.0;
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // 12. Resize Listener
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // 13. Cleanup on Unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('click', handlePointerDown);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      scene.clear();
    };
  }, [section, settings, hideEmptySeats, currentDateStr]);

  // Handle Attendance Action in 3D Modal
  const handleSetAttendance = (status: 'present' | 'absent' | 'late') => {
    if (!selectedSeat) return;
    onToggleAttendance(
      selectedSeat.seat,
      selectedSeat.name,
      selectedSeat.number,
      status,
      selectedSeat.massarNumber,
      selectedSeat.guardianPhone,
      selectedSeat.guardianPhoneVerified
    );
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-[#D5CDC0] shadow-xl bg-[#13211D] animate-fadeIn text-[#F2EFE3]">
      
      {/* 1. TOP 3D NAVIGATION & HUD TOOLBAR */}
      <div className="absolute top-0 inset-x-0 z-20 bg-gradient-to-b from-[#13211D]/95 via-[#13211D]/80 to-transparent p-4 flex items-center justify-between gap-3 flex-wrap">
        
        {/* Left: Section Details & Live Stats */}
        <div className="flex items-center gap-3">
          {onBackTo2D && (
            <button
              onClick={onBackTo2D}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/15 shadow-sm"
              title="الرجوع إلى خريطة المقاعد العادية (2D)"
            >
              <ArrowRight className="w-4 h-4 text-[#C98A3C]" />
              <span>الرجوع للخريطة (2D)</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
            <h3 className="font-['Amiri',serif] font-bold text-base sm:text-lg text-white">
              قاعة {section.level} - القسم {section.classNumber} (معاينة ثلاثية الأبعاد 3D)
            </h3>
          </div>

          {/* Quick Realtime Attendance Badges */}
          <div className="hidden md:flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
              <span>✓ حاضر:</span>
              <span>{stats.present}</span>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
              <span>✕ غائب:</span>
              <span>{stats.absent}</span>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
              <span>⏳ متأخر:</span>
              <span>{stats.late}</span>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-900/80 text-slate-300 border border-slate-600 font-bold">
              مجموع التلاميذ: {stats.totalAssigned} / 40
            </span>
          </div>
        </div>

        {/* Right: Camera Angle Switcher & View Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Camera Angles */}
          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md p-1 rounded-2xl border border-white/10 text-xs">
            <button
              onClick={() => applyCameraPreset('teacher')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer ${
                cameraView === 'teacher'
                  ? 'bg-[#1A4E47] text-white shadow-xs'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
              title="منظور الأستاذ الواقف أمام السبورة"
            >
              <span>👨‍🏫</span>
              <span>منظور الأستاذ</span>
            </button>

            <button
              onClick={() => applyCameraPreset('iso')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer ${
                cameraView === 'iso'
                  ? 'bg-[#1A4E47] text-white shadow-xs'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
              title="منظور إيزومتري شامل للقسم"
            >
              <span>📐</span>
              <span>إيزومتري</span>
            </button>

            <button
              onClick={() => applyCameraPreset('top')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer ${
                cameraView === 'top'
                  ? 'bg-[#1A4E47] text-white shadow-xs'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
              title="رؤية علوية عمودية للمقاعد"
            >
              <span>🦅</span>
              <span>رؤية علوية</span>
            </button>

            <button
              onClick={() => applyCameraPreset('student')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer ${
                cameraView === 'student'
                  ? 'bg-[#1A4E47] text-white shadow-xs'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
              title="منظور التلاميذ نحو السبورة"
            >
              <span>🧑‍🎓</span>
              <span>نحو السبورة</span>
            </button>
          </div>

          {/* Toggle Hide Empty Seats */}
          <button
            onClick={() => setHideEmptySeats(!hideEmptySeats)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1 ${
              hideEmptySeats
                ? 'bg-[#C98A3C] text-black border-[#C98A3C]'
                : 'bg-black/30 text-white/80 border-white/10 hover:bg-black/50'
            }`}
            title="إخفاء الطاولات الفارغة للتركيز على التلاميذ المسجلين فقط"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{hideEmptySeats ? 'إظهار كل المقاعد' : 'إخفاء الشواغر'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-black/30 hover:bg-black/50 text-white/80 hover:text-white border border-white/10 cursor-pointer"
            title="تكبير الشاشة الكاملة"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. THE THREE.JS 3D CANVAS VIEWPORT */}
      <div 
        ref={mountRef} 
        className="w-full h-[650px] sm:h-[720px] cursor-grab active:cursor-grabbing select-none"
      />

      {/* 3. INTERACTIVE 3D HELPER NOTICE */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-none hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-[11px] text-white/70">
        <Compass className="w-4 h-4 text-[#C98A3C] animate-spin" />
        <span>اسحب للتدوير 360° | حرك العجلة للتكبير | انقر على أي طاولة للتحكم بالتلميذ</span>
      </div>

      {/* 4. SELECTED STUDENT QUICK ACTION DRAWER (FLOATING 3D OVERLAY) */}
      {selectedSeat && (
        <div className="absolute bottom-4 left-4 z-30 max-w-sm w-full bg-[#182C25]/95 backdrop-blur-xl border border-[#C98A3C]/60 rounded-3xl p-5 shadow-2xl animate-slideUp text-right">
          
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#C98A3C] text-black font-mono font-black text-xs">
                  مقعد #{selectedSeat.seat}
                </span>
                {selectedSeat.number && (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/80 font-mono text-xs">
                    رقم {selectedSeat.number}
                  </span>
                )}
                {selectedSeat.attendance && (
                  <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                    selectedSeat.attendance === 'present'
                      ? 'bg-emerald-600 text-white'
                      : selectedSeat.attendance === 'absent'
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}>
                    {selectedSeat.attendance === 'present' ? '✓ حاضر' : selectedSeat.attendance === 'absent' ? '✕ غائب' : '⏳ متأخر'}
                  </span>
                )}
              </div>

              <h4 className="font-['Amiri',serif] font-bold text-lg text-white mt-1">
                {selectedSeat.name || 'مقعد شاغر (بدون تلميذ)'}
              </h4>

              {selectedSeat.massarNumber && (
                <div className="text-[11px] text-[#C98A3C] font-mono">
                  مسار: {selectedSeat.massarNumber}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedSeatNum(null)}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content if Student exists */}
          {selectedSeat.name && selectedSeat.name.trim() ? (
            <div className="space-y-4 pt-3">
              
              {/* Quick Attendance Triple Buttons */}
              <div>
                <span className="text-[11px] text-white/60 block mb-1.5">تسجيل الحضور الفوري في 3D:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleSetAttendance('present')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      selectedSeat.attendance === 'present'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-500/30'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>حاضر</span>
                  </button>

                  <button
                    onClick={() => handleSetAttendance('absent')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      selectedSeat.attendance === 'absent'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-500/30'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>غائب</span>
                  </button>

                  <button
                    onClick={() => handleSetAttendance('late')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      selectedSeat.attendance === 'late'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 border border-amber-500/30'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>متأخر</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons: Star + Violations + Full Record */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    onOpenPositiveParticipation(
                      selectedSeat.seat,
                      selectedSeat.name,
                      selectedSeat.number || '',
                      selectedSeat.massarNumber || '',
                      selectedSeat.rosterId || null
                    );
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>مشاركة إيجابية</span>
                  {(selectedSeat.positiveParticipationCount || 0) > 0 && (
                    <span className="bg-amber-500 text-black px-1.5 py-0.2 rounded-full text-[10px] font-black">
                      +{selectedSeat.positiveParticipationCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => onOpenStudentRecord(selectedSeat)}
                  className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="فتح السجل الكامل والملاحظات والمخالفات"
                >
                  <Eye className="w-3.5 h-3.5 text-[#C98A3C]" />
                  <span>الملف الشامل</span>
                </button>
              </div>

              {/* Guardian WhatsApp Direct Button */}
              {selectedSeat.guardianPhone && (
                <a
                  href={`https://wa.me/${selectedSeat.guardianPhone.replace(/\D/g, '').startsWith('0') ? '212' + selectedSeat.guardianPhone.replace(/\D/g, '').slice(1) : selectedSeat.guardianPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-colors no-underline"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>مراسلة ولي الأمر عبر واتساب ({selectedSeat.guardianPhone})</span>
                </a>
              )}

            </div>
          ) : (
            <div className="py-4 text-center text-xs text-white/50">
              هذا المقعد شاغر حالياً. يمكنك تعيين تلميذ فيه من واجهة خريطة المقاعد 2D.
            </div>
          )}

        </div>
      )}

    </div>
  );
};
