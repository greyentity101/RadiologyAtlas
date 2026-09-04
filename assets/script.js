/* ============================================================
   Radiology Atlas — Application Logic (v5.0)
   Modality Engine: X-RAY | CT | MRI | ANGIO | US | DEXA
   Apple Liquid Glass UI · Themes · Interactive Tinker Settings
   ============================================================ */

let scene, camera, renderer, raycaster, mouse, controls;
let anatomy = null;              // { groups, pickables, STRUCTURE_INFO }
let protocolData = {};
let selectedObject = null;
let hoveredObject = null;
let audioContext;
let currentMode = 'CT';

// Layer visibility states for CT mode
const ctLayers = { bone: true, vess: true, muscle: true, organs: false, skin: false };

// Lighting references for live tinkering
let ambientLight = null;
let keyLight = null;
let hemiLight = null;
let groundMesh = null;

const MODES = ['XRAY', 'CT', 'MRI', 'ANGIO', 'US', 'DEXA'];
const THEMES = [
    'theme-liquid-glass-dark',
    'theme-liquid-glass-frost',
    'theme-obsidian-gold',
    'theme-midnight-cyber',
    'theme-clinical-platinum'
];

const HUD_DATA = {
    XRAY:  { mod: 'X-RAY \u2022 PURE OSSEOUS RADIOGRAPHY', tel: '120 kVp \u2022 16 mAs \u2022 SID 180cm \u2022 Grid 10:1' },
    CT:    { mod: 'COMPUTED TOMOGRAPHY \u2022 BONE + VESSEL + MUSCLE', tel: '120 kVp \u2022 240 mAs \u2022 0.625mm \u2022 Pitch 0.98' },
    MRI:   { mod: 'MAGNETIC RESONANCE \u2022 ALL ANATOMICAL LAYERS HARMONIZED', tel: '3.0T \u2022 TR 4500ms \u2022 TE 98ms \u2022 T2 FS / STIR' },
    ANGIO: { mod: 'ANGIOGRAPHY \u2022 57-BRANCH VASCULAR ROADMAP & CONTRAST MIP', tel: 'Digital Subtraction (DSA) \u2022 7.5 fps \u2022 350 mg I/mL' },
    US:    { mod: 'ULTRASOUND \u2022 12 MHz HIGH-FREQUENCY LINEAR PROBE', tel: 'Focus 2.5cm \u2022 Dynamic Range 65dB \u2022 B-Mode + Color Doppler' },
    DEXA:  { mod: 'DEXA \u2022 BONE MINERAL DENSITY (BMD T-SCORE MAP)', tel: 'Dual-Energy X-Ray \u2022 L1-L4 & Femoral Neck \u2022 0.01 mSv' }
};

const DEFAULT_CAM = { pos: [0, 4.2, 22], target: [0, 2.2, 0] };

init();
animate();

function makeGroundTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.45)');
    grad.addColorStop(0.40, 'rgba(37, 117, 252, 0.22)');
    grad.addColorStop(1, 'rgba(3, 7, 18, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(256, 256, 140, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.18)';
    ctx.beginPath(); ctx.arc(256, 256, 190, 0, Math.PI * 2); ctx.stroke();
    return new THREE.CanvasTexture(c);
}

