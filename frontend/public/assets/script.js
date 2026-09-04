/* ============================================================
   Radiology Atlas - Application Logic
   Modality-driven rendering: X-RAY | CT | MRI | US | DEXA
   ============================================================ */

let scene, camera, renderer, raycaster, mouse, controls;
let anatomy = null;              // { groups, pickables }
let protocolData = {};
let selectedObject = null;
let hoveredObject = null;
let audioContext;
let currentMode = 'XRAY';
const ctLayers = { bone: true, soft: true, vess: true };

function setVisibleRecursive(obj, visible) {
    obj.visible = visible;
    if (obj.children) obj.traverse(c => { if (c.isMesh) c.visible = visible; });
}

const MODES = ['XRAY', 'CT', 'MRI', 'ANGIO', 'US', 'DEXA'];
const HUD_TEXT = {
    XRAY:  'MODE: X-RAY \u00b7 OSSEOUS SURVEY \u00b7 kVp 120 mAs 16',
    CT:    'MODE: COMPUTED TOMOGRAPHY \u00b7 WINDOW: COMPOSITE',
    MRI:   'MODE: MRI \u00b7 T2 FS / STIR SOFT TISSUE',
    ANGIO: 'MODE: ANGIOGRAPHY / MRA / CTA \u00b7 VASCULAR ROADMAP & CONTRAST MIP',
    US:    'MODE: ULTRASOUND \u00b7 12 MHz LINEAR PROBE',
    DEXA:  'MODE: DEXA \u00b7 BMD DENSITY MAP (T-SCORE)'
};

const DEFAULT_CAM = { pos: [0, 4.5, 24], target: [0, 2.2, 0] };

init();
animate();

function makeGroundTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    grad.addColorStop(0, 'rgba(64,120,180,0.55)');
    grad.addColorStop(0.45, 'rgba(30,60,100,0.28)');
    grad.addColorStop(1, 'rgba(10,18,32,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(88,166,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(256, 256, 150, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = 'rgba(88,166,255,0.2)';
    ctx.beginPath(); ctx.arc(256, 256, 200, 0, Math.PI * 2); ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    return tex;
}

function loadProtocolData() {
    // Try fetch (works with http_server). On file:// failure, fall back to pywebview js_api.
    fetch('data.json')
        .then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(data => {
            protocolData = data;
            updateInfoPanel('Head', 'Circle of Willis (Arterial Ring)');
        })
        .catch(err => {
            console.warn('fetch data.json failed, trying pywebview api:', err);
            try {
                if (window.pywebview && window.pywebview.api && window.pywebview.api.get_data_json) {
                    window.pywebview.api.get_data_json().then(txt => {
                        try {
                            protocolData = JSON.parse(txt);
                            updateInfoPanel('Head', 'Circle of Willis (Arterial Ring)');
                        } catch (e) { console.error('api JSON parse failed', e); }
                    });
                } else {
                    // retry once after pywebview ready event
                    window.addEventListener('pywebviewready', () => {
                        if (window.pywebview && window.pywebview.api && window.pywebview.api.get_data_json) {
                            window.pywebview.api.get_data_json().then(txt => {
                                try {
                                    protocolData = JSON.parse(txt);
                                    updateInfoPanel('Head', 'Circle of Willis (Arterial Ring)');
                                } catch (e) { console.error(e); }
                            });
                        }
                    });
                }
            } catch (e) { console.error('api fallback failed', e); }
        });
}

function init() {
    loadProtocolData();

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { /* no audio */ }

    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(...DEFAULT_CAM.pos);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    // THREE r152+ uses outputColorSpace, r128 uses outputEncoding — support both
    if ('outputColorSpace' in renderer) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
        renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 60;
    controls.minDistance = 6;
    controls.target.set(...DEFAULT_CAM.target);
    controls.autoRotateSpeed = 1.6;

    // Studio lighting rig
    scene.fog = new THREE.FogExp2(0x0a1220, 0.006);
    const hemi = new THREE.HemisphereLight(0xbdd4ff, 0x1a1410, 0.55);
    scene.add(hemi);
    scene.add(new THREE.AmbientLight(0xffffff, 0.28));

    const key = new THREE.DirectionalLight(0xfff4e0, 1.05);
    key.position.set(10, 16, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -14; key.shadow.camera.right = 14;
    key.shadow.camera.top = 14; key.shadow.camera.bottom = -10;
    key.shadow.camera.near = 2; key.shadow.camera.far = 60;
    key.shadow.bias = -0.0008;
    key.shadow.radius = 3;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x58a6ff, 0.75);
    rim.position.set(-12, 6, -14);
    scene.add(rim);
    const fill = new THREE.PointLight(0x7ec8ff, 0.35, 90);
    fill.position.set(-8, 4, 14);
    scene.add(fill);
    const bounce = new THREE.PointLight(0xffb08a, 0.25, 80);
    bounce.position.set(6, 0.5, 8);
    scene.add(bounce);

    // Display platform
    const groundGeo = new THREE.CircleGeometry(13, 64);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({
        map: makeGroundTexture(),
        transparent: true,
        depthWrite: false
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -6.35;
    scene.add(ground);

    // Build the anatomical body
    anatomy = Anatomy.build(scene);

    // Swap in real, anatomically-accurate models (skeleton/organs) as they load
    if (typeof Anatomy.loadRealModels === 'function') {
      Anatomy.loadRealModels(anatomy.groups, function () {
        applyMode(currentMode || 'ANGIO');
        if (renderer) renderer.render(scene, camera);
      });
    }

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    window.addEventListener('resize', onWindowResize);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('click', onClick);
    container.addEventListener('dblclick', onDoubleClick);

    document.getElementById('search-bar').addEventListener('input', handleSearch);

    document.querySelectorAll('.region-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.region-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            clearSelection();
            updateInfoPanel(tab.dataset.region, null);
        });
    });

    bindUI();
    applyMode('ANGIO');
    updateInfoPanel('Head', 'Circle of Willis (Arterial Ring)');
    window.__app = { scene, camera, renderer, anatomy, controls };
}

