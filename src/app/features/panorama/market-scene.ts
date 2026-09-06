import {
  AmbientLight, BoxGeometry, Color, DirectionalLight, EdgesGeometry, FogExp2, GridHelper,
  Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
  Raycaster, RingGeometry, Scene, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { StockListItem } from '../../lib/api';
import { barHeight, changeLabel, changeTone } from './panorama-data';

export function createMarketScene(host: HTMLElement, stocks: StockListItem[], reduced: boolean,
  onSelect: (code: string) => void, onContextLost: () => void, maximumChange?: number) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x080f20, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const scene = new Scene();
  scene.fog = new FogExp2(0x080f20, .024);
  const camera = new PerspectiveCamera(40, 1, .1, 150);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !reduced;
  controls.dampingFactor = .12;
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 34;
  controls.minPolarAngle = .25;
  controls.maxPolarAngle = Math.PI / 2.12;
  controls.target.set(0, .6, 0);
  scene.add(new AmbientLight(0xcad9ff, 1.7));
  const keyLight = new DirectionalLight(0xffffff, 3);
  keyLight.position.set(-3, 8, 6); scene.add(keyLight);
  const rim = new DirectionalLight(0x538bff, 3);
  rim.position.set(5, 3, -5); scene.add(rim);
  const grid = new GridHelper(24, 24, 0x34578b, 0x172b48);
  grid.material.transparent = true; grid.material.opacity = .6;
  scene.add(grid);
  const geometry = new BoxGeometry(.72, 1, .72);
  geometry.translate(0, .5, 0);
  const edgesGeometry = new EdgesGeometry(geometry);
  const edgeMaterial = new LineBasicMaterial({ color: 0xd8f1ff, transparent: true, opacity: .18 });
  const colors = { rise: 0xf87088, fall: 0x32d3b1, flat: 0x8397bc, unknown: 0x394860 };
  const maxChange = maximumChange ?? Math.max(.01, ...stocks.map((stock) => Number.isFinite(stock.changePercent) ? Math.abs(stock.changePercent!) : 0));
  const columns = Math.ceil(Math.sqrt(stocks.length));
  const rows = Math.ceil(stocks.length / columns);
  const bars = stocks.map((stock, index) => {
    const color = colors[changeTone(stock.changePercent)];
    const material = new MeshStandardMaterial({ color, metalness: .48, roughness: .26, emissive: color, emissiveIntensity: .15 });
    const mesh = new Mesh(geometry, material);
    const group = new Group();
    group.position.set((index % columns - (columns - 1) / 2) * 1.2, 0, (Math.floor(index / columns) - (rows - 1) / 2) * 1.2);
    group.add(mesh, new LineSegments(edgesGeometry, edgeMaterial));
    group.scale.y = barHeight(stock.changePercent, maxChange);
    mesh.userData.index = index;
    scene.add(group);
    return { group, mesh, material, height: group.scale.y };
  });
  const raycaster = new Raycaster();
  const ringGeometry = new RingGeometry(.49, .52, 48);
  const ringMaterial = new MeshBasicMaterial({ color: 0xaecbff, transparent: true, opacity: .9 });
  const ring = new Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  const annotation = document.createElement('div');
  annotation.className = 'panorama-annotation'; annotation.setAttribute('aria-hidden', 'true');
  host.appendChild(annotation);
  const pointer = new Vector2();
  let frame = 0;
  let disposed = false;
  let selected = -1;
  const start = performance.now();
  let down = { x: 0, y: 0 };
  function requestRender() {
    if (!disposed && !frame && !document.hidden) frame = requestAnimationFrame(render);
  }
  function render(time: number) {
    frame = 0;
    if (disposed) return;
    const progress = reduced ? 1 : Math.min(1, (time - start) / 700);
    const eased = 1 - Math.pow(1 - progress, 3);
    bars.forEach((bar) => { bar.group.scale.y = bar.height * Math.max(.015, eased); });
    controls.update();
    if (selected >= 0) {
      const bar = bars[selected];
      const point = new Vector3(bar.group.position.x, bar.group.scale.y + .23, bar.group.position.z).project(camera);
      annotation.style.left = `${(point.x + 1) * host.clientWidth / 2}px`;
      annotation.style.top = `${(1 - point.y) * host.clientHeight / 2}px`;
      annotation.style.visibility = Math.abs(point.x) < .88 && Math.abs(point.y) < .85 && point.z < 1 ? 'visible' : 'hidden';
    }
    renderer.render(scene, camera);
    if (progress < 1) requestRender();
  }
  function setSelected(code: string) {
    const next = stocks.findIndex((stock) => stock.code === code);
    if (selected === next) return;
    if (selected >= 0) { bars[selected].material.emissiveIntensity = .15; bars[selected].material.color.set(colors[changeTone(stocks[selected].changePercent)]); }
    selected = next;
    if (selected >= 0) {
      bars[selected].material.emissiveIntensity = .65; bars[selected].material.color.lerp(new Color(0xffffff), .22);
      ring.position.set(bars[selected].group.position.x, .015, bars[selected].group.position.z); ring.visible = true;
      const stock = stocks[selected];
      annotation.textContent = `${stock.name} · ${stock.code} · ${changeLabel(stock.changePercent)}`;
    } else { ring.visible = false; annotation.style.visibility = 'hidden'; }
    requestRender();
  }
  function pick(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(bars.map((bar) => bar.mesh), false)[0];
    return hit ? stocks[hit.object.userData.index as number] : null;
  }
  function hover(event: PointerEvent) {
    if (event.buttons || event.pointerType === 'touch') return;
    const stock = pick(event);
    canvas.style.cursor = stock ? 'pointer' : 'grab';
    if (stock) onSelect(stock.code);
  }
  function pointerDown(event: PointerEvent) { down = { x: event.clientX, y: event.clientY }; }
  function pointerUp(event: PointerEvent) {
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return;
    const stock = pick(event); if (stock) onSelect(stock.code);
  }
  function reset() {
    const narrow = host.clientWidth < 600;
    // Flush the previous drag's inertia before restoring the saved viewing angle.
    controls.enableDamping = false; controls.update();
    camera.position.set(narrow ? 12 : 10, narrow ? 14 : 11, narrow ? 16 : 13);
    controls.target.set(0, .6, 0); controls.update(); controls.enableDamping = !reduced; requestRender();
  }
  function resize() {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false); camera.aspect = width / height;
    camera.updateProjectionMatrix(); requestRender();
  }
  function visibility() { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else requestRender(); }
  function contextLost(event: Event) { event.preventDefault(); onContextLost(); }
  controls.addEventListener('change', requestRender);
  canvas.addEventListener('pointermove', hover);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('webglcontextlost', contextLost);
  document.addEventListener('visibilitychange', visibility);
  const observer = new ResizeObserver(resize); observer.observe(host);
  resize(); reset();
  return {
    select: setSelected,
    reset,
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointermove', hover); canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('webglcontextlost', contextLost);
      controls.removeEventListener('change', requestRender); controls.dispose();
      geometry.dispose(); edgesGeometry.dispose(); edgeMaterial.dispose();
      bars.forEach((bar) => bar.material.dispose()); grid.geometry.dispose(); grid.material.dispose();
      ringGeometry.dispose(); ringMaterial.dispose(); annotation.remove();
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
