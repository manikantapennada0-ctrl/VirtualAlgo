import * as THREE from 'three';
import { DetectedObject } from '../types';
import { Icons } from '../utils/icons';

export class ThreeSpatialViewer {
  private container: HTMLElement;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private animationFrameId: number | null = null;
  private isMouseDown: boolean = false;
  private mousePrevX: number = 0;
  private mousePrevY: number = 0;
  private rotX: number = 0;
  private rotY: number = 0;
  private cameraDistance: number = 3.2;

  public onClose?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render(imageUrl: string, detections: DetectedObject[]) {
    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-cyber-950 flex flex-col select-none">
        <!-- 3D Header Controls -->
        <div class="flex items-center justify-between px-6 py-3 border-b border-cyan-500/30 bg-cyber-950/80 backdrop-blur-md z-10">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 glow-cyan animate-pulse"></span>
            <span class="text-xs font-mono font-bold text-white uppercase tracking-wider">3D SPATIAL TELEMETRY • DEPTH GROUNDING</span>
          </div>
          <div class="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span class="hidden sm:inline">Drag to rotate • Scroll to zoom</span>
            <button id="close-3d-btn" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition flex items-center gap-1.5">
              ${Icons.close} Exit 3D View
            </button>
          </div>
        </div>

        <!-- 3D Canvas Canvas Container -->
        <div id="three-canvas-wrapper" class="flex-1 w-full h-full relative cursor-grab"></div>
      </div>
    `;

    document.getElementById('close-3d-btn')?.addEventListener('click', () => {
      this.dispose();
      this.onClose?.();
    });

    const wrapper = document.getElementById('three-canvas-wrapper');
    if (!wrapper) return;

    this.initThree(wrapper, imageUrl, detections);
  }

  private initThree(wrapper: HTMLElement, imageUrl: string, detections: DetectedObject[]) {
    const width = wrapper.clientWidth || window.innerWidth;
    const height = wrapper.clientHeight || (window.innerHeight - 60);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030712);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, this.cameraDistance);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    wrapper.appendChild(this.renderer.domElement);

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x111728, 2.5);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0x00f2fe, 1.2);
    dirLight.position.set(2, 4, 3);
    this.scene.add(dirLight);

    // Root model pivot
    const pivot = new THREE.Group();
    this.scene.add(pivot);

    // Load image texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageUrl, (texture) => {
      const imgAspect = texture.image.width / texture.image.height;
      const planeW = 2 * imgAspect;
      const planeH = 2;

      // Base Image Plane
      const planeGeo = new THREE.PlaneGeometry(planeW, planeH);
      const planeMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      pivot.add(planeMesh);

      // Render 3D wireframe bounding boxes in front of image with depth
      detections.forEach((d, idx) => {
        if (!d.visible) return;
        const [y0, x0, y1, x1] = d.box_2d.map(c => c / 1000);

        // Map normalized 0..1 to plane coordinates
        const boxW = (x1 - x0) * planeW;
        const boxH = (y1 - y0) * planeH;
        const centerX = (x0 + (x1 - x0) / 2 - 0.5) * planeW;
        const centerY = (0.5 - (y0 + (y1 - y0) / 2)) * planeH;

        // Depth offset based on confidence and scale (larger / closer objects stand out more)
        const depthZ = 0.05 + ((1 - Math.min(boxW, boxH) / 2) * 0.15) + (idx * 0.005);

        // 3D wireframe box geometry
        const boxGeo = new THREE.BoxGeometry(boxW, boxH, depthZ);
        const edges = new THREE.EdgesGeometry(boxGeo);
        const col = new THREE.Color(d.color || '#00f2fe');
        const lineMat = new THREE.LineBasicMaterial({ color: col, linewidth: 2 });
        const wireframe = new THREE.LineSegments(edges, lineMat);

        wireframe.position.set(centerX, centerY, depthZ / 2);
        pivot.add(wireframe);
      });
    });

    // Orbit controls
    wrapper.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      this.mousePrevX = e.clientX;
      this.mousePrevY = e.clientY;
      wrapper.classList.add('cursor-grabbing');
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;
      const dx = e.clientX - this.mousePrevX;
      const dy = e.clientY - this.mousePrevY;
      this.rotY += dx * 0.008;
      this.rotX += dy * 0.008;
      this.rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.rotX));
      this.mousePrevX = e.clientX;
      this.mousePrevY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      wrapper.classList.remove('cursor-grabbing');
    });

    wrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance = Math.max(1.2, Math.min(6, this.cameraDistance + e.deltaY * 0.003));
    }, { passive: false });

    // Render loop
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      if (this.camera && pivot && this.renderer && this.scene) {
        pivot.rotation.y = this.rotY;
        pivot.rotation.x = this.rotX;
        this.camera.position.z = this.cameraDistance;
        this.renderer.render(this.scene, this.camera);
      }
    };
    animate();

    const handleResize = () => {
      if (!this.camera || !this.renderer || !wrapper) return;
      const w = wrapper.clientWidth;
      const h = wrapper.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
  }

  public dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
    this.container.innerHTML = '';
  }
}