/* ---------------- UI ---------------- */
function bindUI() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => applyMode(btn.dataset.mode));
    });
    document.querySelectorAll('.layer-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const layer = chip.dataset.layer;
            ctLayers[layer] = !ctLayers[layer];
            chip.classList.toggle('off', !ctLayers[layer]);
            applyMode(currentMode);   // re-evaluate visibility
        });
    });
    const resetBtn = document.getElementById('reset-view');
    if (resetBtn) resetBtn.addEventListener('click', resetView);
    const rotBtn = document.getElementById('auto-rotate');
    if (rotBtn) rotBtn.addEventListener('click', () => {
        controls.autoRotate = !controls.autoRotate;
        rotBtn.classList.toggle('active', controls.autoRotate);
        rotBtn.setAttribute('aria-pressed', String(controls.autoRotate));
    });

    // Settings panel
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsClose = document.getElementById('settings-close');
    const settingsBackdrop = settingsPanel?.querySelector('.settings-backdrop');

    function openSettings() {
        settingsPanel.hidden = false;
        settingsBtn.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }
    function closeSettings() {
        settingsPanel.hidden = true;
        settingsBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }
    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    if (settingsClose) settingsClose.addEventListener('click', closeSettings);
    if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettings);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !settingsPanel.hidden) closeSettings();
    });

    // Rendering settings
    const qualityPreset = document.getElementById('quality-preset');
    const aaToggle = document.getElementById('aa-toggle');
    const tonemapSelect = document.getElementById('tonemap-select');
    const exposureSlider = document.getElementById('exposure-slider');
    const exposureValue = document.getElementById('exposure-value');

    if (qualityPreset) qualityPreset.addEventListener('change', () => {
        // Quality preset would require rebuilding geometry; placeholder for now
        console.log('Quality preset:', qualityPreset.value);
    });
    if (aaToggle) aaToggle.addEventListener('change', () => {
        // Would require renderer recreation; placeholder
        console.log('AA:', aaToggle.checked);
    });
    if (tonemapSelect) tonemapSelect.addEventListener('change', () => {
        if (renderer && THREE[tonemapSelect.value + 'ToneMapping'] !== undefined) {
            renderer.toneMapping = THREE[tonemapSelect.value + 'ToneMapping'];
        } else if (tonemapSelect.value === 'none') {
            renderer.toneMapping = THREE.NoToneMapping;
        }
    });
    if (exposureSlider) exposureSlider.addEventListener('input', () => {
        renderer.toneMappingExposure = parseFloat(exposureSlider.value);
        if (exposureValue) exposureValue.textContent = exposureSlider.value;
    });

    // CT layers
    const ctBone = document.getElementById('ct-bone');
    const ctSoft = document.getElementById('ct-soft');
    const ctVess = document.getElementById('ct-vess');
    function updateCTLayers() {
        ctLayers.bone = ctBone?.checked ?? true;
        ctLayers.soft = ctSoft?.checked ?? true;
        ctLayers.vess = ctVess?.checked ?? true;
        if (currentMode === 'CT') applyMode('CT');
        // Update chips too
        document.querySelectorAll('.layer-chip[data-layer="bone"]').forEach(c => c.classList.toggle('off', !ctLayers.bone));
        document.querySelectorAll('.layer-chip[data-layer="soft"]').forEach(c => c.classList.toggle('off', !ctLayers.soft));
        document.querySelectorAll('.layer-chip[data-layer="vess"]').forEach(c => c.classList.toggle('off', !ctLayers.vess));
    }
    [ctBone, ctSoft, ctVess].forEach(el => el?.addEventListener('change', updateCTLayers));

    // Visualization
    const scannerToggle = document.getElementById('scanner-toggle');
    const hudToggle = document.getElementById('hud-toggle');
    const crosshairToggle = document.getElementById('crosshair-toggle');
    const gridToggle = document.getElementById('grid-toggle');
    if (scannerToggle) scannerToggle.addEventListener('change', () => {
        document.getElementById('scanner-line').style.display = scannerToggle.checked ? 'block' : 'none';
    });
    if (hudToggle) hudToggle.addEventListener('change', () => {
        document.getElementById('scanner-hud').style.display = hudToggle.checked ? 'flex' : 'none';
    });
    if (crosshairToggle) crosshairToggle.addEventListener('change', () => {
        document.querySelector('.viewer-frame').style.display = crosshairToggle.checked ? 'block' : 'none';
    });
    if (gridToggle) gridToggle.addEventListener('change', () => {
        document.getElementById('viewer-panel').style.setProperty('--grid-opacity', gridToggle.checked ? '0.55' : '0');
    });

    // Performance
    const autorotateSpeed = document.getElementById('autorotate-speed');
    const autorotateValue = document.getElementById('autorotate-value');
    const dampingSlider = document.getElementById('damping-slider');
    const dampingValue = document.getElementById('damping-value');
    if (autorotateSpeed) autorotateSpeed.addEventListener('input', () => {
        controls.autoRotateSpeed = parseFloat(autorotateSpeed.value);
        if (autorotateValue) autorotateValue.textContent = autorotateSpeed.value;
    });
    if (dampingSlider) dampingSlider.addEventListener('input', () => {
        controls.dampingFactor = parseFloat(dampingSlider.value);
        if (dampingValue) dampingValue.textContent = dampingSlider.value;
    });

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        const idx = parseInt(e.key, 10);
        if (idx >= 1 && idx <= MODES.length) applyMode(MODES[idx - 1]);
        if (e.key === 'r' || e.key === 'R') resetView();
        if (e.key === 'Escape') { clearSelection(); closeSettings(); }
    });
}