function loadProtocolData() {
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
            console.warn('fetch data.json failed, trying pywebview fallback:', err);
            try {
                if (window.pywebview && window.pywebview.api && window.pywebview.api.get_data_json) {
                    window.pywebview.api.get_data_json().then(txt => {
                        try {
                            protocolData = JSON.parse(txt);
                            updateInfoPanel('Head', 'Circle of Willis (Arterial Ring)');
                        } catch (e) { console.error('api JSON parse failed', e); }
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
    controls.maxDistance = 55;
    controls.minDistance = 5;
    controls.target.set(...DEFAULT_CAM.target);
    controls.autoRotateSpeed = 1.6;

    // Lighting rig
    scene.fog = new THREE.FogExp2(0x030712, 0.005);
    hemiLight = new THREE.HemisphereLight(0xbad2f8, 0x111622, 0.60);
    scene.add(hemiLight);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.28);
    scene.add(ambientLight);

    keyLight = new THREE.DirectionalLight(0xfff6ea, 1.05);
    keyLight.position.set(10, 16, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -14; keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 14; keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0008;
    scene.add(keyLight);

    const rim = new THREE.DirectionalLight(0x00e5ff, 0.75);
    rim.position.set(-12, 6, -14);
    scene.add(rim);

    const fill = new THREE.PointLight(0x7ec8ff, 0.35, 90);
    fill.position.set(-8, 4, 14);
    scene.add(fill);

    // Display platform
    const groundGeo = new THREE.CircleGeometry(13, 64);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({
        map: makeGroundTexture(),
        transparent: true,
        depthWrite: false
    });
    groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = -6.35;
    scene.add(groundMesh);

    // Build anatomical body
    anatomy = Anatomy.build(scene);

    // Swap in real anatomically-accurate models
    if (typeof Anatomy.loadRealModels === 'function') {
        Anatomy.loadRealModels(anatomy.groups, function (label) {
            console.log('Loaded real anatomical model:', label);
            applyMode(currentMode);
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
    initTheme();
    // Default mode: CT (Bone + Vessel + Muscle)
    applyMode('CT');
    window.__app = { scene, camera, renderer, anatomy, controls };
}

/* ---------------- Theme Engine ---------------- */
function initTheme() {
    const saved = localStorage.getItem('atlas_theme') || 'theme-liquid-glass-dark';
    setTheme(saved);
}

function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('atlas_theme', themeName);
    const sel = document.getElementById('theme-select');
    if (sel && sel.value !== themeName) sel.value = themeName;
}

function cycleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'theme-liquid-glass-dark';
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
}

/* ---------------- UI Binding & Tinker Controls ---------------- */
function bindUI() {
    // Modality toolbar buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => applyMode(btn.dataset.mode));
    });

    // CT layer chips
    document.querySelectorAll('.layer-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const layer = chip.dataset.layer;
            ctLayers[layer] = !ctLayers[layer];
            chip.classList.toggle('off', !ctLayers[layer]);
            // Sync settings checkboxes if open
            const cb = document.getElementById('layer-master-' + layer);
            if (cb) cb.checked = ctLayers[layer];
            applyMode(currentMode);
        });
    });

    // Header action buttons
    const themeBtn = document.getElementById('theme-quick-btn');
    if (themeBtn) themeBtn.addEventListener('click', cycleTheme);

    const resetBtn = document.getElementById('reset-view');
    if (resetBtn) resetBtn.addEventListener('click', resetView);

    const rotBtn = document.getElementById('auto-rotate');
    if (rotBtn) rotBtn.addEventListener('click', () => {
        controls.autoRotate = !controls.autoRotate;
        rotBtn.classList.toggle('active', controls.autoRotate);
        rotBtn.setAttribute('aria-pressed', String(controls.autoRotate));
    });

    // Settings modal
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

    // Theme selector inside settings
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.addEventListener('change', () => setTheme(themeSelect.value));

    // Exposure & lighting sliders
    const exposureSlider = document.getElementById('exposure-slider');
    const exposureValue = document.getElementById('exposure-value');
    if (exposureSlider) exposureSlider.addEventListener('input', () => {
        renderer.toneMappingExposure = parseFloat(exposureSlider.value);
        if (exposureValue) exposureValue.textContent = exposureSlider.value;
    });

    const tonemapSelect = document.getElementById('tonemap-select');
    if (tonemapSelect) tonemapSelect.addEventListener('change', () => {
        if (tonemapSelect.value === 'aces') renderer.toneMapping = THREE.ACESFilmicToneMapping;
        else if (tonemapSelect.value === 'reinhard') renderer.toneMapping = THREE.ReinhardToneMapping;
        else if (tonemapSelect.value === 'cineon') renderer.toneMapping = THREE.CineonToneMapping;
        else renderer.toneMapping = THREE.NoToneMapping;
    });

    const ambientSlider = document.getElementById('ambient-slider');
    const ambientValue = document.getElementById('ambient-value');
    if (ambientSlider) ambientSlider.addEventListener('input', () => {
        if (ambientLight) ambientLight.intensity = parseFloat(ambientSlider.value);
        if (ambientValue) ambientValue.textContent = ambientSlider.value;
    });

    const keylightSlider = document.getElementById('keylight-slider');
    const keylightValue = document.getElementById('keylight-value');
    if (keylightSlider) keylightSlider.addEventListener('input', () => {
        if (keyLight) keyLight.intensity = parseFloat(keylightSlider.value);
        if (keylightValue) keylightValue.textContent = keylightSlider.value;
    });

    // Master layer checkboxes & opacity sliders inside settings
    const layerKeys = ['bone', 'vess', 'muscle', 'organs', 'skin'];
    layerKeys.forEach(k => {
        const cb = document.getElementById('layer-master-' + k);
        const op = document.getElementById('opacity-' + k);
        if (cb) {
            cb.addEventListener('change', () => {
                ctLayers[k] = cb.checked;
                // Sync chip
                const chip = document.querySelector(`.layer-chip[data-layer="${k}"]`);
                if (chip) chip.classList.toggle('off', !cb.checked);
                applyMode(currentMode);
            });
        }
        if (op) {
            op.addEventListener('input', () => {
                const grpName = (k === 'bone') ? 'bones' : (k === 'vess') ? 'vessels' : (k === 'muscle') ? 'muscles' : (k === 'organs') ? 'organs' : 'shell';
                const grp = anatomy?.groups?.[grpName];
                if (grp) {
                    const val = parseFloat(op.value);
                    grp.children.forEach(m => {
                        if (m.material) { m.material.opacity = val; m.material.transparent = (val < 1.0); }
                        else m.traverse(c => { if (c.isMesh && c.material) { c.material.opacity = val; c.material.transparent = (val < 1.0); } });
                    });
                }
            });
        }
    });

    // Camera sliders
    const autorotateSpeed = document.getElementById('autorotate-speed');
    const autorotateValue = document.getElementById('autorotate-value');
    if (autorotateSpeed) autorotateSpeed.addEventListener('input', () => {
        controls.autoRotateSpeed = parseFloat(autorotateSpeed.value);
        if (autorotateValue) autorotateValue.textContent = autorotateSpeed.value + 'x';
    });

    const fovSlider = document.getElementById('fov-slider');
    const fovValue = document.getElementById('fov-value');
    if (fovSlider) fovSlider.addEventListener('input', () => {
        camera.fov = parseFloat(fovSlider.value);
        camera.updateProjectionMatrix();
        if (fovValue) fovValue.innerHTML = fovSlider.value + '&deg;';
    });

    const dampingSlider = document.getElementById('damping-slider');
    const dampingValue = document.getElementById('damping-value');
    if (dampingSlider) dampingSlider.addEventListener('input', () => {
        controls.dampingFactor = parseFloat(dampingSlider.value);
        if (dampingValue) dampingValue.textContent = dampingSlider.value;
    });

    // Overlays
    const scannerToggle = document.getElementById('scanner-toggle');
    if (scannerToggle) scannerToggle.addEventListener('change', () => {
        document.getElementById('scanner-line').style.display = scannerToggle.checked ? 'block' : 'none';
    });

    const hudToggle = document.getElementById('hud-toggle');
    if (hudToggle) hudToggle.addEventListener('change', () => {
        document.getElementById('scanner-hud').style.display = hudToggle.checked ? 'flex' : 'none';
    });

    const crosshairToggle = document.getElementById('crosshair-toggle');
    if (crosshairToggle) crosshairToggle.addEventListener('change', () => {
        document.querySelector('.viewer-frame').style.display = crosshairToggle.checked ? 'block' : 'none';
    });

    const gridToggle = document.getElementById('grid-toggle');
    if (gridToggle) gridToggle.addEventListener('change', () => {
        if (groundMesh) groundMesh.visible = gridToggle.checked;
    });

    // Reset settings button
    const resetSettingsBtn = document.getElementById('reset-settings-btn');
    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', () => {
            setTheme('theme-liquid-glass-dark');
            renderer.toneMappingExposure = 1.12;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            if (ambientLight) ambientLight.intensity = 0.28;
            if (keyLight) keyLight.intensity = 1.05;
            camera.fov = 45;
            camera.updateProjectionMatrix();
            controls.autoRotateSpeed = 1.6;
            controls.dampingFactor = 0.05;

            // Reset inputs
            if (exposureSlider) exposureSlider.value = 1.12;
            if (exposureValue) exposureValue.textContent = '1.12';
            if (ambientSlider) ambientSlider.value = 0.28;
            if (ambientValue) ambientValue.textContent = '0.28';
            if (keylightSlider) keylightSlider.value = 1.05;
            if (keylightValue) keylightValue.textContent = '1.05';
            if (fovSlider) fovSlider.value = 45;
            if (fovValue) fovValue.innerHTML = '45&deg;';
            if (autorotateSpeed) autorotateSpeed.value = 1.6;
            if (autorotateValue) autorotateValue.textContent = '1.6x';

            ctLayers.bone = true; ctLayers.vess = true; ctLayers.muscle = true; ctLayers.organs = false; ctLayers.skin = false;
            document.querySelectorAll('.layer-chip').forEach(c => {
                const l = c.dataset.layer;
                c.classList.toggle('off', !ctLayers[l]);
            });
            applyMode('CT');
        });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        const idx = parseInt(e.key, 10);
        if (idx >= 1 && idx <= MODES.length) applyMode(MODES[idx - 1]);
        if (e.key === 'r' || e.key === 'R') resetView();
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            controls.autoRotate = !controls.autoRotate;
            const b = document.getElementById('auto-rotate');
            if (b) b.classList.toggle('active', controls.autoRotate);
        }
        if (e.key === 'Escape') { clearSelection(); closeSettings(); }
        if (e.key === '/' && document.getElementById('search-bar')) {
            e.preventDefault();
            document.getElementById('search-bar').focus();
        }
    });
}

