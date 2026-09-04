// High-Fidelity Procedural Anatomy & Angiography Engine
// Full 3D anatomical modeling: Organs, Tissues, Muscles, Skin, and Angiography Vasculature
// Harmonized with 7.1-meter human skeleton coordinates (Y: 0.0 feet to 7.1 cranium)
(function (global) {
  'use strict';

  // ---------- deterministic value-noise (fbm) ----------
  function hash(n) { const s = Math.sin(n) * 43758.5453123; return s - Math.floor(s); }
  function noise3(x, y, z) {
    const p = [Math.floor(x), Math.floor(y), Math.floor(z)];
    const f = [x - p[0], y - p[1], z - p[2]];
    const u = [f[0]*f[0]*(3-2*f[0]), f[1]*f[1]*(3-2*f[1]), f[2]*f[2]*(3-2*f[2])];
    function g(i,j,k){ return hash((p[0]+i)*157 + (p[1]+j)*113 + (p[2]+k)*271); }
    const lx = (a,b,t)=>a+(b-a)*t;
    const c000=g(0,0,0), c100=g(1,0,0), c010=g(0,1,0), c110=g(1,1,0), c001=g(0,0,1), c101=g(1,0,1), c011=g(0,1,1), c111=g(1,1,1);
    return lx(lx(lx(c000,c100,u[0]), lx(c010,c110,u[0]), u[1]), lx(lx(c001,c101,u[0]), lx(c011,c111,u[0]), u[1]), u[2]);
  }
  function fbm(x,y,z,oct){ oct=oct||4; let a=0.5,f=1.0,s=0.0; for(let i=0;i<oct;i++){ s+=a*noise3(x*f,y*f,z*f); f*=2.0; a*=0.5; } return s; }

  // Displace geometry along normals by fbm
  function organic(geo, amp, freq, oct, seed) {
    geo.computeVertexNormals();
    const pos = geo.attributes.position; const nrm = geo.attributes.normal;
    const v = new THREE.Vector3(); const n = new THREE.Vector3();
    for (let i=0; i<pos.count; i++){
      v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nrm, i);
      const d = fbm(v.x*freq+seed, v.y*freq, v.z*freq-seed, oct) - 0.5;
      v.addScaledVector(n, d*amp);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    geo.attributes.position.needsUpdate = true;
    return geo;
  }

  // Smooth an ellipsoid
  function blob(rx, ry, rz, seg, sd) {
    const g = new THREE.SphereGeometry(1, seg, Math.max(16, Math.floor(seg*0.6)));
    const p = g.attributes.position; const v = new THREE.Vector3();
    for (let i=0; i<p.count; i++){
      v.fromBufferAttribute(p, i);
      v.x *= rx; v.y *= ry; v.z *= rz;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    if (sd) organic(g, sd.amp, sd.freq, sd.oct, sd.seed||0);
    return g;
  }

  // Lathe a profile around Y axis
  function lathe(profile, seg, sd) {
    const pts = profile.map(p => new THREE.Vector2(p[0], p[1]));
    const g = new THREE.LatheGeometry(pts, seg);
    if (sd) organic(g, sd.amp, sd.freq, sd.oct, sd.seed||0);
    return g;
  }

  // Tube along a 3D Catmull-Rom curve for blood vessels and tubular organs
  function limb(points, rStart, rEnd, radial, sd, seed) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    const avgR = (rStart + (rEnd != null ? rEnd : rStart)) * 0.5;
    const segs = Math.max(16, points.length * 8);
    const g = new THREE.TubeGeometry(curve, segs, avgR, radial || 10, false);
    if (sd) organic(g, sd.amp, sd.freq, sd.oct, seed || 0);
    return g;
  }

  function mkMesh(geo, color, opts) {
    opts = opts || {};
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      roughness: opts.rough != null ? opts.rough : 0.55,
      metalness: opts.metal != null ? opts.metal : 0.0,
      clearcoat: opts.clear != null ? opts.clear : 0.1,
      clearcoatRoughness: 0.3,
      sheen: opts.sheen != null ? opts.sheen : 0.0,
      transmission: opts.trans != null ? opts.trans : 0.0,
      thickness: opts.thick != null ? opts.thick : 0.5,
      transparent: true,
      opacity: opts.opacity != null ? opts.opacity : 1.0,
      side: THREE.DoubleSide,
      flatShading: false
    });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = false; m.receiveShadow = false;
    m.userData.baseColor = mat.color.getHex();
    m.userData.baseOpacity = mat.opacity;
    m.userData.baseEmissive = 0x000000;
    return m;
  }

  const STRUCTURE_INFO = {};
  function reg(group, mesh, name, region, kind) {
    mesh.name = name;
    mesh.userData.name = name;
    mesh.userData.region = region;
    mesh.userData.kind = kind;
    STRUCTURE_INFO[name] = { name, region, kind };
    if (mesh.isGroup) mesh.children.forEach(c => reg(group, c, name + '::' + c.name, region, kind));
    else group.add(mesh);
    return mesh;
  }

  function build(sceneRef) {
    const bones = new THREE.Group(); bones.name = 'bones';
    const organs = new THREE.Group(); organs.name = 'organs';
    const muscles = new THREE.Group(); muscles.name = 'muscles';
    const vessels = new THREE.Group(); vessels.name = 'vessels';
    const shell = new THREE.Group(); shell.name = 'shell';
    const soft = new THREE.Group(); soft.name = 'soft';

    // ===================== PROCEDURAL FALLBACK BONES =====================
    const skull = mkMesh(blob(0.72, 0.88, 0.82, 32, {amp:0.02, freq:2, oct:3, seed:10}), 0xf3ece0);
    skull.position.set(0, 6.72, 0); reg(bones, skull, 'Cranium / Skull', 'Head', 'bone');

    // Spine
    for (let i = 0; i < 7; i++) {
      const v = mkMesh(blob(0.20, 0.09, 0.18, 16), 0xeee6d6);
      v.position.set(0, 6.25 - i * 0.08, -0.05); reg(bones, v, 'C' + (i+1) + ' Vertebra', 'Neck', 'bone');
    }
    for (let i = 0; i < 12; i++) {
      const v = mkMesh(blob(0.24, 0.11, 0.22, 16), 0xeee6d6);
      v.position.set(0, 5.65 - i * 0.09, -0.08); reg(bones, v, 'T' + (i+1) + ' Vertebra', 'Chest', 'bone');
    }
    for (let i = 0; i < 5; i++) {
      const v = mkMesh(blob(0.28, 0.13, 0.25, 16), 0xeee6d6);
      v.position.set(0, 4.45 - i * 0.13, -0.06); reg(bones, v, 'L' + (i+1) + ' Vertebra', 'Spine', 'bone');
    }

    // Ribcage (Anatomically scaled to wrap around chest cavity)
    for (let i = 0; i < 10; i++) {
      const t = i / 9; const y = 5.65 - t * 1.05; const rx = 0.65 * Math.sin(Math.PI * t * 0.9) + 0.28;
      const ribL = mkMesh(limb([[-0.14, y, -0.08], [-rx, y - 0.04, 0.04], [-0.08, y - 0.10, 0.30]], 0.030, 0.025, 10), 0xebe3d3);
      const ribR = mkMesh(limb([[0.14, y, -0.08], [rx, y - 0.04, 0.04], [0.08, y - 0.10, 0.30]], 0.030, 0.025, 10), 0xebe3d3);
      reg(bones, ribL, 'Rib ' + (i+1) + ' (L)', 'Chest', 'bone');
      reg(bones, ribR, 'Rib ' + (i+1) + ' (R)', 'Chest', 'bone');
    }
    const sternum = mkMesh(blob(0.12, 0.48, 0.06, 16), 0xeee6d6);
    sternum.position.set(0, 5.15, 0.30); reg(bones, sternum, 'Sternum', 'Chest', 'bone');

    // Pelvis
    const pelvis = mkMesh(blob(0.82, 0.48, 0.58, 24, {amp:0.03, freq:3, oct:3, seed:20}), 0xece4d2);
    pelvis.position.set(0, 3.45, -0.02); reg(bones, pelvis, 'Pelvic Girdle', 'Abdomen', 'bone');

    // Limbs
    [[-1, 1], [1, 1]].forEach(([s]) => {
      const fe = mkMesh(limb([[s*0.34, 3.25, 0], [s*0.32, 2.45, 0.02], [s*0.30, 1.75, -0.02]], 0.09, 0.075, 12), 0xf2ead9);
      reg(bones, fe, 'Femur (' + (s < 0 ? 'L' : 'R') + ')', 'LowerLimb', 'bone');
      const ti = mkMesh(limb([[s*0.30, 1.65, -0.02], [s*0.28, 0.95, 0], [s*0.26, 0.25, 0.02]], 0.07, 0.055, 12), 0xefe7d6);
      reg(bones, ti, 'Tibia & Fibula (' + (s < 0 ? 'L' : 'R') + ')', 'LowerLimb', 'bone');
      const arm = mkMesh(limb([[s*0.85, 5.5, 0], [s*1.05, 4.7, 0.02], [s*1.15, 4.15, 0.0]], 0.07, 0.055, 12), 0xf2ead9);
      reg(bones, arm, 'Humerus (' + (s < 0 ? 'L' : 'R') + ')', 'UpperLimb', 'bone');
      const fa = mkMesh(limb([[s*1.15, 4.05, 0], [s*1.22, 3.35, 0.02], [s*1.25, 2.75, 0.04]], 0.055, 0.04, 10), 0xefe7d6);
      reg(bones, fa, 'Radius & Ulna (' + (s < 0 ? 'L' : 'R') + ')', 'UpperLimb', 'bone');
    });

    // ===================== INTERNAL ORGANS (Strictly Bounded Within Ribs & Cavities) =====================
    // 1. Brain (Fits cleanly within cranial cavity: Y=6.35 - 7.00, radius 0.62)
    const brain = mkMesh(blob(0.62, 0.56, 0.68, 32, {amp:0.04, freq:3.5, oct:4, seed:5}), 0xe8a9b8, {rough:0.45, clear:0.15});
    brain.position.set(0, 6.68, 0.02); reg(organs, brain, 'Brain', 'Head', 'organ');

    // 2. Lungs (Bilateral thoracic cavity inside ribs: rx=0.36, ry=0.65, rz=0.35, X = +-0.36, Y=5.18)
    [[-1, 1], [1, 1]].forEach(([s]) => {
      const lung = mkMesh(blob(0.36, 0.65, 0.35, 24, {amp:0.03, freq:3, oct:3, seed:300+s}), 0xd48b98, {rough:0.6});
      lung.position.set(s * 0.36, 5.18, 0.04); reg(organs, lung, 'Lung (' + (s < 0 ? 'L' : 'R') + ')', 'Chest', 'organ');
    });

    // 3. Heart (Mediastinum, retrosternal between lungs: X=-0.10, Y=5.08, Z=0.12)
    const heart = mkMesh(blob(0.28, 0.32, 0.28, 28, {amp:0.03, freq:4, oct:3, seed:310}), 0xbd3a42, {rough:0.4, clear:0.25});
    heart.position.set(-0.10, 5.08, 0.12); heart.rotation.z = 0.22; reg(organs, heart, 'Heart', 'Chest', 'organ');

    // 4. Liver (Right Upper Quadrant tucked under diaphragm: X=0.24, Y=4.52, Z=0.06)
    const liver = mkMesh(blob(0.48, 0.35, 0.38, 28, {amp:0.03, freq:3, oct:3, seed:320}), 0x8a3930, {rough:0.5, clear:0.15});
    liver.position.set(0.24, 4.52, 0.06); reg(organs, liver, 'Liver', 'Abdomen', 'organ');

    // 5. Spleen (Left Upper Quadrant posterolateral: X=-0.42, Y=4.60, Z=-0.04)
    const spleen = mkMesh(blob(0.18, 0.24, 0.18, 20, {amp:0.02, freq:4, oct:3, seed:330}), 0x6e2828, {rough:0.5});
    spleen.position.set(-0.42, 4.60, -0.04); reg(organs, spleen, 'Spleen', 'Abdomen', 'organ');

    // 6. Stomach (Left Upper Quadrant medial to spleen: X=-0.15, Y=4.52, Z=0.10)
    const stomach = mkMesh(blob(0.28, 0.35, 0.24, 24, {amp:0.03, freq:3.5, oct:3, seed:350}), 0xc9826a, {rough:0.55});
    stomach.position.set(-0.15, 4.52, 0.10); stomach.rotation.z = 0.35; reg(organs, stomach, 'Stomach', 'Abdomen', 'organ');

    // 7. Pancreas (Transverse retroperitoneal behind stomach: Y=4.38)
    const pancreas = mkMesh(blob(0.32, 0.08, 0.08, 16, {amp:0.02, freq:5, oct:2, seed:355}), 0xd4a373, {rough:0.6});
    pancreas.position.set(0.02, 4.38, 0.02); reg(organs, pancreas, 'Pancreas', 'Abdomen', 'organ');

    // 8. Kidneys (Bilateral retroperitoneal: X=+-0.34, Y=4.32, Z=-0.08)
    [[-1, 1], [1, 1]].forEach(([s]) => {
      const k = mkMesh(blob(0.16, 0.26, 0.15, 20, {amp:0.02, freq:4, oct:3, seed:340+s}), 0x8b4238, {rough:0.45});
      k.position.set(s * 0.34, 4.32, -0.08); k.rotation.z = s * 0.12; reg(organs, k, 'Kidney (' + (s < 0 ? 'L' : 'R') + ')', 'Abdomen', 'organ');
    });

    // 9. Intestines & Bowel (Inside mid-lower abdomen: Y=3.82)
    const bowel = mkMesh(blob(0.42, 0.40, 0.30, 24, {amp:0.04, freq:5, oct:3, seed:360}), 0xc48268, {rough:0.65});
    bowel.position.set(0, 3.82, 0.06); reg(organs, bowel, 'Small & Large Bowel', 'Abdomen', 'organ');

    // 10. Urinary Bladder (True pelvis: Y=3.28)
    const bladder = mkMesh(blob(0.20, 0.18, 0.18, 18), 0xd8b58a, {rough:0.5, trans:0.15});
    bladder.position.set(0, 3.28, 0.08); reg(organs, bladder, 'Urinary Bladder', 'Abdomen', 'organ');

    // ===================== MUSCLES & TISSUES =====================
    // Pectoralis Major (Fits smoothly over anterior ribcage)
    [[-1, 1], [1, 1]].forEach(([s]) => {
      const pec = mkMesh(blob(0.38, 0.28, 0.14, 20, {amp:0.03, freq:4, oct:3, seed:400+s}), 0xb84a44, {rough:0.6});
      pec.position.set(s * 0.42, 5.25, 0.25); reg(muscles, pec, 'Pectoralis Major (' + (s < 0 ? 'L' : 'R') + ')', 'Chest', 'muscle');
    });

    // Deltoids
    [[-1, 1], [1, 1]].forEach(([s]) => {
      const del = mkMesh(blob(0.28, 0.36, 0.26, 20, {amp:0.03, freq:4, oct:3, seed:410+s}), 0xb84a44, {rough:0.6});
      del.position.set(s * 0.95, 5.40, 0.02); reg(muscles, del, 'Deltoid (' + (s < 0 ? 'L' : 'R') + ')', 'UpperLimb', 'muscle');
    });

    // Rectus Abdominis
    for (let r = 0; r < 3; r++) {
      [[-1, 1], [1, 1]].forEach(([s]) => {
        const ra = mkMesh(blob(0.14, 0.12, 0.08, 14), 0xb84a44, {rough:0.6});
        ra.position.set(s * 0.16, 4.55 - r * 0.28, 0.24); reg(muscles, ra, 'Rectus Abdominis ' + (r+1) + (s < 0 ? 'L' : 'R'), 'Abdomen', 'muscle');
      });
    }

    // Quadriceps & Calves
    [[-1, 1], [1, 1]].forEach(([s]) => {
      const qu = mkMesh(blob(0.22, 0.65, 0.20, 20, {amp:0.03, freq:3, oct:3, seed:450+s}), 0xb84a44, {rough:0.6});
      qu.position.set(s * 0.34, 2.35, 0.08); reg(muscles, qu, 'Quadriceps (' + (s < 0 ? 'L' : 'R') + ')', 'LowerLimb', 'muscle');
      const calf = mkMesh(blob(0.18, 0.52, 0.18, 18, {amp:0.02, freq:3, oct:3, seed:460+s}), 0xb84a44, {rough:0.6});
      calf.position.set(s * 0.28, 1.05, -0.08); reg(muscles, calf, 'Gastrocnemius (' + (s < 0 ? 'L' : 'R') + ')', 'LowerLimb', 'muscle');
    });

    // ===================== 57-BRANCH 3D ANGIOGRAPHY VASCULAR TREE =====================
    // 1. AORTA (Arising from heart, arching, thoracic & abdominal down to bifurcation at L4)
    const aorta = mkMesh(limb([
      [-0.05, 5.12, 0.14],  // Aortic root
      [0.01, 5.40, 0.12],   // Ascending aorta
      [-0.02, 5.58, 0.04],  // Aortic arch apex
      [-0.06, 5.42, -0.06], // Arch to descending transition
      [-0.05, 4.90, -0.07], // Thoracic descending aorta
      [-0.04, 4.45, -0.06], // Hiatus to abdominal aorta
      [-0.02, 4.05, -0.05], // Mid-abdominal aorta
      [0.0, 3.65, -0.04]    // Aortic bifurcation at L4
    ], 0.09, 0.07, 16), 0x00ffff, {rough:0.25, clear:0.4});
    reg(vessels, aorta, 'Aorta (Ascending, Arch, Thoracic & Abdominal)', 'Chest', 'vessel');

    // 2. SUPRA-AORTIC GREAT VESSELS & CAROTIDS
    // Brachiocephalic / Right Subclavian & Right CCA
    const bca = mkMesh(limb([[0.01, 5.55, 0.06], [0.10, 5.72, 0.03], [0.15, 5.88, 0.0]], 0.065, 0.05, 12), 0x00ffff, {rough:0.25});
    reg(vessels, bca, 'Brachiocephalic (Innominate) Artery', 'Chest', 'vessel');

    // Left Common Carotid (direct from arch)
    const lcca = mkMesh(limb([[-0.03, 5.56, 0.05], [-0.08, 5.74, 0.02], [-0.14, 5.90, 0.0]], 0.055, 0.045, 12), 0x00ffff, {rough:0.25});
    reg(vessels, lcca, 'Left Common Carotid Artery', 'Neck', 'vessel');

    // Bilateral Carotid Systems (CCA -> Bifurcation at C4 -> ICA & ECA)
    [[-1, 1], [1, 1]].forEach(([s]) => {
      // CCA into neck
      const cca = mkMesh(limb([[s * 0.14, 5.90, 0.0], [s * 0.16, 6.12, 0.02]], 0.050, 0.045, 12), 0x00ffff);
      reg(vessels, cca, 'Common Carotid Artery (' + (s < 0 ? 'L' : 'R') + ')', 'Neck', 'vessel');

      // Internal Carotid Artery (ICA entering petrous canal to Circle of Willis)
      const ica = mkMesh(limb([
        [s * 0.16, 6.12, 0.02],
        [s * 0.17, 6.32, -0.01],
        [s * 0.14, 6.48, 0.02],
        [s * 0.10, 6.58, 0.03]
      ], 0.045, 0.036, 12), 0x00ffff);
      reg(vessels, ica, 'Internal Carotid Artery (' + (s < 0 ? 'L' : 'R') + ')', 'Neck', 'vessel');

      // External Carotid Artery (ECA with facial/temporal branches)
      const eca = mkMesh(limb([
        [s * 0.16, 6.12, 0.02],
        [s * 0.20, 6.26, 0.07],
        [s * 0.22, 6.42, 0.10],
        [s * 0.20, 6.60, 0.07]
      ], 0.040, 0.028, 10), 0x00e5ff);
      reg(vessels, eca, 'External Carotid Artery (' + (s < 0 ? 'L' : 'R') + ')', 'Head', 'vessel');

      // Vertebral Artery passing through cervical foramina into foramen magnum
      const vert = mkMesh(limb([
        [s * 0.20, 5.72, -0.05],
        [s * 0.14, 5.96, -0.07],
        [s * 0.12, 6.25, -0.07],
        [s * 0.05, 6.45, -0.04]
      ], 0.038, 0.032, 10), 0x00ffff);
      reg(vessels, vert, 'Vertebral Artery (' + (s < 0 ? 'L' : 'R') + ')', 'Neck', 'vessel');
    });

    // 3. INTRACRANIAL ANGIOGRAPHY: CIRCLE OF WILLIS & CEREBRAL ARTERIES
    // Basilar Artery (formed by vertebral union)
    const basilar = mkMesh(limb([[0.0, 6.45, -0.04], [0.0, 6.56, -0.02]], 0.045, 0.040, 12), 0x00ffff);
    reg(vessels, basilar, 'Basilar Artery', 'Head', 'vessel');

    // Circle of Willis arterial ring
    const cow = mkMesh(limb([
      [-0.08, 6.58, 0.03], [0.0, 6.60, 0.06], [0.08, 6.58, 0.03],
      [0.06, 6.56, -0.02], [-0.06, 6.56, -0.02], [-0.08, 6.58, 0.03]
    ], 0.036, 0.036, 12), 0x00ffff);
    reg(vessels, cow, 'Circle of Willis (Arterial Ring)', 'Head', 'vessel');

    // Middle Cerebral Arteries (MCA M1 & M2 branches into Sylvian fissure)
    [[-1, 1], [1, 1]].forEach(([s]) => {
      const mca = mkMesh(limb([
        [s * 0.08, 6.58, 0.03],
        [s * 0.24, 6.62, 0.02],
        [s * 0.38, 6.68, 0.01],
        [s * 0.48, 6.74, 0.04]
      ], 0.038, 0.024, 12), 0x00ffff);
      reg(vessels, mca, 'Middle Cerebral Artery (' + (s < 0 ? 'L' : 'R') + ')', 'Head', 'vessel');

      // Anterior Cerebral Artery (ACA pericallosal)
      const aca = mkMesh(limb([
        [s * 0.03, 6.60, 0.06],
        [s * 0.04, 6.72, 0.08],
        [s * 0.05, 6.85, 0.02]
      ], 0.034, 0.022, 10), 0x00ffff);
      reg(vessels, aca, 'Anterior Cerebral Artery (' + (s < 0 ? 'L' : 'R') + ')', 'Head', 'vessel');

      // Posterior Cerebral Artery (PCA)
      const pca = mkMesh(limb([
        [s * 0.02, 6.56, -0.02],
        [s * 0.14, 6.54, -0.07],
        [s * 0.26, 6.55, -0.12]
      ], 0.034, 0.020, 10), 0x00ffff);
      reg(vessels, pca, 'Posterior Cerebral Artery (' + (s < 0 ? 'L' : 'R') + ')', 'Head', 'vessel');
    });

    // 4. CORONARY ARTERIES (LAD, LCx, RCA on heart surface)
    const lad = mkMesh(limb([
      [-0.08, 5.22, 0.20],
      [-0.11, 5.08, 0.23],
      [-0.14, 4.95, 0.18],
      [-0.12, 4.85, 0.19]
    ], 0.028, 0.018, 10), 0x00ffff);
    reg(vessels, lad, 'Left Anterior Descending (LAD) Coronary Artery', 'Chest', 'vessel');

    const lcx = mkMesh(limb([
      [-0.08, 5.22, 0.20],
      [-0.18, 5.16, 0.15],
      [-0.22, 5.02, 0.08]
    ], 0.026, 0.016, 10), 0x00ffff);
    reg(vessels, lcx, 'Left Circumflex (LCx) Coronary Artery', 'Chest', 'vessel');

    const rca = mkMesh(limb([
      [-0.02, 5.20, 0.18],
      [0.06, 5.10, 0.16],
      [0.05, 4.95, 0.13],
      [-0.02, 4.88, 0.11]
    ], 0.028, 0.018, 10), 0x00ffff);
    reg(vessels, rca, 'Right Coronary Artery (RCA)', 'Chest', 'vessel');

    // 5. PULMONARY ARTERIAL TREE (CTPA Protocol)
    const mpa = mkMesh(limb([[-0.04, 5.15, 0.18], [-0.01, 5.32, 0.13]], 0.065, 0.058, 12), 0x00e5ff);
    reg(vessels, mpa, 'Main Pulmonary Artery Trunk', 'Chest', 'vessel');
    [[-1, 1], [1, 1]].forEach(([s]) => {
      const paBranch = mkMesh(limb([
        [-0.01, 5.32, 0.13],
        [s * 0.22, 5.30, 0.05],
        [s * 0.42, 5.24, -0.02],
        [s * 0.52, 5.16, -0.03]
      ], 0.052, 0.028, 12), 0x00e5ff);
      reg(vessels, paBranch, 'Pulmonary Artery (' + (s < 0 ? 'L' : 'R') + ')', 'Chest', 'vessel');
    });

    // 6. ABDOMINAL VISCERAL ARTERIES
    const celiac = mkMesh(limb([[-0.04, 4.52, -0.06], [-0.03, 4.49, 0.02]], 0.05, 0.04, 10), 0x00ffff);
    reg(vessels, celiac, 'Celiac Trunk', 'Abdomen', 'vessel');

    const hepatic = mkMesh(limb([[-0.03, 4.49, 0.02], [0.12, 4.52, 0.04], [0.28, 4.56, 0.06]], 0.038, 0.025, 10), 0x00ffff);
    reg(vessels, hepatic, 'Common Hepatic Artery (Liver Perfusion)', 'Abdomen', 'vessel');

    const splenic = mkMesh(limb([[-0.03, 4.49, 0.02], [-0.18, 4.53, 0.02], [-0.38, 4.60, -0.03]], 0.038, 0.024, 10), 0x00ffff);
    reg(vessels, splenic, 'Splenic Artery', 'Abdomen', 'vessel');

    const sma = mkMesh(limb([[-0.03, 4.40, -0.05], [-0.02, 4.28, 0.03], [0.01, 4.05, 0.06]], 0.045, 0.030, 10), 0x00ffff);
    reg(vessels, sma, 'Superior Mesenteric Artery (SMA)', 'Abdomen', 'vessel');

    // Renal Arteries (Bilateral feeding kidneys)
    [[-1, 1], [1, 1]].forEach(([s]) => {
      const ra = mkMesh(limb([
        [-0.02, 4.34, -0.05],
        [s * 0.18, 4.35, -0.06],
        [s * 0.32, 4.34, -0.08]
      ], 0.042, 0.030, 10), 0x00ffff);
      reg(vessels, ra, 'Renal Artery (' + (s < 0 ? 'L' : 'R') + ')', 'Abdomen', 'vessel');
    });

    // 7. LOWER EXTREMITY ANGIOGRAPHY RUN-OFF (Aortoiliac to Pedal)
    [[-1, 1], [1, 1]].forEach(([s]) => {
      const cia = mkMesh(limb([[0.0, 3.65, -0.04], [s * 0.16, 3.42, -0.02], [s * 0.22, 3.18, 0.01]], 0.055, 0.042, 12), 0x00ffff);
      reg(vessels, cia, 'Common Iliac Artery (' + (s < 0 ? 'L' : 'R') + ')', 'Abdomen', 'vessel');

      const iia = mkMesh(limb([[s * 0.22, 3.18, 0.01], [s * 0.18, 3.00, -0.04]], 0.038, 0.026, 10), 0x00ffff);
      reg(vessels, iia, 'Internal Iliac Artery (' + (s < 0 ? 'L' : 'R') + ')', 'Abdomen', 'vessel');

      const cfa = mkMesh(limb([[s * 0.22, 3.18, 0.01], [s * 0.28, 2.88, 0.03]], 0.048, 0.040, 12), 0x00ffff);
      reg(vessels, cfa, 'Common Femoral Artery (' + (s < 0 ? 'L' : 'R') + ')', 'LowerLimb', 'vessel');

      const sfa = mkMesh(limb([
        [s * 0.28, 2.88, 0.03],
        [s * 0.26, 2.38, 0.02],
        [s * 0.24, 1.98, -0.02],
        [s * 0.22, 1.68, -0.05]
      ], 0.038, 0.032, 12), 0x00ffff);
      reg(vessels, sfa, 'Superficial Femoral Artery (' + (s < 0 ? 'L' : 'R') + ')', 'LowerLimb', 'vessel');

      const pop = mkMesh(limb([[s * 0.22, 1.68, -0.05], [s * 0.21, 1.48, -0.06], [s * 0.20, 1.32, -0.03]], 0.032, 0.026, 10), 0x00ffff);
      reg(vessels, pop, 'Popliteal Artery (' + (s < 0 ? 'L' : 'R') + ')', 'LowerLimb', 'vessel');

      const ata = mkMesh(limb([
        [s * 0.20, 1.32, -0.03],
        [s * 0.21, 0.88, 0.03],
        [s * 0.20, 0.38, 0.05],
        [s * 0.18, 0.12, 0.12]
      ], 0.025, 0.018, 10), 0x00ffff);
      reg(vessels, ata, 'Anterior Tibial & Dorsalis Pedis Artery (' + (s < 0 ? 'L' : 'R') + ')', 'LowerLimb', 'vessel');

      const pta = mkMesh(limb([
        [s * 0.20, 1.32, -0.03],
        [s * 0.18, 0.78, -0.03],
        [s * 0.16, 0.28, -0.02],
        [s * 0.15, 0.08, 0.05]
      ], 0.025, 0.018, 10), 0x00ffff);
      reg(vessels, pta, 'Posterior Tibial & Plantar Artery (' + (s < 0 ? 'L' : 'R') + ')', 'LowerLimb', 'vessel');
    });

    // 8. UPPER EXTREMITY ANGIOGRAPHY RUN-OFF (Subclavian to Radial/Ulnar)
    [[-1, 1], [1, 1]].forEach(([s]) => {
      const sub = mkMesh(limb([
        [s * 0.14, 5.72, 0.0],
        [s * 0.48, 5.62, -0.02],
        [s * 0.75, 5.32, 0.0],
        [s * 0.90, 5.02, 0.02]
      ], 0.048, 0.036, 12), 0x00ffff);
      reg(vessels, sub, 'Subclavian & Axillary Artery (' + (s < 0 ? 'L' : 'R') + ')', 'UpperLimb', 'vessel');

      const bra = mkMesh(limb([
        [s * 0.90, 5.02, 0.02],
        [s * 1.02, 4.55, 0.03],
        [s * 1.10, 4.15, 0.02]
      ], 0.036, 0.030, 10), 0x00ffff);
      reg(vessels, bra, 'Brachial Artery (' + (s < 0 ? 'L' : 'R') + ')', 'UpperLimb', 'vessel');

      const rad = mkMesh(limb([
        [s * 1.10, 4.15, 0.02],
        [s * 1.18, 3.45, 0.03],
        [s * 1.22, 2.75, 0.05]
      ], 0.028, 0.018, 10), 0x00ffff);
      reg(vessels, rad, 'Radial Artery (' + (s < 0 ? 'L' : 'R') + ')', 'UpperLimb', 'vessel');

      const uln = mkMesh(limb([
        [s * 1.10, 4.15, 0.02],
        [s * 1.14, 3.45, 0.01],
        [s * 1.16, 2.75, 0.02]
      ], 0.028, 0.018, 10), 0x00ffff);
      reg(vessels, uln, 'Ulnar Artery (' + (s < 0 ? 'L' : 'R') + ')', 'UpperLimb', 'vessel');
    });

    // 9. VENOUS SYSTEM (Inferior & Superior Vena Cava, Jugulars)
    const ivc = mkMesh(limb([
      [0.04, 3.45, -0.03],
      [0.05, 4.15, -0.04],
      [0.04, 4.65, -0.04],
      [0.02, 5.05, 0.07]
    ], 0.075, 0.065, 14), 0x2e6fff, {rough:0.3});
    reg(vessels, ivc, 'Inferior Vena Cava (IVC)', 'Abdomen', 'vessel');

    const svc = mkMesh(limb([
      [0.03, 5.15, 0.10],
      [0.04, 5.48, 0.07],
      [0.03, 5.68, 0.03]
    ], 0.068, 0.058, 12), 0x2e6fff, {rough:0.3});
    reg(vessels, svc, 'Superior Vena Cava (SVC)', 'Chest', 'vessel');

    [[-1, 1], [1, 1]].forEach(([s]) => {
      const ijv = mkMesh(limb([[s * 0.17, 5.80, 0.02], [s * 0.19, 6.22, 0.04], [s * 0.17, 6.45, 0.02]], 0.050, 0.038, 10), 0x2e6fff);
      reg(vessels, ijv, 'Internal Jugular Vein (' + (s < 0 ? 'L' : 'R') + ')', 'Neck', 'vessel');
    });

    // ===================== TRANSLUCENT ANATOMICAL SKIN SHELL =====================
    // Full body contour covering head, neck, torso, and limbs
    const torsoSkin = mkMesh(lathe([
      [0.0, 6.40], [0.38, 6.15], [0.72, 5.75], [0.85, 5.35], [0.80, 4.65], [0.65, 4.05], [0.68, 3.45], [0.35, 3.18], [0.0, 3.12]
    ], 48, {amp:0.02, freq:2, oct:3, seed:600}), 0xf0c8b2, {
      rough: 0.45, sheen: 0.3, trans: 0.25, thick: 0.8, opacity: 0.15, clear: 0.25
    });
    reg(shell, torsoSkin, 'Skin (Torso)', 'Chest', 'skin');

    const headSkin = mkMesh(blob(0.82, 0.98, 0.90, 36, {amp:0.02, freq:2.5, oct:3, seed:610}), 0xf0c8b2, {
      rough: 0.45, opacity: 0.15, clear: 0.25
    });
    headSkin.position.set(0, 6.70, 0.02); reg(shell, headSkin, 'Skin (Head)', 'Head', 'skin');

    [[-1, 1], [1, 1]].forEach(([s]) => {
      const armS = mkMesh(limb([[s * 0.85, 5.45, 0], [s * 1.05, 4.55, 0.02], [s * 1.20, 3.35, 0.03]], 0.15, 0.09, 16), 0xf0c8b2, {rough:0.5, opacity:0.15});
      reg(shell, armS, 'Skin (Arm ' + (s < 0 ? 'L' : 'R') + ')', 'UpperLimb', 'skin');
      const legS = mkMesh(limb([[s * 0.34, 3.30, 0.02], [s * 0.32, 2.25, 0.0], [s * 0.28, 0.65, 0.02]], 0.20, 0.11, 18), 0xf0c8b2, {rough:0.5, opacity:0.15});
      reg(shell, legS, 'Skin (Leg ' + (s < 0 ? 'L' : 'R') + ')', 'LowerLimb', 'skin');
    });

    // Subcutaneous soft tissue layer (subtle interior contour)
    shell.children.forEach(src => {
      const s = src.clone();
      s.material = src.material.clone();
      s.material.color = new THREE.Color(0xd49b85);
      s.material.roughness = 0.65;
      s.material.transparent = true; s.material.opacity = 0.18; s.material.depthWrite = false;
      s.scale.multiplyScalar(0.96);
      s.userData.baseColor = s.material.color.getHex();
      s.userData.baseOpacity = 0.18;
      s.userData.baseEmissive = 0x000000;
      s.userData.kind = 'soft';
      s.name = 'Soft Tissue (' + (src.name || 'Body') + ')';
      soft.add(s);
    });

    const groups = { bones, organs, vessels, shell, muscles, soft };
    if (sceneRef) sceneRef.add(bones, organs, vessels, shell, muscles, soft);
    return { groups, pickables: [bones, organs, vessels, muscles, shell, soft], STRUCTURE_INFO,
             anatomyVersion: 'clinical-angio-v5-perfected' };
  }

  // ---------- Real anatomical models (downloaded GLB models) ----------
  // Dedicated pivot groups center models precisely around their centroid
  const REAL_MODEL_DEFS = [
    { url: 'models/Human-skeleton.glb', group: 'bones', clearGroup: true, targetH: 7.1, kind: 'bone', label: 'Skeleton' },
    { url: 'models/Brain.glb',          group: 'organs', remove: ['Brain'], targetSize: 1.10, kind: 'organ', label: 'Brain',
      place: p => { p.position.set(0, 6.68, 0.02); } },
    { url: 'models/Human-heart.glb',     group: 'organs', remove: ['Heart'], targetSize: 0.72, kind: 'organ', label: 'Heart',
      place: p => { p.position.set(-0.10, 5.08, 0.12); p.rotation.z = 0.22; } },
    { url: 'models/Kidneys.glb',        group: 'organs', remove: ['Kidney (L)', 'Kidney (R)'], targetSize: 0.68, kind: 'organ', label: 'Kidneys',
      place: p => { p.position.set(0, 4.32, -0.08); } }
  ];

  function _centerAndScaleModel(obj, targetSize) {
    const pivot = new THREE.Group();
    // Compute true bounding box of loaded GLTF
    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3(); box.getCenter(center);
    // Shift model inside pivot so geometric centroid is strictly at (0, 0, 0)
    obj.position.set(-center.x, -center.y, -center.z);
    pivot.add(obj);

    const size = new THREE.Vector3(); box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = targetSize / maxDim;
    pivot.scale.set(s, s, s);
    return pivot;
  }

  function _fitSkeleton(obj, targetH) {
    let box = new THREE.Box3().setFromObject(obj);
    let size = new THREE.Vector3(); box.getSize(size);
    const k = targetH / (size.y || 1);
    obj.scale.multiplyScalar(k);
    box = new THREE.Box3().setFromObject(obj);
    let center = new THREE.Vector3(); box.getCenter(center);
    obj.position.x -= center.x;
    obj.position.z -= center.z;
    obj.position.y -= box.min.y; // Feet contact ground plane at Y = 0.00
  }

  function _tag(obj, def) {
    obj.traverse(ch => {
      if (ch.isMesh && ch.material) {
        ch.material.transparent = false; ch.material.depthWrite = true; ch.material.needsUpdate = true;
        ch.userData.baseColor = ch.material.color ? ch.material.color.getHex() : 0xcccccc;
        ch.userData.baseOpacity = (ch.material.opacity != null) ? ch.material.opacity : 1;
        ch.userData.baseEmissive = (ch.material.emissive) ? ch.material.emissive.getHex() : 0x000000;
        ch.userData.kind = def.kind;
        ch.userData.label = def.label;
        ch.userData.isSkeleton = (def.label === 'Skeleton');
        if (def.label === 'Skeleton') {
          ch.userData.name = 'Human Skeleton';
          ch.userData.region = 'Spine';
        } else if (def.label === 'Brain') {
          ch.userData.name = 'Brain (Cerebrum & Cerebellum)';
          ch.userData.region = 'Head';
        } else if (def.label === 'Heart') {
          ch.userData.name = 'Heart & Pericardium';
          ch.userData.region = 'Chest';
        } else if (def.label === 'Kidneys') {
          ch.userData.name = 'Kidneys (Renal Parenchyma)';
          ch.userData.region = 'Abdomen';
        }
      }
    });
  }

  function loadRealModels(groups, onUpdate) {
    if (typeof THREE.GLTFLoader !== 'function') { console.warn('GLTFLoader not present'); return; }
    const loader = new THREE.GLTFLoader();
    REAL_MODEL_DEFS.forEach(def => {
      loader.load(def.url, gltf => {
        const obj = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!obj) return;
        _tag(obj, def);
        let finalObject;
        if (def.label === 'Skeleton') {
          _fitSkeleton(obj, def.targetH);
          finalObject = obj;
        } else {
          finalObject = _centerAndScaleModel(obj, def.targetSize);
          if (def.place) def.place(finalObject);
        }
        const g = groups[def.group];
        if (def.clearGroup) { while (g.children.length) g.remove(g.children[0]); }
        if (def.remove) def.remove.forEach(nm => {
          const idx = g.children.findIndex(ch => ch.name === nm || (ch.userData && ch.userData.name === nm));
          if (idx >= 0) g.remove(g.children[idx]);
        });
        g.add(finalObject);
        if (typeof onUpdate === 'function') onUpdate(def.label);
      }, undefined, err => { console.warn('Real model load failed: ' + def.url, err); });
    });
  }

  global.Anatomy = { build, STRUCTURE_INFO, loadRealModels };
})(window);