function setGroupVisible(group, visible, opacity) {
    group.visible = visible;
    group.children.forEach(m => {
        m.visible = visible;
        if (!m.material) return;
        if (visible && opacity !== undefined) {
            m.material.opacity = opacity;
            m.material.transparent = true;
            m.material.needsUpdate = true;
        }
    });
}

function restoreMaterial(m) {
    m.material.color.setHex(m.userData.baseColor);
    m.material.opacity = m.userData.baseOpacity;
}

function applyMode(mode) {
    currentMode = mode;

    document.querySelectorAll('.mode-btn').forEach(b => {
        const active = b.dataset.mode === mode;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
    });
    const chips = document.getElementById('ct-chips');
    if (chips) chips.style.display = (mode === 'CT') ? 'flex' : 'none';

    const { bones, organs, vessels, shell, muscles, soft } = anatomy.groups;

    // Reset everything to authored look first
    [...bones.children, ...organs.children, ...vessels.children, ...shell.children, ...muscles.children, ...soft.children].forEach(m => {
        if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ restoreMaterial(c); if(c.material.emissive) { c.material.emissive.setHex(c.userData.baseEmissive || 0x000000); c.material.emissiveIntensity=1.0; } } }); return; }
        restoreMaterial(m);
        if (m.material.emissive) {
            m.material.emissive.setHex(m.userData.baseEmissive || 0x000000);
            m.material.emissiveIntensity = 1.0;
        }
    });

    switch (mode) {
        case 'XRAY':
            setGroupVisible(shell, false);
            setGroupVisible(organs, false);
            setGroupVisible(vessels, false);
            setGroupVisible(muscles, false);
            setGroupVisible(soft, false);
            bones.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.transparent=false; c.material.opacity=1.0; c.material.color.setHex(0xeef4ff); if(c.material.emissive){ c.material.emissive.setHex(0xaebbce); c.material.emissiveIntensity=0.85; } }}); m.visible=true; return; }
                m.visible = true; m.material.transparent = false; m.material.opacity = 1.0;
                m.material.color.setHex(0xeef4ff);
                if (m.material.emissive) { m.material.emissive.setHex(0xaebbce); m.material.emissiveIntensity = 0.85; }
            });
            break;

        case 'CT':
            // CT: full body — skin as window, muscle/bone/vessels all visible for true anatomy
            shell.children.forEach(m => { if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=0.18; c.material.color.setHex(0xd9a184); }}); m.visible=true; return; } m.visible=true; m.material.opacity=0.18; m.material.color.setHex(0xd9a184); });
            // Soft tissue — continuous flesh volume so the body reads as tissue with organ/bone inside
            soft.children.forEach(m => { if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=ctLayers.soft; c.material.opacity=0.5; c.material.color.setHex(0xc98f7a); }}); m.visible=ctLayers.soft; return; } m.visible=ctLayers.soft; m.material.opacity=0.5; m.material.color.setHex(0xc98f7a); });
            muscles.children.forEach(m => { if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=ctLayers.soft; c.material.opacity=0.78; }}); m.visible=ctLayers.soft; return; } m.visible = ctLayers.soft; m.material.opacity = 0.78; });
            bones.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=ctLayers.bone; c.material.opacity=0.55; c.material.color.setHex(0xdfe6ee); }}); m.visible=ctLayers.bone; return; }
                m.visible = ctLayers.bone;
                m.material.opacity = 0.55;
                m.material.color.setHex(0xdfe6ee);
            });
            organs.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=ctLayers.soft; c.material.opacity=Math.min(c.userData.baseOpacity||1,0.95); }}); m.visible=ctLayers.soft; return; }
                m.visible = ctLayers.soft;
                m.material.opacity = Math.min(m.userData.baseOpacity, 0.95);
            });
            vessels.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=ctLayers.vess; c.material.opacity=0.95; }}); m.visible=ctLayers.vess; return; }
                m.visible = ctLayers.vess;
                m.material.opacity = 0.95;
            });
            break;

        case 'MRI':
            // MRI with MRA vessels — full soft tissue + angiography
            shell.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=0.32; c.material.color.setHex(0xd9a184); }}); m.visible=true; return; }
                m.visible = true; m.material.opacity = 0.32; m.material.color.setHex(0xd9a184);
            });
            // Soft tissue — primary MRI signal
            soft.children.forEach(m => { if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=0.82; c.material.color.setHex(0xc98f7a); }}); m.visible=true; return; } m.visible=true; m.material.opacity=0.82; m.material.color.setHex(0xc98f7a); });
            bones.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=0.22; c.material.color.setHex(0x33404f); }}); m.visible=true; return; }
                m.visible = true; m.material.opacity = 0.22; m.material.color.setHex(0x33404f);
            });
            muscles.children.forEach(m => { if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=0.88; }}); m.visible=true; return; } m.visible = true; m.material.opacity = 0.88; });
            organs.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=Math.min(c.userData.baseOpacity||1,0.98); }}); m.visible=true; return; }
                m.visible = true; m.material.opacity = Math.min(m.userData.baseOpacity, 0.98);
            });
            // MRA vessels — bright arterial
            vessels.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=0.92; c.material.color.setHex(0x00e5ff); c.material.emissive?.setHex(0x003344); c.material.emissiveIntensity=0.3; }}); m.visible=true; return; }
                m.visible = true; m.material.opacity = 0.92; m.material.color.setHex(0x00e5ff); 
                if(m.material.emissive){ m.material.emissive.setHex(0x003344); m.material.emissiveIntensity=0.3; }
            });
            break;

        case 'ANGIO':
            // Angiography / MRA / CTA — Fluoroscopic MIP & vascular roadmapping
            shell.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=0.03; c.material.color.setHex(0x1a2638); }}); m.visible=true; return; }
                m.visible = true; m.material.opacity = 0.03; m.material.color.setHex(0x1a2638);
            });
            setGroupVisible(soft, false);
            setGroupVisible(muscles, false);
            bones.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=0.12; c.material.color.setHex(0x223344); }}); m.visible=true; return; }
                m.visible = true; m.material.opacity = 0.12; m.material.color.setHex(0x223344);
            });
            // Faint organ parenchymal perfusion blush
            organs.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=0.35; c.material.color.setHex(0x004466); if(c.material.emissive) c.material.emissive.setHex(0x001a2e); }}); m.visible=true; return; }
                m.visible = true; m.material.opacity = 0.35; m.material.color.setHex(0x004466);
                if (m.material.emissive) m.material.emissive.setHex(0x001a2e);
            });
            // Hyperintense contrast-filled blood vessels (arteries in cyan, veins in royal blue)
            vessels.children.forEach(m => {
                const isVein = (m.name || '').includes('Vein') || (m.name || '').includes('Vena Cava') || (m.name || '').includes('IVC') || (m.name || '').includes('SVC');
                const col = isVein ? 0x2575fc : 0x00ffff;
                const emCol = isVein ? 0x1845ad : 0x00d4ff;
                const emInt = isVein ? 1.2 : 1.6;
                if (!m.material) {
                    m.traverse(c => {
                        if (c.isMesh && c.material) {
                            c.visible = true; c.material.opacity = 1.0; c.material.color.setHex(col);
                            if (c.material.emissive) { c.material.emissive.setHex(emCol); c.material.emissiveIntensity = emInt; }
                        }
                    });
                    m.visible = true; return;
                }
                m.visible = true; m.material.opacity = 1.0; m.material.color.setHex(col);
                if (m.material.emissive) { m.material.emissive.setHex(emCol); m.material.emissiveIntensity = emInt; }
            });
            break;

        case 'US': {
            setGroupVisible(vessels, false);
            shell.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=0.2; c.material.color.setHex(0x3d4c5c); }}); m.visible=true; return; }
                m.visible = true; m.material.opacity = 0.2; m.material.color.setHex(0x3d4c5c);
            });
            bones.children.forEach(m => { if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=0.08; }}); m.visible=true; return; } m.visible = true; m.material.opacity = 0.08; });
            muscles.children.forEach(m => { if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; c.material.opacity=0.5; }}); m.visible=true; return; } m.visible = true; m.material.opacity = 0.5; });
            [...organs.children, ...muscles.children, ...soft.children].forEach(m => {
                if (m.parent !== organs && m.parent !== muscles && m.parent !== soft) return;
                if (!m.material) { m.visible = true; return; }
                m.visible = true;
                m.material.opacity = 0.85;
                const c = new THREE.Color(m.userData.baseColor);
                const gray = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
                m.material.color.setRGB(gray * 1.25 + 0.18, gray * 1.25 + 0.18, gray * 1.25 + 0.18);
            });
            break;
        }

        case 'DEXA':
            setGroupVisible(shell, false);
            setGroupVisible(organs, false);
            setGroupVisible(vessels, false);
            setGroupVisible(muscles, false);
            setGroupVisible(soft, false);
            bones.children.forEach(m => {
                if (!m.material) { m.traverse(c=>{ if(c.isMesh && c.material){ c.visible=true; const d=c.userData.density!==undefined?c.userData.density:0.3; const hot=new THREE.Color(0xff7043),mid=new THREE.Color(0xffd54f),cold=new THREE.Color(0x2e7d32); const col=d>0.6?cold.clone().lerp(mid,(d-0.6)/0.4):mid.clone().lerp(hot,d/0.6); c.material.color.copy(col); if(c.material.emissive) c.material.emissive.copy(col).multiplyScalar(0.25); c.material.opacity=1.0; }}); m.visible=true; return; }
                m.visible = true;
                m.material.opacity = 1.0;
                const d = m.userData.density !== undefined ? m.userData.density : 0.3;
                const hot = new THREE.Color(0xff7043), mid = new THREE.Color(0xffd54f), cold = new THREE.Color(0x2e7d32);
                const c = d > 0.6 ? cold.clone().lerp(mid, (d - 0.6) / 0.4)
                                  : mid.clone().lerp(hot, d / 0.6);
                m.material.color.copy(c);
                if (m.material.emissive) m.material.emissive.copy(c).multiplyScalar(0.25);
            });
            break;
    }

    const hud = document.querySelector('.hud-text');
    if (hud) hud.innerText = HUD_TEXT[mode];
}