function setGroupVisible(group, visible, opacity) {
    if (!group) return;
    group.visible = visible;
    group.children.forEach(m => {
        m.visible = visible;
        if (!m.material) {
            m.traverse(c => {
                if (c.isMesh && c.material) {
                    c.visible = visible;
                    if (visible && opacity !== undefined) {
                        c.material.opacity = opacity;
                        c.material.transparent = (opacity < 1.0);
                        c.material.needsUpdate = true;
                    }
                }
            });
            return;
        }
        if (visible && opacity !== undefined) {
            m.material.opacity = opacity;
            m.material.transparent = (opacity < 1.0);
            m.material.needsUpdate = true;
        }
    });
}

function restoreMaterial(m) {
    if (!m.material) return;
    if (m.userData && m.userData.baseColor !== undefined) {
        m.material.color.setHex(m.userData.baseColor);
    }
    if (m.userData && m.userData.baseOpacity !== undefined) {
        m.material.opacity = m.userData.baseOpacity;
        m.material.transparent = (m.userData.baseOpacity < 1.0);
    }
}

/* ============================================================
   EXACT CLINICAL MODALITY RULES
   X-RAY : Pure Bones Only
   CT    : Bone + Blood Vessels + Muscle
   MRI   : All Layers Harmoniously Arranged
   ANGIO : Contrast Blood Vessels + Faint Bone Roadmap
   ============================================================ */