/* ---------------- INTERACTION & ANATOMICAL PICKING ---------------- */
function visiblePickables() {
    return anatomy.pickables.filter(m => m.visible && m.parent && m.parent.visible);
}

function resolveAnatomicalHit(hit) {
    if (!hit || !hit.object) return null;
    const obj = hit.object;
    const pt = hit.point;

    // Check if skeleton / bone mesh
    if (obj.userData.isSkeleton || obj.userData.kind === 'bone' || obj.parent === anatomy.groups.bones) {
        const y = pt ? pt.y : 4.0;
        const absX = pt ? Math.abs(pt.x) : 0;
        if (y >= 6.35) {
            return { obj, name: 'Cranium / Skull & Facial Bones', region: 'Head', kind: 'bone' };
        } else if (y >= 5.95) {
            return { obj, name: 'Cervical Spine (C1-C7)', region: 'Neck', kind: 'bone' };
        } else if (y >= 4.75) {
            if (absX > 0.65) return { obj, name: 'Shoulder Joint & Clavicle / Humerus', region: 'UpperLimb', kind: 'bone' };
            return { obj, name: 'Thoracic Spine & Ribcage / Sternum', region: 'Chest', kind: 'bone' };
        } else if (y >= 3.95) {
            if (absX > 0.70) return { obj, name: 'Forearm (Radius & Ulna) / Elbow', region: 'UpperLimb', kind: 'bone' };
            return { obj, name: 'Lumbar Spine (L1-L5)', region: 'Spine', kind: 'bone' };
        } else if (y >= 3.25) {
            if (absX > 0.75) return { obj, name: 'Wrist & Hand (Carpals & Metacarpals)', region: 'UpperLimb', kind: 'bone' };
            return { obj, name: 'Pelvis, Sacrum & Sacroiliac Joints', region: 'Abdomen', kind: 'bone' };
        } else if (y >= 1.95) {
            return { obj, name: 'Femur & Hip Joint', region: 'LowerLimb', kind: 'bone' };
        } else if (y >= 1.55) {
            return { obj, name: 'Knee Joint (Patella, Femoral Condyles & Tibial Plateau)', region: 'LowerLimb', kind: 'bone' };
        } else if (y >= 0.35) {
            return { obj, name: 'Tibia & Fibula (Lower Leg)', region: 'LowerLimb', kind: 'bone' };
        } else {
            return { obj, name: 'Ankle Joint & Foot (Tarsals, Metatarsals, Calcaneus)', region: 'LowerLimb', kind: 'bone' };
        }
    }

    // Direct named objects (vessels, organs, soft tissues)
    const name = obj.userData.name || 'Anatomical Structure';
    let region = obj.userData.region || 'Chest';
    if (region === 'Head & Neck') region = 'Head';
    if (region === 'Body') region = 'Chest';
    const kind = obj.userData.kind || 'tissue';
    return { obj, name, region, kind };
}

function pick(event) {
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(visiblePickables(), true);
    return hits.length ? hits[0] : null;
}

function playBeep() {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, audioContext.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
    osc.connect(gain); gain.connect(audioContext.destination);
    osc.start(); osc.stop(audioContext.currentTime + 0.12);
}

function onMouseMove(event) {
    const hit = pick(event);
    const target = hit ? resolveAnatomicalHit(hit) : null;
    const tooltip = document.getElementById('tooltip');
    const lockEl = document.getElementById('target-lock');

    if (target) {
        const obj = target.obj;
        document.body.style.cursor = 'pointer';
        if (hoveredObject && hoveredObject !== selectedObject && hoveredObject !== obj) {
            if (hoveredObject.material && hoveredObject.material.emissive) {
                hoveredObject.material.emissive.setHex(hoveredObject.userData.baseEmissive || 0x000000);
                hoveredObject.material.emissiveIntensity = 1.0;
            }
        }
        hoveredObject = obj;
        if (obj !== selectedObject && obj.material && obj.material.emissive) {
            obj.material.emissive.setHex(0x1c4e80);
            obj.material.emissiveIntensity = 0.9;
        }
        if (!selectedObject) {
            lockEl.innerText = 'TARGET: ' + target.name.toUpperCase();
            lockEl.style.color = '#58a6ff';
        }
        tooltip.style.display = 'block';
        tooltip.innerText = target.name + ' (' + target.region + ')';
        tooltip.style.left = (event.clientX - document.getElementById('viewer-panel').getBoundingClientRect().left + 14) + 'px';
        tooltip.style.top = (event.clientY - document.getElementById('viewer-panel').getBoundingClientRect().top + 10) + 'px';
    } else {
        document.body.style.cursor = 'default';
        tooltip.style.display = 'none';
        if (hoveredObject && hoveredObject !== selectedObject) {
            if (hoveredObject.material && hoveredObject.material.emissive) {
                hoveredObject.material.emissive.setHex(hoveredObject.userData.baseEmissive || 0x000000);
                hoveredObject.material.emissiveIntensity = 1.0;
            }
            hoveredObject = null;
        }
        if (!selectedObject) {
            lockEl.innerText = 'NO TARGET';
            lockEl.style.color = '#3fb950';
        }
    }
}