function applyMode(mode) {
    currentMode = mode;

    // Update buttons & HUD
    document.querySelectorAll('.mode-btn').forEach(b => {
        const active = b.dataset.mode === mode;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
    });

    const chips = document.getElementById('ct-chips');
    if (chips) chips.style.display = (mode === 'CT') ? 'flex' : 'none';

    const hudInfo = HUD_DATA[mode] || { mod: mode, tel: '' };
    const hudMod = document.getElementById('hud-modality');
    const hudTel = document.getElementById('hud-telemetry');
    if (hudMod) hudMod.textContent = hudInfo.mod;
    if (hudTel) hudTel.textContent = hudInfo.tel;

    if (!anatomy || !anatomy.groups) return;
    const { bones, organs, vessels, shell, muscles, soft } = anatomy.groups;

    // Reset base properties
    [bones, organs, vessels, shell, muscles, soft].forEach(grp => {
        if (!grp) return;
        grp.children.forEach(m => {
            if (m.material) {
                restoreMaterial(m);
                if (m.material.emissive) {
                    m.material.emissive.setHex(m.userData.baseEmissive || 0x000000);
                    m.material.emissiveIntensity = 1.0;
                }
            } else {
                m.traverse(c => {
                    if (c.isMesh && c.material) {
                        restoreMaterial(c);
                        if (c.material.emissive) {
                            c.material.emissive.setHex(c.userData.baseEmissive || 0x000000);
                            c.material.emissiveIntensity = 1.0;
                        }
                    }
                });
            }
        });
    });

    switch (mode) {
        case 'XRAY':
            // Pure Bone Only (white osseous radiopacity)
            setGroupVisible(bones, true, 1.0);
            bones.children.forEach(m => {
                if (m.material) {
                    m.material.color.setHex(0xf4f6fa);
                    if (m.material.emissive) { m.material.emissive.setHex(0x99aebb); m.material.emissiveIntensity = 0.4; }
                } else {
                    m.traverse(c => {
                        if (c.isMesh && c.material) {
                            c.material.color.setHex(0xf4f6fa);
                            if (c.material.emissive) { c.material.emissive.setHex(0x99aebb); c.material.emissiveIntensity = 0.4; }
                        }
                    });
                }
            });
            setGroupVisible(organs, false);
            setGroupVisible(vessels, false);
            setGroupVisible(muscles, false);
            setGroupVisible(shell, false);
            setGroupVisible(soft, false);
            break;

        case 'CT':
            // CT: Bone + Vessel + Muscle
            setGroupVisible(bones, ctLayers.bone, 0.95);
            bones.children.forEach(m => {
                if (m.material) { m.material.color.setHex(0xe8eef5); }
                else m.traverse(c => { if (c.isMesh && c.material) c.material.color.setHex(0xe8eef5); });
            });

            // Razor-sharp contrast blood vessels
            setGroupVisible(vessels, ctLayers.vess, 1.0);
            vessels.children.forEach(m => {
                const isVein = (m.name || '').includes('Vein') || (m.name || '').includes('Vena Cava') || (m.name || '').includes('IVC') || (m.name || '').includes('SVC');
                const col = isVein ? 0x2575fc : 0x00ffff;
                const em = isVein ? 0x113388 : 0x007799;
                if (m.material) {
                    m.material.color.setHex(col);
                    if (m.material.emissive) { m.material.emissive.setHex(em); m.material.emissiveIntensity = 0.8; }
                } else {
                    m.traverse(c => {
                        if (c.isMesh && c.material) {
                            c.material.color.setHex(col);
                            if (c.material.emissive) { c.material.emissive.setHex(em); c.material.emissiveIntensity = 0.8; }
                        }
                    });
                }
            });

            // Muscular tissue window
            setGroupVisible(muscles, ctLayers.muscle, 0.75);
            muscles.children.forEach(m => {
                if (m.material) { m.material.color.setHex(0x9b3b3a); }
                else m.traverse(c => { if (c.isMesh && c.material) c.material.color.setHex(0x9b3b3a); });
            });

            // Visceral organs and skin off by default in CT, toggleable via chips
            setGroupVisible(organs, !!ctLayers.organs, 0.85);
            setGroupVisible(shell, !!ctLayers.skin, 0.12);
            setGroupVisible(soft, false);
            break;

        case 'MRI':
            // All anatomical layers harmoniously arranged together
            setGroupVisible(bones, true, 0.40);
            bones.children.forEach(m => {
                if (m.material) { m.material.color.setHex(0x3a4856); }
                else m.traverse(c => { if (c.isMesh && c.material) c.material.color.setHex(0x3a4856); });
            });

            // Parenchymal soft tissue organs
            setGroupVisible(organs, true, 0.90);

            // MRA blood vessels
            setGroupVisible(vessels, true, 0.95);
            vessels.children.forEach(m => {
                if (m.material) {
                    m.material.color.setHex(0x00e5ff);
                    if (m.material.emissive) { m.material.emissive.setHex(0x004455); m.material.emissiveIntensity = 0.4; }
                } else {
                    m.traverse(c => {
                        if (c.isMesh && c.material) {
                            c.material.color.setHex(0x00e5ff);
                            if (c.material.emissive) { c.material.emissive.setHex(0x004455); c.material.emissiveIntensity = 0.4; }
                        }
                    });
                }
            });

            // Muscles & Soft tissue
            setGroupVisible(muscles, true, 0.80);
            setGroupVisible(soft, true, 0.15);

            // Delicate translucent skin contour
            setGroupVisible(shell, true, 0.12);
            break;

        case 'ANGIO':
            // Glowing contrast blood vessels + faint bone roadmap
            setGroupVisible(vessels, true, 1.0);
            vessels.children.forEach(m => {
                const isVein = (m.name || '').includes('Vein') || (m.name || '').includes('Vena Cava') || (m.name || '').includes('IVC') || (m.name || '').includes('SVC');
                const col = isVein ? 0x2575fc : 0x00ffff;
                const em = isVein ? 0x1845ad : 0x00e5ff;
                if (m.material) {
                    m.material.color.setHex(col);
                    if (m.material.emissive) { m.material.emissive.setHex(em); m.material.emissiveIntensity = 1.8; }
                } else {
                    m.traverse(c => {
                        if (c.isMesh && c.material) {
                            c.material.color.setHex(col);
                            if (c.material.emissive) { c.material.emissive.setHex(em); c.material.emissiveIntensity = 1.8; }
                        }
                    });
                }
            });

            // Dim bone roadmap
            setGroupVisible(bones, true, 0.12);
            bones.children.forEach(m => {
                if (m.material) { m.material.color.setHex(0x223344); }
                else m.traverse(c => { if (c.isMesh && c.material) c.material.color.setHex(0x223344); });
            });

            // Faint organ capillary blush
            setGroupVisible(organs, true, 0.25);
            organs.children.forEach(m => {
                if (m.material) {
                    m.material.color.setHex(0x004466);
                    if (m.material.emissive) { m.material.emissive.setHex(0x001a2e); m.material.emissiveIntensity = 0.5; }
                }
            });

            setGroupVisible(muscles, false);
            setGroupVisible(shell, false);
            setGroupVisible(soft, false);
            break;

        case 'US':
            setGroupVisible(shell, true, 0.25);
            setGroupVisible(organs, true, 0.85);
            setGroupVisible(muscles, true, 0.70);
            setGroupVisible(bones, true, 0.80);
            setGroupVisible(vessels, false);
            setGroupVisible(soft, true, 0.20);
            break;

        case 'DEXA':
            setGroupVisible(bones, true, 1.0);
            bones.children.forEach(m => {
                // Color-code bone mineral density map (Green = normal, Amber = osteopenia, Red = osteoporosis)
                const y = m.position.y || 0;
                let c = 0x10e38a;
                if (y > 4.2 && y < 4.8) c = 0xffb224; // lumbar spine
                if (y > 3.0 && y < 3.5) c = 0xff5a6b; // femoral neck
                if (m.material) {
                    m.material.color.setHex(c);
                    if (m.material.emissive) { m.material.emissive.setHex(c); m.material.emissiveIntensity = 0.3; }
                }
            });
            setGroupVisible(organs, false);
            setGroupVisible(vessels, false);
            setGroupVisible(muscles, false);
            setGroupVisible(shell, true, 0.08);
            setGroupVisible(soft, false);
            break;
    }
}

/* ---------------- 3D Interaction & Raycasting ---------------- */
function onMouseMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(anatomy.pickables, true);
    const visibleHit = intersects.find(hit => hit.object.visible && (!hit.object.material || hit.object.material.opacity > 0.08));

    const tip = document.getElementById('tooltip');
    if (visibleHit) {
        document.body.style.cursor = 'pointer';
        const name = visibleHit.object.userData.name || visibleHit.object.name || 'Structure';
        if (tip) {
            tip.style.display = 'block';
            tip.style.left = e.clientX + 'px';
            tip.style.top = e.clientY + 'px';
            tip.textContent = name;
        }
    } else {
        document.body.style.cursor = 'default';
        if (tip) tip.style.display = 'none';
    }
}

function onClick(e) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(anatomy.pickables, true);
    const visibleHit = intersects.find(hit => hit.object.visible && (!hit.object.material || hit.object.material.opacity > 0.08));

    if (visibleHit) {
        selectObject(visibleHit.object);
    } else {
        clearSelection();
    }
}

function selectObject(obj) {
    clearSelection();
    selectedObject = obj;
    const name = obj.userData.name || obj.name || 'Structure';
    const region = obj.userData.region || 'Head';

    const targetLock = document.getElementById('target-lock');
    if (targetLock) targetLock.textContent = name.toUpperCase();

    // Emissive highlight
    if (obj.material && obj.material.emissive) {
        obj.material.emissive.setHex(0x00e5ff);
        obj.material.emissiveIntensity = 1.5;
    }

    // Update protocol sidebar & switch region tab
    const tab = document.querySelector(`.region-tab[data-region="${region}"]`);
    if (tab) {
        document.querySelectorAll('.region-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    }
    updateInfoPanel(region, name);
}

function clearSelection() {
    if (selectedObject && selectedObject.material && selectedObject.material.emissive) {
        selectedObject.material.emissive.setHex(selectedObject.userData.baseEmissive || 0x000000);
        selectedObject.material.emissiveIntensity = 1.0;
    }
    selectedObject = null;
    const targetLock = document.getElementById('target-lock');
    if (targetLock) targetLock.textContent = 'NO SELECTION';
}

function onDoubleClick(e) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(anatomy.pickables, true);
    const hit = intersects.find(h => h.object.visible);
    if (!hit) return;

    // Smooth fly-to animation using TWEEN
    const p = hit.point;
    new TWEEN.Tween(controls.target)
        .to({ x: p.x, y: p.y, z: p.z }, 800)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    const newPos = new THREE.Vector3().addVectors(p, dir.multiplyScalar(10));
    new TWEEN.Tween(camera.position)
        .to({ x: newPos.x, y: newPos.y, z: newPos.z }, 800)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();
}

function resetView() {
    new TWEEN.Tween(camera.position)
        .to({ x: DEFAULT_CAM.pos[0], y: DEFAULT_CAM.pos[1], z: DEFAULT_CAM.pos[2] }, 700)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();
    new TWEEN.Tween(controls.target)
        .to({ x: DEFAULT_CAM.target[0], y: DEFAULT_CAM.target[1], z: DEFAULT_CAM.target[2] }, 700)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();
    clearSelection();
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update();
    controls.update();
    renderer.render(scene, camera);
}

/* ---------------- Info Panel & Protocols Rendering ---------------- */
function updateInfoPanel(regionId, structureName) {
    const display = document.getElementById('content-display');
    if (!display) return;

    let html = '';
    if (structureName) {
        const info = (anatomy && anatomy.STRUCTURE_INFO) ? anatomy.STRUCTURE_INFO[structureName] : null;
        const kind = (info && info.kind) ? info.kind.toUpperCase() : 'ANATOMY';
        html += `<div class="structure-badge">${kind} &bull; ${regionId}</div>`;
        html += `<p class="structure-blurb"><strong>${structureName}</strong> &mdash; targeted structure in the ${regionId} region. Select any protocol below for technical acquisition parameters.</p>`;
    }

    const data = regionId ? protocolData[regionId] : null;
    if (data) {
        html += `<h2>${data.title}</h2>${data.content}`;
        if (data.procedures && data.procedures.length) {
            html += `
                <div class="proc-filter-row">
                    <span class="proc-filter-title">CLINICAL PROTOCOLS (${data.procedures.length})</span>
                    <div class="proc-filters" role="group" aria-label="Filter procedures">
                        <button class="proc-filter-btn active" data-filter="ALL">ALL</button>
                        <button class="proc-filter-btn" data-filter="CT">CT / CTA</button>
                        <button class="proc-filter-btn" data-filter="MRI">MRI / MRA</button>
                        <button class="proc-filter-btn" data-filter="XR">X-RAY</button>
                    </div>
                </div>
            `;
            html += '<div class="procedures-grid" id="procedures-container">';
            data.procedures.forEach(p => {
                const tech = p.technique || {};
                const techRows = Object.entries(tech).map(([k, v]) => `<span class="tech-pill"><b>${k}:</b> ${v}</span>`).join('');
                html += `
                    <div class="proc-card proc-${p.modality.toLowerCase().replace('/', '')}" data-modality="${p.modality.toUpperCase()}">
                        <div class="proc-head">
                            <span class="proc-mod">${p.modality}</span>
                            <span class="proc-name">${p.name}</span>
                        </div>
                        ${p.indications && p.indications.length ? `<div class="proc-row"><span class="proc-label">Indications</span><span class="proc-val">${p.indications.slice(0, 4).join(', ')}</span></div>` : ''}
                        ${p.contrast ? `<div class="proc-row"><span class="proc-label">Contrast</span><span class="proc-val">${p.contrast}</span></div>` : ''}
                        ${techRows ? `<div class="proc-tech">${techRows}</div>` : ''}
                        ${p.positioning ? `<div class="proc-row"><span class="proc-label">Positioning</span><span class="proc-val">${p.positioning}</span></div>` : ''}
                        ${p.notes ? `<div class="proc-notes">${p.notes}</div>` : ''}
                    </div>
                `;
            });
            html += '</div>';
        }

        display.innerHTML = html;
        bindProcFilters(display);

        // If a specific structure was clicked, highlight related protocol card
        if (structureName) {
            const matchCard = display.querySelector(`.proc-card`);
            if (matchCard) matchCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } else {
        display.innerHTML = '<div class="empty-state"><h3>Select an anatomical region to view protocols.</h3></div>';
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
                } else if (f === 'CT' && (mod === 'CT' || mod === 'CTA')) {
                    card.style.display = '';
                } else if (f === 'MRI' && (mod === 'MRI' || mod === 'MRA')) {
                    card.style.display = '';
                } else if (f === 'XR' && (mod === 'XR' || mod === 'X-RAY' || mod === 'XRAY')) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const display = document.getElementById('content-display');
    if (!query) {
        const activeTab = document.querySelector('.region-tab.active');
        updateInfoPanel(activeTab ? activeTab.dataset.region : 'Head', null);
        return;
    }

    let resultsHTML = `<div class="structure-badge">SEARCH RESULTS</div><h2>Matches for "${query}"</h2><div class="procedures-grid">`;
    let count = 0;

    for (const [region, section] of Object.entries(protocolData)) {
        if (section.procedures) {
            section.procedures.forEach(p => {
                const nameMatch = (p.name || '').toLowerCase().includes(query);
                const indMatch = (p.indications || []).some(i => i.toLowerCase().includes(query));
                const techMatch = JSON.stringify(p.technique || {}).toLowerCase().includes(query);
                const notesMatch = (p.notes || '').toLowerCase().includes(query);

                if (nameMatch || indMatch || techMatch || notesMatch) {
                    count++;
                    const tech = p.technique || {};
                    const techRows = Object.entries(tech).map(([k, v]) => `<span class="tech-pill"><b>${k}:</b> ${v}</span>`).join('');
                    resultsHTML += `
                        <div class="proc-card proc-${p.modality.toLowerCase().replace('/', '')}" data-modality="${p.modality.toUpperCase()}">
                            <div class="proc-head">
                                <span class="proc-mod">${p.modality}</span>
                                <span class="proc-name">${p.name} <small style="color:var(--text-muted);">(${region})</small></span>
                            </div>
                            ${p.indications && p.indications.length ? `<div class="proc-row"><span class="proc-label">Indications</span><span class="proc-val">${p.indications.slice(0, 3).join(', ')}</span></div>` : ''}
                            ${techRows ? `<div class="proc-tech">${techRows}</div>` : ''}
                            ${p.notes ? `<div class="proc-notes">${p.notes}</div>` : ''}
                        </div>
                    `;
                }
            });
        }
    }
    resultsHTML += '</div>';

    if (count === 0) {
        display.innerHTML = `<div class="empty-state"><h3>No clinical protocols found matching "${query}".</h3><p>Try searching for terms like "stroke", "aneurysm", "chest", "fracture", "pe", or "mra".</p></div>`;
    } else {
        display.innerHTML = resultsHTML;
    }
}