function onClick(event) {
    const hit = pick(event);
    const target = hit ? resolveAnatomicalHit(hit) : null;
    if (!target) return;
    playBeep();

    if (selectedObject && selectedObject.material && selectedObject.material.emissive) {
        selectedObject.material.emissive.setHex(selectedObject.userData.baseEmissive || 0x000000);
        selectedObject.material.emissiveIntensity = 1.0;
    }
    selectedObject = target.obj;
    if (selectedObject.material && selectedObject.material.emissive) {
        selectedObject.material.emissive.setHex(0xff5555);
        selectedObject.material.emissiveIntensity = 0.85;
    }

    document.getElementById('target-lock').innerText = 'LOCKED: ' + target.name.toUpperCase();
    document.getElementById('target-lock').style.color = '#ff5555';

    updateInfoPanel(target.region, target.name);
}

function onDoubleClick(event) {
    const obj = pick(event);
    if (!obj) return;
    focusOn(obj);
}

function focusOn(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.8);
    const dist = THREE.MathUtils.clamp(radius * 3.2, controls.minDistance + 0.5, 30);
    const dir = camera.position.clone().sub(controls.target).normalize();
    const endPos = center.clone().add(dir.multiplyScalar(dist));

    const from = { t: 0 };
    const startPos = camera.position.clone();
    const startTgt = controls.target.clone();
    new TWEEN.Tween(from).to({ t: 1 }, 900)
        .easing(TWEEN.Easing.Cubic.InOut)
        .onUpdate(() => {
            camera.position.lerpVectors(startPos, endPos, from.t);
            controls.target.lerpVectors(startTgt, center, from.t);
        })
        .start();
}

function resetView() {
    const endPos = new THREE.Vector3(...DEFAULT_CAM.pos);
    const endTgt = new THREE.Vector3(...DEFAULT_CAM.target);
    const from = { t: 0 };
    const startPos = camera.position.clone();
    const startTgt = controls.target.clone();
    new TWEEN.Tween(from).to({ t: 1 }, 800)
        .easing(TWEEN.Easing.Cubic.InOut)
        .onUpdate(() => {
            camera.position.lerpVectors(startPos, endPos, from.t);
            controls.target.lerpVectors(startTgt, endTgt, from.t);
        })
        .start();
    clearSelection();
}

function clearSelection() {
    if (selectedObject) {
        selectedObject.material.emissive.setHex(selectedObject.userData.baseEmissive || 0x000000);
        selectedObject.material.emissiveIntensity = 1.0;
        selectedObject = null;
    }
    document.getElementById('target-lock').innerText = 'NO TARGET';
    document.getElementById('target-lock').style.color = '#3fb950';
}

/* ---------------- INFO PANEL ---------------- */
function updateInfoPanel(regionId, structureName) {
    document.querySelectorAll('.region-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.region === regionId));
    const display = document.getElementById('content-display');
    let html = '';

    if (structureName && anatomy) {
        const info = anatomy.STRUCTURE_INFO[structureName];
        if (info) {
            html += `<div class="structure-badge">${info.kind.toUpperCase()} &middot; ${info.region}</div>`;
            html += `<p class="structure-blurb"><strong>${structureName}</strong> &mdash; ${info.kind} structure in the ${info.region} region. Select a modality above to see how it renders.</p>`;
        }
    }

    const data = regionId ? protocolData[regionId] : null;
    if (data) {
        html += `<h2>${data.title}</h2>${data.content}`;
        if (data.procedures && data.procedures.length) {
            html += `
                <div class="proc-filter-row">
                    <span class="proc-filter-title">CLINICAL PROCEDURES (${data.procedures.length})</span>
                    <div class="proc-filters" role="group" aria-label="Filter procedures">
                        <button class="proc-filter-btn active" data-filter="ALL">ALL</button>
                        <button class="proc-filter-btn" data-filter="MRI">MRI / MRA</button>
                        <button class="proc-filter-btn" data-filter="CT">CT / CTA</button>
                        <button class="proc-filter-btn" data-filter="XR">X-RAY</button>
                        <button class="proc-filter-btn" data-filter="US">ULTRASOUND</button>
                    </div>
                </div>
            `;
            html += '<div class="procedures-grid" id="procedures-container">';
            data.procedures.forEach(p => {
                const tech = p.technique || {};
                const techRows = Object.entries(tech).map(([k,v]) => `<span class="tech-pill"><b>${k}</b> ${v}</span>`).join('');
                html += `<div class="proc-card proc-${p.modality.toLowerCase()}" data-modality="${p.modality.toUpperCase()}">
                    <div class="proc-head"><span class="proc-mod">${p.modality}</span><span class="proc-name">${p.name}</span></div>
                    ${p.indications ? `<div class="proc-row"><span class="proc-label">Indications</span><span class="proc-val">${p.indications.join(', ')}</span></div>` : ''}
                    ${p.contrast ? `<div class="proc-row"><span class="proc-label">Contrast</span><span class="proc-val">${p.contrast}</span></div>` : '<div class="proc-row"><span class="proc-label">Contrast</span><span class="proc-val">None</span></div>'}
                    ${techRows ? `<div class="proc-tech">${techRows}</div>` : ''}
                    ${p.positioning ? `<div class="proc-row"><span class="proc-label">Position</span><span class="proc-val">${p.positioning}</span></div>` : ''}
                    ${p.notes ? `<div class="proc-notes">${p.notes}</div>` : ''}
                </div>`;
            });
            html += '</div>';
        }
        display.style.transition = 'opacity 0.3s ease';
        display.style.opacity = 0;
        setTimeout(() => {
            display.innerHTML = html;
            display.style.opacity = 1;
            bindProcFilters(display);
        }, 100);
    } else if (html) {
        display.innerHTML = html + '<div class="empty-state"><h3>Select a body region for full protocols.</h3></div>';
    } else {
        display.innerHTML = '<div class="empty-state"><h3>Information for this region is currently unavailable.</h3></div>';
    }
}

function bindProcFilters(container) {
    const btns = container.querySelectorAll('.proc-filter-btn');
    if (!btns.length) return;
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const f = btn.dataset.filter;
            container.querySelectorAll('.proc-card').forEach(card => {
                const mod = card.dataset.modality || '';
                if (f === 'ALL') {
                    card.style.display = '';
                } else if (f === 'MRI' && (mod === 'MRI' || mod === 'MRA')) {
                    card.style.display = '';
                } else if (f === 'CT' && (mod === 'CT' || mod === 'CTA')) {
                    card.style.display = '';
                } else if (f === 'XR' && (mod === 'XR' || mod === 'X-RAY' || mod === 'XRAY')) {
                    card.style.display = '';
                } else if (f === 'US' && (mod === 'US' || mod === 'ULTRASOUND')) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const display = document.getElementById('content-display');

    if (!query) {
        if (selectedObject) {
            updateInfoPanel(selectedObject.userData.region, selectedObject.userData.name);
        } else {
            display.innerHTML = '<div class="empty-state"><h3>Select an anatomical region to begin.</h3></div>';
        }
        return;
    }

    let resultsHTML = `<h2>Search Results for "${query}"</h2>`;
    let found = false;

    for (const [, section] of Object.entries(protocolData)) {
        if (section.title.toLowerCase().includes(query) || section.content.toLowerCase().includes(query)) {
            found = true;
            resultsHTML += `
                <div style="margin-bottom: 30px; border-bottom: 1px solid #30363d; padding-bottom: 20px;">
                    <h3 style="color: #ffb000;">In ${section.title}</h3>
                    ${highlightQuery(section.content, query)}
                </div>`;
        }
    }

    // also search anatomical structures
    for (const [name, info] of Object.entries(anatomy.STRUCTURE_INFO)) {
        if (name.toLowerCase().includes(query)) {
            found = true;
            resultsHTML += `
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #58a6ff;">Structure: ${name}</h3>
                    <p style="padding: 10px 15px; background: rgba(88,166,255,0.06); border-radius: 6px;">${highlightQuery(info, query)}</p>
                </div>`;
        }
    }

    if (!found) {
        resultsHTML += '<div class="empty-state"><h3>No protocols matched your search.</h3></div>';
    }
    display.innerHTML = resultsHTML;
}

function highlightQuery(html, query) {
    // Highlight query matches in text nodes only, preserving HTML structure.
    // Pure DOM construction - safe against entity-decoded text (e.g. "&lt;6mm").
    const template = document.createElement('template');
    template.innerHTML = html;
    const q = query.toLowerCase();

    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => node.parentElement && /^(SCRIPT|STYLE|MARK)$/.test(node.parentElement.tagName)
            ? NodeFilter.FILTER_REJECT
            : (node.nodeValue.toLowerCase().includes(q) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });

    const targets = [];
    while (walker.nextNode()) targets.push(walker.currentNode);

    for (const node of targets) {
        const frag = document.createDocumentFragment();
        const text = node.nodeValue;
        const lower = text.toLowerCase();
        let i = 0;
        while (true) {
            const idx = lower.indexOf(q, i);
            if (idx === -1) {
                if (i < text.length) frag.appendChild(document.createTextNode(text.slice(i)));
                break;
            }
            if (idx > i) frag.appendChild(document.createTextNode(text.slice(i, idx)));
            const mark = document.createElement('mark');
            mark.textContent = text.slice(idx, idx + q.length);
            frag.appendChild(mark);
            i = idx + q.length;
        }
        node.parentNode.replaceChild(frag, node);
    }

    const holder = document.createElement('div');
    holder.appendChild(template.content);
    return holder.innerHTML;
}

/* ---------------- LOOP ---------------- */
function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    TWEEN.update();

    // Heartbeat pulse on the heart in soft-tissue and angiography modes
    if (currentMode === 'CT' || currentMode === 'MRI' || currentMode === 'US' || currentMode === 'ANGIO') {
        const beat = 1 + Math.abs(Math.sin(Date.now() * 0.004)) * 0.06;
        anatomy.groups.organs.children.forEach(m => {
            if (m.userData.name === 'Heart') {
                const s = m.userData.baseScale || (m.userData.baseScale = m.scale.clone());
                m.scale.set(s.x * beat, s.y * beat, s.z * beat);
            }
        });
    }

    // Gentle breathing sway on torso shell pieces
    const breathPhase = Math.sin(Date.now() * 0.0012) * 0.012;
    anatomy.groups.shell.children.forEach(m => {
        if (m.userData.breath && m.scale) m.scale.z = 0.68 * (1 + breathPhase);
    });

    // Gentle emissive pulse for selection
    if (selectedObject && selectedObject.material.emissive) {
        selectedObject.material.emissiveIntensity = 0.65 + Math.sin(Date.now() * 0.006) * 0.25;
    }

    renderer.render(scene, camera);
}
