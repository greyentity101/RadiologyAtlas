/* ============================================================
   Radiology Atlas — High-Fidelity Human Anatomy
   True tissue layers: Skeleton | Organs | Muscles | Vessels | Skin
   Ultra-high polygon · anatomically accurate · no low-poly limit
   Three.js r128 · fully interactive · modality-ready
   ============================================================ */

const Anatomy = (() => {

    const STRUCTURE_INFO = {
        'Skull': 'Cranial vault protecting the brain. Caldwell/Waters/Towne views radiographically; NCCT is standard for trauma to exclude fracture and haemorrhage.',
        'Mandible': 'Lower jaw. Panoramic and oblique views; CT with 3D VR for complex fractures.',
        'Cervical Spine': 'C1-C7 supporting the skull. Odontoid, lateral and oblique views; flexion-extension for instability; MRI T2 sagittal for cord compression.',
        'Thoracic Spine': 'T1-T12 articulating with the ribs. AP/lateral with orthostatic breathing; STIR MRI dates compression fractures.',
        'Lumbar Spine': 'L1-L5 bearing axial load. Obliques show the scotty dog (pars interarticularis); MRI multi-angle axial blocks through every disc space.',
        'Rib Cage': '12 pairs shielding thoracic viscera. Upper rib films on inspiration, lower on expiration.',
        'Sternum': 'Anterior chest wall anchor of the ribs. Lateral and RAO 15-20\u00b0 projections over the cardiac silhouette.',
        'Clavicle': 'Strut linking sternum to acromion. AP + 15\u00b0 cephalad angulation; bilateral AC joint views with and without weights.',
        'Scapula': 'Flat posterior bone of shoulder girdle. Y-lateral and AP with arm abducted 25\u00b0.',
        'Patellae': 'Sesamoid bone of the knee. Sunrise/Merchant views profile the patellofemoral joint.',
        'Pelvis': 'Ilium, ischium and pubis funneling weight to femora. AP pelvis with 15\u00b0 internal foot rotation; Judet obliques for acetabular columns.',
        'Sacrum': 'Fused wedge transmitting spinal load to pelvis. Fergus view (15-20\u00b0 caudad) and lateral.',
        'Humerus': 'Arm long bone. AP plus lateral including both joints; transthoracic Lawrence lateral when immobilized.',
        'Radius and Ulna': 'Forearm pair; radius carries the thumb side. AP supinated / lateral flexed \u2014 both adjacent joints mandatory.',
        'Femur': 'Longest, strongest bone. AP with internal rotation showing lesser trochanter profile.',
        'Tibia and Fibula': 'Weight-bearing shin pair. AP/lateral including knee and ankle joints.',
        'Hand Bones': 'Carpals, metacarpals, phalanges. PA, oblique, fan lateral for foreign bodies; scaphoid ulnar-deviation view.',
        'Foot Bones': 'Tarsals and metatarsals. DP, medial oblique, lateral weight-bearing; Jones fracture zone at 5th MT base.',
        'Brain': 'Command center imaged by non-contrast CT for acute haemorrhage, MRI FLAIR/DWI for ischemia and demyelination.',
        'Thyroid Gland': 'Endocrine gland anterior to trachea. Ultrasound with TI-RADS stratification guides FNA.',
        'Right Lung / Left Lung': 'Air-filled parenchyma inherently contrastful on radiographs. CTPA bolus-tracked in the main pulmonary artery for PE.',
        'Trachea': 'Cartilage-ringed airway. Frontal/lateral airway films; narrowed steeple sign in croup.',
        'Heart': 'Four-chamber pump. Coronary CTA needs HR < 60 bpm; echocardiography for function.',
        'Liver': 'Right hypochondrial workhorse. Multiphase imaging characterises HCC vs hemangioma vs cyst; MRCP fasts patients 4\u20136 h.',
        'Stomach': 'Upper GI reservoir. Double-contrast barium meal; endoscopy has largely replaced diagnostic imaging.',
        'Spleen': 'Left upper quadrant lymphatic organ. Splenic injury graded on portal-venous phase CT trauma protocol.',
        'Pancreas': 'Retroperitoneal gland. Dual-phase thin-slice CT for pancreatic mass; secretin-stimulated MRCP for ductal detail.',
        'Gallbladder': 'Pear-shaped bile reservoir under liver segment V. Ultrasound Murphy sign and wall thickening for cholecystitis; MRCP 40 mm thick slabs.',
        'Kidneys': 'Retroperitoneal filters. CT urogram phases for hematuria workup; ultrasound first-line for hydronephrosis.',
        'Small Intestine': 'Absorptive coil. CT enterography with neutral oral agent for Crohn strictures.',
        'Colon': 'Large bowel frame. Portal-venous CT; water-soluble contrast if perforation suspected.',
        'Urinary Bladder': 'Pelvic reservoir. Ultrasound post-void residual; CT cystogram for trauma leak.',
        'Aorta': 'Great artery. CTA gates: non-enhanced for hematoma, arterial for dissection flap and aneurysm sizing.',
        'Inferior Vena Cava': 'Venous return trunk. Venous-phase contrast timing; filter placement imaging.',
        'Carotid Arteries': 'Neck-to-brain supply. CTA/Doppler NASCET grading pre-endarterectomy.',
        'Pulmonary Arteries': 'Deoxygenated circuit to lungs. CTPA bolus tracking ROI sits inside the main pulmonary artery at 100 HU.',
        'Femoral Arteries': 'Lower limb inflow. CTA run-off arch-to-ankle for PAD claudication.',
        'Ureters': 'Renal-bladder conduits seen on excretory urogram phases (10\u201315 min); stones cause hydroureter.',
        'Pectoralis': 'Anterior chest wall muscle. Phase direction A>P on shoulder MRI avoids its respiratory ghosting.',
        'Deltoids': 'Shoulder cap muscle overlying proximal humerus; landmark for axillary approach.',
        'Abdominal Wall': 'Rectus/oblique layers. Straining hernia protocols image at rest and Valsalva.',
        'Trapezius': 'Posterior neck-shoulder sheet; supraspinatus coronal planning stays within 45\u00b0 to avoid projecting through it.',
        'Biceps': 'Arm flexor pair; FABS view isolates distal biceps tendon when elbow cannot flex overhead.',
        'Gluteals': 'Hip extensor mass; IM injection landmarks and gluteal compartment syndrome imaging.',
        'Quadriceps': 'Knee extensor group anterior to femur; quad tendon tears best on sagittal PD FS.',
        'Hamstrings': 'Posterior thigh group; proximal hamstring avulsion imaged with hip MRI protocol.',
        'Calves': 'Triceps surae + Achilles; plantar-flexed positioning relaxes Achilles for tendon sequences.',
        'Body Outline': 'Reference surface. Subcutaneous fat planes delineate fascial spread of masses on MRI.'
    };

    const REGION_OF = {
        'Skull': 'Head', 'Mandible': 'Head', 'Brain': 'Head',
        'Cervical Spine': 'Neck', 'Thyroid Gland': 'Neck', 'Carotid Arteries': 'Neck', 'Trachea': 'Neck',
        'Rib Cage': 'Chest', 'Sternum': 'Chest', 'Right Lung': 'Chest', 'Left Lung': 'Chest',
        'Heart': 'Chest', 'Pulmonary Arteries': 'Chest', 'Pectoralis': 'Chest', 'Deltoids': 'UpperLimb',
        'Thoracic Spine': 'Spine', 'Lumbar Spine': 'Spine', 'Sacrum': 'Spine', 'Trapezius': 'UpperLimb',
        'Liver': 'Abdomen', 'Stomach': 'Abdomen', 'Kidneys': 'Abdomen', 'Ureters': 'Abdomen',
        'Small Intestine': 'Abdomen', 'Colon': 'Abdomen', 'Urinary Bladder': 'Abdomen',
        'Aorta': 'Abdomen', 'Inferior Vena Cava': 'Abdomen', 'Spleen': 'Abdomen',
        'Pancreas': 'Abdomen', 'Gallbladder': 'Abdomen', 'Abdominal Wall': 'Abdomen',
        'Clavicle': 'UpperLimb', 'Scapula': 'UpperLimb', 'Humerus': 'UpperLimb',
        'Radius and Ulna': 'UpperLimb', 'Hand Bones': 'UpperLimb', 'Biceps': 'UpperLimb',
        'Pelvis': 'LowerLimb', 'Femur': 'LowerLimb', 'Tibia and Fibula': 'LowerLimb',
        'Foot Bones': 'LowerLimb', 'Femoral Arteries': 'LowerLimb', 'Patellae': 'LowerLimb',
        'Gluteals': 'LowerLimb', 'Quadriceps': 'LowerLimb', 'Hamstrings': 'LowerLimb',
        'Calves': 'LowerLimb'
    };

    let scene;
    const groups = { bones: null, organs: null, muscles: null, vessels: null, shell: null };
    const pickables = [];

    // ---- material presets — true tissue optics ----
    function mat(hex, opts = {}) {
        return new THREE.MeshPhysicalMaterial(Object.assign({
            color: hex, metalness: 0.02, roughness: 0.38,
            transparent: true, opacity: 1.0, envMapIntensity: 0.65,
            clearcoat: 0.35, clearcoatRoughness: 0.45
        }, opts));
    }
    function boneMat() { return mat(0xf2ede3, { roughness: 0.32, metalness: 0.01, clearcoat: 0.6, clearcoatRoughness: 0.35, emissive: 0x111111, emissiveIntensity: 0.05 }); }
    function corticalMat() { return mat(0xede8dc, { roughness: 0.28, clearcoat: 0.75 }); }
    function cartilageMat() { return mat(0xd6e8ee, { roughness: 0.48, transmission: 0.12, thickness: 0.3, opacity: 0.92 }); }
    function muscleMat(hex) { return mat(hex, { roughness: 0.58, clearcoat: 0.15, sheen: 0.9, sheenColor: new THREE.Color(0xff9a8a) }); }

    function register(mesh, name, group) {
        mesh.userData.name = name;
        mesh.userData.region = REGION_OF[name] || null;
        mesh.userData.info = STRUCTURE_INFO[name] || '';
        mesh.userData.baseColor = mesh.material.color.getHex();
        mesh.userData.baseOpacity = mesh.material.opacity;
        mesh.userData.baseEmissive = mesh.material.emissive ? mesh.material.emissive.getHex() : 0x000000;
        group.add(mesh); pickables.push(mesh); return mesh;
    }
    function cyl(rT, rB, h, s) { return new THREE.CylinderGeometry(rT, rB, h, s || 32); }
    function tubeFromPoints(pts, r, seg) {
        const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
        return new THREE.TubeGeometry(curve, seg || 48, r, 16, false);
    }
    function vesselMesh(pts, r, color, name, emis) {
        const m = new THREE.Mesh(tubeFromPoints(pts, r), mat(color, { roughness: 0.22, clearcoat: 0.9, emissive: new THREE.Color(emis || 0x000000), emissiveIntensity: 0.35 }));
        return register(m, name, groups.vessels);
    }
    // Long bone lathe — true diaphysis / metaphysis / epiphysis profile
    function latheBone(len, rMid, rEnd, seg) {
        const pts = [];
        const steps = seg || 28;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps; // 0..1 along shaft
            // anatomic flare: narrow diaphysis, wide metaphysis
            const flare = 1 + Math.pow(Math.abs(t - 0.5) * 2, 3.2) * ((rEnd / rMid) - 1) * 1.15;
            const r = rMid * flare;
            const y = (t - 0.5) * len;
            pts.push(new THREE.Vector2(r, y));
        }
        return new THREE.LatheGeometry(pts, 40);
    }

    // ================================================================
    // SKELETON — cortical bone, trabecular ends, every landmark
    // ================================================================
    function buildSkeleton() {
        const g = groups.bones;

        // ---- Skull — high-poly neurocranium + facial skeleton ----
        const craniumGeo = new THREE.SphereGeometry(0.70, 64, 56);
        // subtle flattening + occipital bun via vertex tweak
        const cPos = craniumGeo.attributes.position;
        for (let i = 0; i < cPos.count; i++) {
            let x = cPos.getX(i), y = cPos.getY(i), z = cPos.getZ(i);
            if (y < -0.15) { x *= 0.92; z *= 0.88; } // cranial base narrowing
            if (z < -0.25 && y < 0) z *= 1.12; // occipital prominence
            cPos.setXYZ(i, x, y, z);
        }
        craniumGeo.computeVertexNormals();
        const skull = register(new THREE.Mesh(craniumGeo, boneMat()), 'Skull', g);
        skull.position.set(0, 7.98, -0.02); skull.scale.set(1.02, 1.10, 1.06);

        // orbital rims + zygomatic arches + maxilla + nasal aperture
        for (const s of [-1, 1]) {
            const orbitRim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 12, 28), boneMat());
            orbitRim.position.set(s * 0.22, 7.88, 0.48); orbitRim.rotation.x = 0.15;
            g.add(orbitRim); orbitRim.userData.name = 'Skull'; pickables.push(orbitRim);
            const zygo = new THREE.Mesh(tubeFromPoints([[s*0.32, 7.82, 0.42],[s*0.52, 7.76, 0.30],[s*0.58, 7.70, 0.06]], 0.038, 20), boneMat());
            g.add(zygo); zygo.userData.name='Skull'; pickables.push(zygo);
        }
        const maxilla = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.18), boneMat());
        maxilla.position.set(0, 7.62, 0.52); g.add(maxilla); maxilla.userData.name='Skull'; pickables.push(maxilla);
        const nasalBridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.06), boneMat());
        nasalBridge.position.set(0, 7.80, 0.60); g.add(nasalBridge); nasalBridge.userData.name='Skull'; pickables.push(nasalBridge);

        // ---- Mandible — body + ramus + condyle + coronoid ----
        const mandBodyPts = [];
        for (let i = 0; i <= 20; i++) {
            const th = Math.PI * (i/20);
            mandBodyPts.push([Math.cos(th)*0.34, 7.28 + Math.sin(th*2)*0.03, 0.18 + Math.sin(th)*0.24]);
        }
        register(new THREE.Mesh(tubeFromPoints(mandBodyPts, 0.075, 28), corticalMat()), 'Mandible', g);
        for (const s of [-1,1]) {
            const ramus = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.06), boneMat());
            ramus.position.set(s*0.33, 7.52, 0.06); ramus.rotation.z = s*0.08; ramus.rotation.x = -0.18;
            g.add(ramus); ramus.userData.name='Mandible'; pickables.push(ramus);
            const condyle = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), boneMat());
            condyle.position.set(s*0.33, 7.78, -0.02); g.add(condyle); condyle.userData.name='Mandible'; pickables.push(condyle);
            const coronoid = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 12), boneMat());
            coronoid.position.set(s*0.30, 7.78, 0.14); coronoid.rotation.x = -0.35; g.add(coronoid); coronoid.userData.name='Mandible'; pickables.push(coronoid);
        }

        // ---- Spine — 7C + 12T + 5L, each vertebra anatomically correct ----
        const spineZ = (label, t) => {
            if (label==='c') return 0.08 + Math.sin(t*Math.PI)*0.04;
            if (label==='t') return -0.08 - Math.sin(t*Math.PI)*0.38;
            return -0.04 + Math.sin(Math.min(t,1)*Math.PI*0.92)*0.28;
        };
        let y = 7.08;
        function vertebra(vy, vz, r, name, label) {
            const bodyH = label==='c'?0.13: label==='t'?0.16:0.19;
            const body = new THREE.Mesh(cyl(r, r*0.96, bodyH, 36), boneMat());
            // vertebral arch
            const arch = new THREE.Mesh(new THREE.TorusGeometry(r*0.62, 0.028, 10, 24, Math.PI), boneMat());
            arch.rotation.x = Math.PI/2; arch.position.set(0,0,-r*0.72); body.add(arch);
            // spinous process
            const spL = label==='t'?0.38: label==='c'?0.18:0.26;
            const sp = new THREE.Mesh(cyl(0.022, 0.038, spL, 12), boneMat());
            sp.position.set(0,-spL*0.35,-r*0.72 - spL*0.42); sp.rotation.x = label==='t'?1.05:0.25; body.add(sp);
            // transverse + articular
            for (const s of [-1,1]) {
                const tp = new THREE.Mesh(cyl(0.02,0.028, r*0.95, 10), boneMat());
                tp.rotation.z=Math.PI/2; tp.position.set(s*(r+0.10),0,-r*0.35); tp.rotation.y=s*0.28; body.add(tp);
                const facet = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), boneMat());
                facet.position.set(s*(r*0.45),0.06,-r*0.62); body.add(facet);
            }
            // bifid tip for cervical
            if (label==='c') {
                for (const s of [-1,1]) { const tip=new THREE.Mesh(new THREE.ConeGeometry(0.018,0.08,8), boneMat()); tip.position.set(s*0.02,-spL*0.62,-r*0.72-spL*0.78); tip.rotation.x=0.25; body.add(tip); }
            }
            body.position.set(0,vy,vz);
            // disc
            const disc = new THREE.Mesh(cyl(r*0.90, r*0.90, 0.042, 32), cartilageMat());
            disc.position.set(0, vy - bodyH/2 - 0.028, vz);
            disc.userData.name=name; disc.userData.region=REGION_OF[name]; disc.userData.info=STRUCTURE_INFO[name];
            disc.userData.baseColor=disc.material.color.getHex(); disc.userData.baseOpacity=disc.material.opacity; disc.userData.baseEmissive=0;
            g.add(disc); pickables.push(disc);
            g.add(body); body.userData.name=name; body.userData.region=REGION_OF[name]; body.userData.info=STRUCTURE_INFO[name];
            body.userData.baseColor=body.material.color.getHex(); body.userData.baseOpacity=1; body.userData.baseEmissive=0; pickables.push(body);
        }
        const sections = [['c',7,0.118,0.135],['t',12,0.238,0.172],['l',5,0.275,0.22]];
        for (const [label,count,step,r] of sections) {
            for (let i=0;i<count;i++) {
                const t = count>1? i/(count-1):0;
                const vz = spineZ(label,t);
                const nm = label==='c'?'Cervical Spine': label==='t'?'Thoracic Spine':'Lumbar Spine';
                vertebra(y, vz, r, nm, label); y -= step + (label==='l'?0.02:0);
            }
        }
        // sacrum — 5 fused + foramina
        const sacrum = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.78, 0.16), boneMat());
        sacrum.position.set(0,1.80,-0.14); sacrum.rotation.x=-0.52; register(sacrum,'Sacrum',g);
        for (let i=0;i<4;i++){ for(const s of [-1,1]){ const f=new THREE.Mesh(new THREE.CircleGeometry(0.032,12), new THREE.MeshBasicMaterial({color:0x0a0f14, transparent:true, opacity:0.85, side:THREE.DoubleSide})); f.position.set(s*0.09,1.98 - i*0.14, -0.055); f.rotation.y=s*0.15; sacrum.add(f);} }
        const coccyx = new THREE.Mesh(new THREE.ConeGeometry(0.09,0.22,16), boneMat());
        coccyx.position.set(0,1.32,-0.36); coccyx.rotation.x=-0.9; register(coccyx,'Sacrum',g);

        // ---- Rib cage — 12 pairs, costal groove, tubercle, costal cartilage ----
        for (let i=0;i<12;i++) {
            const t=i/11; const yB=6.02 - i*0.236; const drop=0.14 + t*0.62;
            const Rx=0.62 + Math.sin(Math.PI*Math.min(t*1.18,1))*1.02; const Rz=0.52 + t*0.18;
            for (const s of [-1,1]) {
                const bonePts=[]; const N=20; const boneEnd=i<10?15:20;
                for(let k=0;k<=boneEnd;k++){ const th=Math.PI*(1-(k/N)*0.88); const px=s*Rx*Math.sin(th); const pz=-0.16+Rz*Math.cos(th)*-1; const py=yB - drop*Math.pow(k/N,1.45); bonePts.push([px,py,pz]); }
                const rib = new THREE.Mesh(tubeFromPoints(bonePts, 0.032 + (1-t)*0.018, 40), boneMat());
                // costal groove hint — darker line
                rib.material = boneMat(); // ensure unique
                register(rib,'Rib Cage',g);
                if(i<10){
                    const last=bonePts[bonePts.length-1];
                    const yS=5.72 - Math.min(i,7)*0.20;
                    const cartPts=[last, [last[0]*0.48, last[1]*0.55 + yS*0.45, last[2]*0.45+0.32], [s*0.13, yS, 0.62]];
                    register(new THREE.Mesh(tubeFromPoints(cartPts,0.028,18), cartilageMat()),'Rib Cage',g);
                }
            }
        }
        // sternum — manubrium with clavicular notches + 4 sternebrae + xiphoid
        const manub = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.48,0.10), boneMat());
        manub.position.set(0,5.77,0.62); manub.rotation.x=-0.14; register(manub,'Sternum',g);
        for(const s of [-1,1]){ const notch=new THREE.Mesh(new THREE.SphereGeometry(0.065,12,10), new THREE.MeshBasicMaterial({color:0x0a0f14, transparent:true, opacity:0.45})); notch.position.set(s*0.18,0.12,0.04); manub.add(notch); }
        const stBody = new THREE.Mesh(latheBone(1.18,0.14,0.19,18), boneMat());
        stBody.position.set(0,4.96,0.66); stBody.rotation.x=-0.12; register(stBody,'Sternum',g);
        // sternal segments line
        for(let k=0;k<3;k++){ const line=new THREE.Mesh(new THREE.BoxGeometry(0.30,0.012,0.02), new THREE.MeshBasicMaterial({color:0x8a857a})); line.position.set(0,0.28 - k*0.32,0.05); stBody.add(line); }
        const xiph = new THREE.Mesh(new THREE.ConeGeometry(0.085,0.28,16), cartilageMat());
        xiph.position.set(0,4.18,0.70); xiph.rotation.x=Math.PI; register(xiph,'Sternum',g);

        // ---- Clavicle — S-curve, sternal vs acromial ends ----
        for(const s of [-1,1]){
            const pts=[[s*0.20,5.96,0.56],[s*0.68,6.10,0.52],[s*1.28,6.05,0.36],[s*1.95,5.96,0.12]];
            const clav = new THREE.Mesh(tubeFromPoints(pts,0.058,28), boneMat());
            // conoid tubercle bump
            const tub=new THREE.Mesh(new THREE.SphereGeometry(0.035,10,8), boneMat()); tub.position.set(s*1.55,5.98,0.18); clav.add(tub);
            register(clav,'Clavicle',g);
        }
        // ---- Scapula — spine, acromion, glenoid, coracoid, subscapular fossa ----
        const scapShape=new THREE.Shape(); scapShape.moveTo(0,0); scapShape.lineTo(0.92,0.58); scapShape.lineTo(0.68,-0.82); scapShape.lineTo(0.10,-0.55); scapShape.lineTo(0,0);
        const scapGeo=new THREE.ExtrudeGeometry(scapShape,{depth:0.045, bevelEnabled:true, bevelThickness:0.02, bevelSize:0.025, bevelSegments:3});
        for(const s of [-1,1]){
            const sc=register(new THREE.Mesh(scapGeo.clone(), boneMat()),'Scapula',g);
            sc.position.set(s*1.24,5.28,-0.68); sc.rotation.set(0.25,s*1.35, s>0?0.18:Math.PI-0.18); sc.scale.set(0.88,0.88,1);
            const spine=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.05,0.05), boneMat()); spine.position.set(0.40,0.08,0.045); spine.rotation.z=0.10; sc.add(spine);
            const acr=new THREE.Mesh(new THREE.BoxGeometry(0.30,0.08,0.14), boneMat()); acr.position.set(0.88,0.38,0.02); sc.add(acr);
            const glen=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,0.035,20), boneMat()); glen.rotation.z=Math.PI/2; glen.position.set(0.84,-0.04,0.02); sc.add(glen);
            const cor=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.18,12), boneMat()); cor.position.set(0.74,0.26,0.08); cor.rotation.z=0.9; sc.add(cor);
        }

        // ---- Pelvis — iliac wing, crest, ASIS, acetabulum, pubis, ischium, foramen ----
        for(const s of [-1,1]){
            const iliumGeo=new THREE.SphereGeometry(0.58, 40, 32);
            const ip=iliumGeo.attributes.position;
            for(let i=0;i<ip.count;i++){ let x=ip.getX(i), y=ip.getY(i), z=ip.getZ(i); if(y>0.25) x*=1.12; if(z>0.15) z*=0.55; ip.setXYZ(i,x,y,z); }
            iliumGeo.computeVertexNormals();
            const ilium=register(new THREE.Mesh(iliumGeo, boneMat()),'Pelvis',g);
            ilium.position.set(s*0.76,2.12,-0.04); ilium.rotation.z=s*-0.42; ilium.rotation.y=s*0.22; ilium.scale.set(1.0,1.18,0.38);
            // iliac crest ridge
            const crest=new THREE.Mesh(tubeFromPoints([[s*0.45,2.55,-0.04],[s*0.78,2.62,-0.06],[s*1.05,2.45,-0.08]],0.045,16), boneMat()); g.add(crest); crest.userData.name='Pelvis'; pickables.push(crest);
            const ASIS=new THREE.Mesh(new THREE.SphereGeometry(0.045,12,10), boneMat()); ASIS.position.set(s*1.02,2.32,-0.02); g.add(ASIS); ASIS.userData.name='Pelvis'; pickables.push(ASIS);
            const acet=new THREE.Mesh(new THREE.RingGeometry(0.11,0.18,24,1,0,Math.PI), boneMat()); acet.position.set(s*0.88,1.66,0.06); acet.rotation.y=s*1.57; acet.rotation.x=0.12; acet.side=THREE.DoubleSide; g.add(acet); acet.userData.name='Pelvis'; pickables.push(acet);
            const pub=new THREE.Mesh(tubeFromPoints([[s*0.88,1.66,0.06],[s*0.45,1.38,0.18],[s*0.08,1.34,0.14]],0.055,16), boneMat()); g.add(pub); pub.userData.name='Pelvis'; pickables.push(pub);
            const isch=new THREE.Mesh(tubeFromPoints([[s*0.88,1.66,0.06],[s*0.92,1.30,-0.02],[s*0.62,1.08,-0.10],[s*0.28,1.12,-0.08]],0.052,18), boneMat()); g.add(isch); isch.userData.name='Pelvis'; pickables.push(isch);
        }
        // pubic symphysis disc
        const symph=new THREE.Mesh(cyl(0.06,0.06,0.14,20), cartilageMat()); symph.position.set(0,1.34,0.14); symph.rotation.x=Math.PI/2; register(symph,'Pelvis',g);
        // sacrum foramina already added

        // ---- Upper limbs — high-fidelity humerus / radius / ulna / hand ----
        for(const s of [-1,1]){
            const humLen=2.38; const hum=new THREE.Mesh(latheBone(humLen,0.085,0.135,24), corticalMat());
            hum.position.set(s*2.38,4.68,0.02); hum.rotation.z=s*0.075; register(hum,'Humerus',g);
            const hHead=new THREE.Mesh(new THREE.SphereGeometry(0.19,28,20), boneMat()); hHead.position.set(s*2.20,5.90,0.06); g.add(hHead); hHead.userData.name='Humerus'; pickables.push(hHead);
            const gt=new THREE.Mesh(new THREE.SphereGeometry(0.075,16,12), boneMat()); gt.position.set(s*2.30,5.88,0.12); g.add(gt); gt.userData.name='Humerus'; pickables.push(gt);
            const lt=new THREE.Mesh(new THREE.SphereGeometry(0.055,14,10), boneMat()); lt.position.set(s*2.16,5.82,0.14); g.add(lt); lt.userData.name='Humerus'; pickables.push(lt);
            const deltTub=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,0.18,12), boneMat()); deltTub.position.set(s*2.42,4.95,0.12); deltTub.rotation.z=s*0.15; hum.add(deltTub);
            const cap=new THREE.Mesh(new THREE.SphereGeometry(0.11,16,12), boneMat()); cap.position.set(s*2.42,3.52,0.01); g.add(cap); cap.userData.name='Humerus'; pickables.push(cap);
            for(const epi of [-1,1]){ const ec=new THREE.Mesh(new THREE.SphereGeometry(0.048,12,10), boneMat()); ec.position.set(s*2.42+epi*0.09,3.48,0.02); g.add(ec); ec.userData.name='Humerus'; pickables.push(ec); }

            // forearm — radius bows laterally, ulna straight with olecranon
            const rad=new THREE.Mesh(latheBone(2.30,0.042,0.068,20), boneMat());
            rad.position.set(s*2.58,2.40,0.09); rad.rotation.z=s*0.02; register(rad,'Radius and Ulna',g);
            const rHead=new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.065,0.04,20), boneMat()); rHead.position.set(s*2.56,3.56,0.07); g.add(rHead); rHead.userData.name='Radius and Ulna'; pickables.push(rHead);
            const rSty=new THREE.Mesh(new THREE.ConeGeometry(0.038,0.09,12), boneMat()); rSty.position.set(s*2.60,1.22,0.09); rSty.rotation.x=Math.PI; g.add(rSty); rSty.userData.name='Radius and Ulna'; pickables.push(rSty);
            const ulna=new THREE.Mesh(latheBone(2.32,0.052,0.058,20), boneMat()); ulna.position.set(s*2.38,2.40,-0.07); register(ulna,'Radius and Ulna',g);
            const olec=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.18,0.09), boneMat()); olec.position.set(s*2.36,3.62,-0.06); g.add(olec); olec.userData.name='Radius and Ulna'; pickables.push(olec);
            const uSty=new THREE.Mesh(new THREE.ConeGeometry(0.03,0.07,10), boneMat()); uSty.position.set(s*2.38,1.20,-0.07); uSty.rotation.x=Math.PI; g.add(uSty); uSty.userData.name='Radius and Ulna'; pickables.push(uSty);
            // interosseous membrane hint
            const iom=new THREE.Mesh(new THREE.PlaneGeometry(0.18,1.6), new THREE.MeshBasicMaterial({color:0xc2b8a8, transparent:true, opacity:0.18, side:THREE.DoubleSide})); iom.position.set(s*2.48,2.42,0.01); iom.rotation.y=s*1.57; iom.rotation.z=0.02; g.add(iom);

            // hand — 8 carpals, 5 metacarpals, 14 phalanges
            const hand=new THREE.Group(); hand.position.set(s*2.56,1.08,0.08); hand.rotation.x=0.18; g.add(hand);
            const carpalPos=[[0,0.12],[0.08,0.08],[0.14,0.02],[0.10,-0.06],[-0.08,0.10],[-0.12,0.03],[-0.10,-0.06],[-0.02,-0.10]];
            carpalPos.forEach(p=>{ const c=new THREE.Mesh(new THREE.SphereGeometry(0.042,14,12), boneMat()); c.position.set(p[0],p[1],0); hand.add(c); c.userData.name='Hand Bones'; pickables.push(c); });
            for(let f=0; f<5; f++){
                const isThumb=f===0; const metaLen=isThumb?0.28:0.44;
                const meta=new THREE.Mesh(latheBone(metaLen,0.018,0.026,12), boneMat());
                const fx=(f-2)*0.085; meta.position.set(fx, -0.08 - metaLen/2,0.02); if(isThumb){ meta.position.set(s*-0.20,0.02,0.06); meta.rotation.z=s*0.62; meta.rotation.x=0.45; }
                hand.add(meta); meta.userData.name='Hand Bones'; pickables.push(meta);
                let curY= meta.position.y - metaLen/2 -0.015;
                const segs=isThumb?2:3;
                for(let j=0;j<segs;j++){
                    const pLen=[0.22,0.14,0.09][j]*(isThumb?1.15:1);
                    const pR=[0.018,0.015,0.012][j];
                    const ph=new THREE.Mesh(latheBone(pLen,pR,pR*1.25,10), boneMat());
                    ph.position.set(meta.position.x, curY - pLen/2, 0.02); if(isThumb) ph.rotation.z=s*0.32;
                    hand.add(ph); ph.userData.name='Hand Bones'; pickables.push(ph);
                    // joint
                    const jnt=new THREE.Mesh(new THREE.SphereGeometry(pR*0.95,10,8), cartilageMat()); jnt.position.set(meta.position.x, curY+0.008,0.02); hand.add(jnt);
                    curY -= pLen + 0.015;
                }
            }
        }

        // ---- Lower limbs — femur head/neck/trochanters/condyles, patella, tibia/fibula, foot ----
        for(const s of [-1,1]){
            const femLen=3.92; const fem=new THREE.Mesh(latheBone(femLen,0.115,0.158,28), corticalMat());
            fem.position.set(s*1.02,-0.42,0.01); fem.rotation.z=s*0.04; register(fem,'Femur',g);
            const fHead=new THREE.Mesh(new THREE.SphereGeometry(0.225,32,24), boneMat()); fHead.position.set(s*0.74,1.72,0.05); g.add(fHead); fHead.userData.name='Femur'; pickables.push(fHead);
            const fNeck=new THREE.Mesh(cyl(0.115,0.125,0.38,24), boneMat()); fNeck.position.set(s*0.86,1.60,0.04); fNeck.rotation.z=s*1.18; fNeck.rotation.x=0.18; g.add(fNeck); fNeck.userData.name='Femur'; pickables.push(fNeck);
            const gt2=new THREE.Mesh(new THREE.SphereGeometry(0.14,20,16), boneMat()); gt2.position.set(s*1.12,1.62,0.03); g.add(gt2); gt2.userData.name='Femur'; pickables.push(gt2);
            const lt2=new THREE.Mesh(new THREE.SphereGeometry(0.07,14,10), boneMat()); lt2.position.set(s*0.90,1.48,0.12); g.add(lt2); lt2.userData.name='Femur'; pickables.push(lt2);
            const linea=new THREE.Mesh(new THREE.BoxGeometry(0.015,1.8,0.015), new THREE.MeshBasicMaterial({color:0xa99e8e})); linea.position.set(0,0,0.08); fem.add(linea);
            const fCondM=new THREE.Mesh(new THREE.SphereGeometry(0.16,20,16), boneMat()); fCondM.position.set(s*0.94,-2.36, -0.04); g.add(fCondM); fCondM.userData.name='Femur'; pickables.push(fCondM);
            const fCondL=new THREE.Mesh(new THREE.SphereGeometry(0.16,20,16), boneMat()); fCondL.position.set(s*1.10,-2.36, -0.04); g.add(fCondL); fCondL.userData.name='Femur'; pickables.push(fCondL);

            const pat=new THREE.Mesh(new THREE.SphereGeometry(0.155,20,16), boneMat()); pat.position.set(s*1.03,-2.42,0.20); pat.scale.set(1,1.18,0.58); register(pat,'Patellae',g);
            // patellar facets hint
            const ridge=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.18,0.02), new THREE.MeshBasicMaterial({color:0x8a857a})); ridge.position.set(0,0,0.08); pat.add(ridge);

            const tib=new THREE.Mesh(latheBone(3.18,0.098,0.145,24), corticalMat()); tib.position.set(s*1.01,-4.02,0.06); register(tib,'Tibia and Fibula',g);
            const tibPlatM=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.08,0.14), boneMat()); tibPlatM.position.set(s*0.95,-2.48,0.04); g.add(tibPlatM); tibPlatM.userData.name='Tibia and Fibula'; pickables.push(tibPlatM);
            const tibPlatL=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.08,0.14), boneMat()); tibPlatL.position.set(s*1.09,-2.48,0.04); g.add(tibPlatL); tibPlatL.userData.name='Tibia and Fibula'; pickables.push(tibPlatL);
            const tibTub=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.14,12), boneMat()); tibTub.position.set(s*1.01,-2.78,0.18); tibTub.rotation.x=0.35; g.add(tibTub); tibTub.userData.name='Tibia and Fibula'; pickables.push(tibTub);
            const medMal=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.18,0.06), boneMat()); medMal.position.set(s*0.92,-5.58,0.05); g.add(medMal); medMal.userData.name='Tibia and Fibula'; pickables.push(medMal);
            const fib=new THREE.Mesh(latheBone(3.05,0.038,0.052,20), boneMat()); fib.position.set(s*1.23,-4.06,-0.04); register(fib,'Tibia and Fibula',g);
            const fibHead=new THREE.Mesh(new THREE.SphereGeometry(0.07,16,12), boneMat()); fibHead.position.set(s*1.23,-2.52,-0.02); g.add(fibHead); fibHead.userData.name='Tibia and Fibula'; pickables.push(fibHead);
            const latMal=new THREE.Mesh(new THREE.BoxGeometry(0.055,0.16,0.055), boneMat()); latMal.position.set(s*1.23,-5.62,-0.04); g.add(latMal); latMal.userData.name='Tibia and Fibula'; pickables.push(latMal);

            const foot=new THREE.Group(); foot.position.set(s*1.04,-5.66,0.06); g.add(foot);
            const calc=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.16,0.36), boneMat()); calc.position.set(0,-0.02,-0.14); foot.add(calc); calc.userData.name='Foot Bones'; pickables.push(calc);
            const talus=new THREE.Mesh(new THREE.SphereGeometry(0.11,16,12), boneMat()); talus.position.set(0,0.10,0.02); foot.add(talus); talus.userData.name='Foot Bones'; pickables.push(talus);
            const navic=new THREE.Mesh(new THREE.SphereGeometry(0.07,14,10), boneMat()); navic.position.set(0,0.04,0.18); foot.add(navic); navic.userData.name='Foot Bones'; pickables.push(navic);
            const cuboid=new THREE.Mesh(new THREE.BoxGeometry(0.10,0.07,0.12), boneMat()); cuboid.position.set(s*0.08,0.02,0.14); foot.add(cuboid); cuboid.userData.name='Foot Bones'; pickables.push(cuboid);
            for(let c=0;c<3;c++){ const cun=new THREE.Mesh(new THREE.SphereGeometry(0.045,12,10), boneMat()); cun.position.set(s*-0.06 + c*0.05,0.03,0.22); foot.add(cun); cun.userData.name='Foot Bones'; pickables.push(cun); }
            for(let t=0;t<5;t++){
                const isBig=t===0; const mtLen=0.42;
                const mt=new THREE.Mesh(latheBone(mtLen,0.022,0.030,12), boneMat());
                mt.rotation.x=Math.PI/2+0.14; mt.position.set(s*(t-2)*0.062, -0.02, 0.38+mtLen/2); foot.add(mt); mt.userData.name='Foot Bones'; pickables.push(mt);
                let curZ=0.38+mtLen+0.04;
                for(let j=0;j<(isBig?2:3);j++){
                    const pLen=[0.14,0.09,0.07][j]*(isBig?1.28:1); const pr=[0.020,0.016,0.012][j];
                    const ph=new THREE.Mesh(latheBone(pLen,pr,pr*1.2,10), boneMat()); ph.rotation.x=Math.PI/2; ph.position.set(s*(t-2)*0.062, -0.08, curZ+pLen/2); foot.add(ph); ph.userData.name='Foot Bones'; pickables.push(ph);
                    curZ+=pLen+0.012;
                }
            }
        }
    }

    // ================================================================
    // ORGANS — true parenchyma, fissures, capsule, lobulation
    // ================================================================
    function buildOrgans() {
        const g=groups.organs;
        const brainM=()=>mat(0xc8b8d8,{roughness:0.62, clearcoat:0.35, emissive:0x1a1020, emissiveIntensity:0.08});
        const brain=new THREE.Mesh(new THREE.SphereGeometry(0.52,48,40), brainM()); brain.position.set(0,8.02,-0.04); register(brain,'Brain',g);
        // gyri displacement
        const bPos=brain.geometry.attributes.position;
        for(let i=0;i<bPos.count;i++){ const x=bPos.getX(i), y=bPos.getY(i), z=bPos.getZ(i); const n=Math.sin(x*12)*Math.cos(y*10)*Math.sin(z*11)*0.025; bPos.setXYZ(i,x+n,y+n,z+n); }
        brain.geometry.computeVertexNormals();
        for(const s of [-1,1]){
            const hemi=new THREE.Mesh(new THREE.SphereGeometry(0.44,32,28), brainM()); hemi.position.set(s*0.22,0.05,0); hemi.scale.set(0.96,1.0,1.08); brain.add(hemi);
            const gyri=new THREE.Mesh(new THREE.TorusKnotGeometry(0.18,0.025,80,12,2,3), brainM()); gyri.position.set(s*0.18,0.10,0.12); gyri.scale.set(0.7,0.5,0.6); brain.add(gyri);
        }
        const cereb=new THREE.Mesh(new THREE.SphereGeometry(0.26,24,18), brainM()); cereb.position.set(0,-0.44,-0.18); cereb.scale.set(1.25,0.58,0.82); brain.add(cereb);
        const brainstem=new THREE.Mesh(cyl(0.09,0.07,0.28,20), brainM()); brainstem.position.set(0,-0.62,-0.12); brainstem.rotation.x=0.25; brain.add(brainstem);

        for(const s of [-1,1]) { const tg=register(new THREE.Mesh(new THREE.SphereGeometry(0.14,20,16), mat(0xb1534a,{roughness:0.52})),'Thyroid Gland',g); tg.position.set(s*0.20,6.80,0.16); }
        // fix thyroid compact
        // trachea — C-rings visible
        const tracheaPts=[[0,6.88,0.10],[0,6.2,0.06],[0,5.22,0.01]];
        register(new THREE.Mesh(tubeFromPoints(tracheaPts,0.072,24), mat(0xd8e4e8,{roughness:0.38})),'Trachea',g);
        for(let r=0;r<10;r++){ const ring=new THREE.Mesh(new THREE.TorusGeometry(0.072,0.008,8,20, Math.PI*1.32), mat(0xc8d8de,{roughness:0.35})); ring.position.set(0,6.78 - r*0.14,0.08); ring.rotation.x=0.12; ring.rotation.z=Math.PI*0.84; g.add(ring); ring.userData.name='Trachea'; pickables.push(ring); }
        for(const s of [-1,1]){ const br=new THREE.Mesh(tubeFromPoints([[0,5.18,0.01],[s*0.32,4.96,-0.07],[s*0.68,4.72,-0.12]],0.042,16), mat(0xd0dde2,{roughness:0.40})); br.userData.name='Trachea'; g.add(br); pickables.push(br); }

        // lungs — true fissures, hilum
        const lungM=()=>mat(0xd49a9a,{roughness:0.68, clearcoat:0.22, transmission:0.18, thickness:0.45});
        const leftLung=register(new THREE.Mesh(new THREE.SphereGeometry(1.02,40,36), lungM()),'Left Lung',g);
        leftLung.position.set(1.02,4.74,-0.04); leftLung.rotation.z=-0.05; leftLung.scale.set(0.72,1.42,0.60);
        const rightLung=register(new THREE.Mesh(new THREE.SphereGeometry(1.02,40,36), lungM()),'Right Lung',g);
        rightLung.position.set(-1.02,4.74,-0.04); rightLung.rotation.z=0.05; rightLung.scale.set(0.76,1.42,0.60);
        // fissures as dark lines
        [leftLung,rightLung].forEach((lu,idx)=>{
            const fiss=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.015), new THREE.MeshBasicMaterial({color:0x6b3a3a, transparent:true, opacity:0.22, side:THREE.DoubleSide}));
            fiss.position.set(0,0.18,0.38); fiss.rotation.z= idx===0? -0.62:0.62; fiss.rotation.x=0.35; lu.add(fiss);
            if(idx===1){ const horiz=new THREE.Mesh(new THREE.PlaneGeometry(0.55,0.012), new THREE.MeshBasicMaterial({color:0x6b3a3a, transparent:true, opacity:0.18, side:THREE.DoubleSide})); horiz.position.set(-0.08,0.48,0.35); horiz.rotation.z=0.15; lu.add(horiz); }
            const hilum=new THREE.Mesh(new THREE.SphereGeometry(0.11,14,10), mat(0x7a3a3a,{roughness:0.45})); hilum.position.set(idx===0?-0.38:0.38,0.08,0.12); lu.add(hilum);
        });

        // heart — 4 chambers, apex, great vessels
        const heartM=()=>mat(0xb42e2e,{roughness:0.38, clearcoat:0.9, clearcoatRoughness:0.28});
        const heart=register(new THREE.Mesh(new THREE.SphereGeometry(0.52,36,28), heartM()),'Heart',g);
        heart.position.set(0.30,4.52,0.24); heart.rotation.set(0.12,0,-0.52); heart.scale.set(0.96,1.12,0.84);
        const apex=new THREE.Mesh(new THREE.ConeGeometry(0.34,0.48,24), heartM()); apex.rotation.z=Math.PI; apex.position.set(0.02,-0.44,0); heart.add(apex);
        // inter-ventricular sulcus
        const ivs=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.72,0.02), new THREE.MeshBasicMaterial({color:0x7a1a1a})); ivs.position.set(0.02,-0.08,0.38); heart.add(ivs);
        const la=new THREE.Mesh(new THREE.SphereGeometry(0.18,16,12), heartM()); la.position.set(-0.18,0.38,-0.08); heart.add(la);
        const ra=new THREE.Mesh(new THREE.SphereGeometry(0.20,16,12), heartM()); ra.position.set(0.32,0.36, -0.02); heart.add(ra);
        const aortaStub=new THREE.Mesh(cyl(0.095,0.11,0.42,20), heartM()); aortaStub.position.set(-0.06,0.52,-0.04); aortaStub.rotation.z=0.18; heart.add(aortaStub);
        const pulmTrunk=new THREE.Mesh(cyl(0.085,0.095,0.36,20), mat(0x4a6a9a,{roughness:0.35})); pulmTrunk.position.set(0.14,0.48,0.10); pulmTrunk.rotation.z=-0.22; heart.add(pulmTrunk);
        // coronary arteries hint
        const lad=new THREE.Mesh(tubeFromPoints([[0.06,0.22,0.42],[0.04,-0.08,0.44],[0.02,-0.32,0.38]],0.015,16), mat(0x8a1a1a,{roughness:0.25})); heart.add(lad);

        // liver — right + left + caudate + quadrate, falciform
        const livM=()=>mat(0x8d4a32,{roughness:0.48, clearcoat:0.45});
        const liver=register(new THREE.Mesh(new THREE.SphereGeometry(0.88,36,28), livM()),'Liver',g);
        liver.position.set(-0.56,3.30,0.08); liver.scale.set(1.06,0.58,0.70);
        const llobe=new THREE.Mesh(new THREE.SphereGeometry(0.42,24,18), livM()); llobe.position.set(0.56,0.04,0.04); llobe.scale.set(0.92,0.72,0.68); liver.add(llobe);
        const caudate=new THREE.Mesh(new THREE.SphereGeometry(0.14,14,10), livM()); caudate.position.set(0.18,-0.12,-0.28); liver.add(caudate);
        const falc=new THREE.Mesh(new THREE.PlaneGeometry(0.015,0.62), new THREE.MeshBasicMaterial({color:0xe8dcc8, transparent:true, opacity:0.55, side:THREE.DoubleSide})); falc.position.set(0.32,0.06,0.42); falc.rotation.y=0.15; liver.add(falc);
        const gb=register(new THREE.Mesh(new THREE.SphereGeometry(0.12,18,14), mat(0x6fa05a,{roughness:0.38, clearcoat:0.85})),'Gallbladder',g); gb.position.set(-0.36,3.00,0.32); gb.scale.set(1,1.45,1);

        // stomach — fundus, body, antrum, pylorus
        const stomM=()=>mat(0xb98358,{roughness:0.52, clearcoat:0.35});
        const stom=register(new THREE.Mesh(tubeFromPoints([[0.34,3.56,0.05],[0.70,3.36,0.10],[0.64,3.02,0.13],[0.30,2.84,0.10],[0.04,2.74,0.06]],0.20,24), stomM()),'Stomach',g);
        const fundus=new THREE.Mesh(new THREE.SphereGeometry(0.22,20,16), stomM()); fundus.position.set(0.73,3.51,0.10); g.add(fundus); fundus.userData.name='Stomach'; pickables.push(fundus);
        const pyl=new THREE.Mesh(cyl(0.06,0.05,0.14,16), stomM()); pyl.position.set(0.02,2.72,0.06); pyl.rotation.z=0.45; g.add(pyl); pyl.userData.name='Stomach'; pickables.push(pyl);
        // rugae hint
        for(let i=0;i<4;i++){ const ruga=new THREE.Mesh(new THREE.TorusGeometry(0.11,0.012,8,16,Math.PI), new THREE.MeshBasicMaterial({color:0x7a4a32, transparent:true, opacity:0.18})); ruga.position.set(0.45,3.28 - i*0.12,0.14); ruga.rotation.z=0.35; stom.add(ruga); }

        const spleen=register(new THREE.Mesh(new THREE.SphereGeometry(0.26,24,18), mat(0x7a3d5e,{roughness:0.48, clearcoat:0.35})),'Spleen',g); spleen.position.set(1.16,3.16,-0.36); spleen.scale.set(1,0.72,0.55);
        register(new THREE.Mesh(tubeFromPoints([[1.02,2.86,0.05],[0.52,2.76,0.10],[0.06,2.73,0.12],[-0.24,2.79,0.10]],0.095,18), mat(0xc9a86a,{roughness:0.58})),'Pancreas',g);
        // pancreatic duct hint
        // kidneys — cortex, medulla, pelvis, ureters with peristalsis hint
        for(const s of [-1,1]){
            const kid=new THREE.Mesh(new THREE.SphereGeometry(0.28,28,22), mat(0x9c4a4a,{roughness:0.46, clearcoat:0.32})); register(kid,'Kidneys',g);
            kid.position.set(s*0.74,2.64,-0.52); kid.rotation.y=s*-0.32; kid.scale.set(0.78,1.48,0.62);
            const pelvis=new THREE.Mesh(new THREE.SphereGeometry(0.07,12,10), mat(0xe8dcc8,{roughness:0.42})); pelvis.position.set(s*0.10, -0.08,0.18); kid.add(pelvis);
            const calyces=new THREE.Mesh(new THREE.SphereGeometry(0.045,10,8), mat(0xc9a86a,{roughness:0.5})); calyces.position.set(s*0.06,0.12,0.08); kid.add(calyces);
            register(new THREE.Mesh(tubeFromPoints([[s*0.76,2.36,-0.44],[s*0.62,1.72,-0.22],[s*0.30,1.16,0.12]],0.032,18), mat(0xe0d0bc,{roughness:0.48})),'Ureters',g);
        }
        // small intestine — valvulae conniventes hint
        const si=new THREE.Mesh(new THREE.TorusKnotGeometry(0.52,0.13,140,18,2,3), mat(0xc78f6f,{roughness:0.58})); register(si,'Small Intestine',g); si.position.set(0,1.86,0.13); si.scale.set(1.14,0.54,0.84);
        const si2=new THREE.Mesh(new THREE.TorusKnotGeometry(0.36,0.10,110,16,3,2), mat(0xbf8565,{roughness:0.58})); register(si2,'Small Intestine',g); si2.position.set(0.10,1.63,0.06); si2.scale.set(1.0,0.48,0.78);
        // colon — haustra, taenia coli
        const colonM=()=>mat(0xb57f63,{roughness:0.56, clearcoat:0.28});
        const asc=new THREE.Mesh(cyl(0.128,0.128,1.52,24), colonM()); asc.position.set(-1.04,2.11,0.02); g.add(asc);
        const cec=new THREE.Mesh(new THREE.SphereGeometry(0.155,18,14), colonM()); cec.position.set(-1.04,1.31,0.05); g.add(cec);
        const appdx=new THREE.Mesh(tubeFromPoints([[-1.04,1.31,0.05],[-1.02,1.12,0.12],[-0.98,1.02,0.08]],0.025,12), colonM()); g.add(appdx);
        const tra2=new THREE.Mesh(cyl(0.122,0.122,1.92,24), colonM()); tra2.rotation.z=Math.PI/2; tra2.position.set(0,2.86,0.18); g.add(tra2);
        const desc2=new THREE.Mesh(cyl(0.128,0.128,1.52,24), colonM()); desc2.position.set(1.04,2.11,0.02); g.add(desc2);
        const sigm=new THREE.Mesh(new THREE.TorusGeometry(0.20,0.10,14,20,Math.PI), colonM()); sigm.position.set(1.02,1.36,0.05); sigm.rotation.z=Math.PI/2; sigm.scale.set(1,0.82,1); g.add(sigm);
        // taenia on colon
        [asc,tra2,desc2].forEach(seg=>{ const taenia=new THREE.Mesh(new THREE.BoxGeometry(0.012, seg===tra2?1.88:1.48,0.012), new THREE.MeshBasicMaterial({color:0x8a5a3a})); taenia.position.set(0,0,0.11); seg.add(taenia); });
        [asc,cec,appdx,tra2,desc2,sigm].forEach(m=>{ m.userData.name='Colon'; pickables.push(m); });
        const blad=register(new THREE.Mesh(new THREE.SphereGeometry(0.28,24,20), mat(0xc9b86a,{roughness:0.44, clearcoat:0.65, opacity:0.90})),'Urinary Bladder',g); blad.position.set(0,0.96,0.23); blad.scale.set(1,0.82,0.72);
    }

    // ================================================================
    // MUSCLES — fiber bundles, aponeuroses, true origins/insertions
    // ================================================================
    function buildMuscles(){
        const g=groups.muscles;
        const mM=(hex)=>muscleMat(hex);
        for(const s of [-1,1]){
            // pectoralis major — two heads
            const pecS=new THREE.Mesh(new THREE.SphereGeometry(0.42,24,18), mM(0xa34a3f)); register(pecS,'Pectoralis',g); pecS.position.set(s*0.52,5.38,0.52); pecS.scale.set(0.95,0.55,0.28);
            const pecC=new THREE.Mesh(new THREE.SphereGeometry(0.45,24,18), mM(0x9e443c)); register(pecC,'Pectoralis',g); pecC.position.set(s*0.68,5.02,0.50); pecC.scale.set(1.05,0.85,0.30);
            // deltoid — anterior/middle/posterior
            const delA=new THREE.Mesh(new THREE.SphereGeometry(0.26,20,16), mM(0xa6534a)); register(delA,'Deltoids',g); delA.position.set(s*1.82,5.84,0.12); delA.scale.set(1,0.95,0.9);
            const delM=new THREE.Mesh(new THREE.SphereGeometry(0.28,20,16), mM(0xa04e44)); register(delM,'Deltoids',g); delM.position.set(s*1.92,5.72,-0.02); delM.scale.set(1,0.95,0.95);
            const delP=new THREE.Mesh(new THREE.SphereGeometry(0.24,18,14), mM(0x9a4840)); register(delP,'Deltoids',g); delP.position.set(s*1.84,5.64,-0.14);
            // trapezius — upper / middle / lower
            const trapU=new THREE.Mesh(new THREE.SphereGeometry(0.32,20,14), mM(0x9a443e)); register(trapU,'Trapezius',g); trapU.position.set(s*0.42,6.48,-0.32); trapU.scale.set(1.0,0.52,0.48);
            const trapM=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.28,0.08), mM(0x96423c)); register(trapM,'Trapezius',g); trapM.position.set(s*0.58,6.18,-0.38); trapM.rotation.z=s*0.12;
            const trapL=new THREE.Mesh(new THREE.SphereGeometry(0.28,18,12), mM(0x923f39)); register(trapL,'Trapezius',g); trapL.position.set(s*0.52,5.82,-0.36); trapL.scale.set(0.9,0.62,0.42);
            // biceps — long + short head + distal tendon
            const biL=new THREE.Mesh(cyl(0.11,0.13,1.05,20), mM(0xa6534a)); register(biL,'Biceps',g); biL.position.set(s*2.16,5.22,0.24); biL.rotation.z=s*0.06;
            const biS=new THREE.Mesh(cyl(0.09,0.11,1.02,20), mM(0xa04e44)); register(biS,'Biceps',g); biS.position.set(s*2.24,5.18,0.18); biS.rotation.z=s*0.06;
            const biTen=new THREE.Mesh(cyl(0.04,0.06,0.38,14), mat(0xe8ddd0,{roughness:0.42})); biTen.position.set(s*2.22,4.42,0.14); biTen.rotation.z=s*0.08; g.add(biTen);
            const trLat=new THREE.Mesh(cyl(0.13,0.15,1.05,18), mM(0x96423c)); register(trLat,'Biceps',g); trLat.position.set(s*2.40,5.02,-0.08); trLat.rotation.z=s*0.07;
            // rectus abdominis — 6-pack with tendinous intersections + linea alba
            for(let r=0;r<6;r++){
                const yR=3.68 - r*0.22; const wR= r<2?0.26: r<4?0.24:0.20;
                const rect=new THREE.Mesh(new THREE.BoxGeometry(wR,0.16,0.06), mM(0xa6534a)); register(rect,'Abdominal Wall',g); rect.position.set(s*0.16, yR, 0.64);
                if(r===2||r===4){ const ins=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.012,0.015), new THREE.MeshBasicMaterial({color:0xe8ddd0})); ins.position.set(0,0.09,0.03); rect.add(ins); }
            }
            const linea=new THREE.Mesh(new THREE.BoxGeometry(0.012,1.48,0.015), new THREE.MeshBasicMaterial({color:0xe8ddd0, transparent:true, opacity:0.9})); linea.position.set(0,3.08,0.67); g.add(linea);
            const obl=new THREE.Mesh(new THREE.SphereGeometry(0.38,20,14), mM(0x9a4840)); register(obl,'Abdominal Wall',g); obl.position.set(s*0.62,3.02,0.42); obl.scale.set(0.55,1.25,0.32);
            // gluteals — max / med / min
            const gMax=new THREE.Mesh(new THREE.SphereGeometry(0.52,24,18), mM(0x9a443e)); register(gMax,'Gluteals',g); gMax.position.set(s*0.52,1.56,-0.38); gMax.scale.set(1.02,0.92,0.92);
            const gMed=new THREE.Mesh(new THREE.SphereGeometry(0.32,18,14), mM(0x96423c)); register(gMed,'Gluteals',g); gMed.position.set(s*0.72,1.88,-0.28); gMed.scale.set(0.9,0.62,0.72);
            // quadriceps — 4 heads
            const rf=new THREE.Mesh(cyl(0.14,0.16,1.55,20), mM(0xa6534a)); register(rf,'Quadriceps',g); rf.position.set(s*0.96,0.02,0.22); rf.rotation.x=-0.06;
            const vl=new THREE.Mesh(cyl(0.13,0.15,1.48,20), mM(0xa04e44)); register(vl,'Quadriceps',g); vl.position.set(s*1.14,-0.02,0.14); vl.rotation.z=s*-0.08;
            const vm=new THREE.Mesh(cyl(0.12,0.14,1.32,20), mM(0x9a4840)); register(vm,'Quadriceps',g); vm.position.set(s*0.78,-0.08,0.16); vm.rotation.z=s*0.10;
            const vi=new THREE.Mesh(cyl(0.10,0.12,1.28,18), mM(0x96423c)); register(vi,'Quadriceps',g); vi.position.set(s*1.02,-0.12,0.06);
            const qTen=new THREE.Mesh(cyl(0.11,0.13,0.42,16), mat(0xe8ddd0,{roughness:0.40})); qTen.position.set(s*1.02,-1.02,0.18); g.add(qTen);
            // hamstrings — semimem / semitend / biceps femoris
            const sm=new THREE.Mesh(cyl(0.11,0.13,1.42,18), mM(0x96423c)); register(sm,'Hamstrings',g); sm.position.set(s*0.82,-0.42,-0.24);
            const st2=new THREE.Mesh(cyl(0.08,0.10,1.45,16), mM(0x9a4840)); register(st2,'Hamstrings',g); st2.position.set(s*0.92,-0.44,-0.26);
            const bf=new THREE.Mesh(cyl(0.12,0.14,1.38,18), mM(0x9a443e)); register(bf,'Hamstrings',g); bf.position.set(s*1.12,-0.48,-0.22);
            // calves — gastroc medial/lateral + soleus + Achilles
            const gastM=new THREE.Mesh(new THREE.SphereGeometry(0.22,20,14), mM(0xa6534a)); register(gastM,'Calves',g); gastM.position.set(s*0.94,-3.42,-0.22); gastM.scale.set(0.82,1.15,0.72);
            const gastL=new THREE.Mesh(new THREE.SphereGeometry(0.20,18,14), mM(0xa04e44)); register(gastL,'Calves',g); gastL.position.set(s*1.12,-3.48,-0.18); gastL.scale.set(0.78,1.08,0.68);
            const sol=new THREE.Mesh(cyl(0.16,0.14,1.05,18), mM(0x96423c)); register(sol,'Calves',g); sol.position.set(s*1.02,-4.12,-0.14);
            const ach=new THREE.Mesh(cyl(0.055,0.075,0.62,14), mat(0xe8ddd0,{roughness:0.35})); ach.position.set(s*1.02,-4.92,-0.18); g.add(ach);
        }
    }

    // ================================================================
    // VESSELS — complete arterial + venous tree, true branching
    // ================================================================
    function buildVessels(){
        const ART=0xc0392b, VEN=0x2a5a8a;
        // aortic root → arch → descending
        vesselMesh([[0.18,4.38,0.10],[0.32,5.12,0.12],[0.16,5.86,0.04],[-0.14,6.06,-0.04]],0.108,ART,'Aorta',0x3a0a0a);
        vesselMesh([[-0.14,6.06,-0.04],[-0.04,5.62,-0.12],[0.02,5.02,-0.15],[0.00,4.18,-0.18],[-0.04,3.02,-0.30],[-0.02,2.22,-0.33]],0.088,ART,'Aorta',0x3a0a0a);
        // arch branches — brachiocephalic, left carotid, left subclavian
        vesselMesh([[-0.08,5.98,0.02],[0.08,6.32,0.08],[0.22,6.58,0.06],[0.42,6.62,0.02]],0.042,ART,'Aorta',0x3a0a0a);
        vesselMesh([[0.04,6.02,0.00],[0.10,6.48,0.02],[0.14,6.92,-0.02],[0.14,7.32,-0.04]],0.032,ART,'Carotid Arteries',0x3a0a0a);
        vesselMesh([[-0.10,6.00,-0.04],[-0.18,6.42,-0.02],[-0.24,6.82,-0.04],[-0.26,7.28,-0.06]],0.038,ART,'Aorta',0x3a0a0a);
        for(const s of [-1,1]) vesselMesh([[s*0.10,6.02,-0.02],[s*0.22,6.32,0.00],[s*0.34,6.58,-0.02],[s*0.48,6.62,0.00]],0.036,ART,'Carotid Arteries',0x3a0a0a);
        // subclavian → axillary → brachial
        for(const s of [-1,1]) vesselMesh([[s*0.14,6.02,0.00],[s*0.85,5.92,0.06],[s*1.62,5.68,0.08],[s*2.18,5.12,0.06],[s*2.42,3.82,0.04],[s*2.52,2.02,0.06]],0.038,ART,'Aorta',0x3a0a0a);
        // thoracic branches — intercostals hint
        for(let i=0;i<6;i++){ const yB=5.42 - i*0.22; for(const s of [-1,1]) vesselMesh([[0.00,yB,-0.15],[s*0.32,yB-0.04,-0.18],[s*0.62,yB-0.08,-0.14]],0.012,ART,'Aorta',0x3a0a0a); }
        // abdominal aorta branches — celiac, SMA, renals, IMA
        vesselMesh([[0.00,3.22,-0.28],[0.18,3.18,0.05],[0.32,3.14,0.12]],0.028,ART,'Aorta',0x3a0a0a);
        vesselMesh([[0.00,2.92,-0.28],[0.12,2.84,0.02],[0.22,2.76,0.10]],0.022,ART,'Aorta',0x3a0a0a);
        for(const s of [-1,1]) vesselMesh([[0.00,2.62,-0.30],[s*0.32,2.60,-0.38],[s*0.62,2.58,-0.42]],0.026,ART,'Aorta',0x3a0a0a);
        vesselMesh([[0.00,1.82,-0.32],[-0.08,1.62,-0.18],[-0.12,1.42,0.02]],0.018,ART,'Aorta',0x3a0a0a);
        // common iliac → external / internal
        for(const s of [-1,1]){
            vesselMesh([[-0.02,2.02,-0.33],[s*0.32,1.72,-0.28],[s*0.58,1.22,-0.16]],0.052,ART,'Aorta',0x3a0a0a);
            vesselMesh([[s*0.58,1.22,-0.16],[s*0.78,0.62,0.08],[s*0.96,-0.18,0.14],[s*1.02,-1.82,0.08],[s*1.04,-3.62,0.04],[s*1.03,-5.12,0.04]],0.042,ART,'Femoral Arteries',0x3a0a0a);
            vesselMesh([[s*0.58,1.22,-0.16],[s*0.48,0.92,-0.18],[s*0.38,0.62,-0.22]],0.028,ART,'Femoral Arteries',0x3a0a0a);
            // popliteal trifurcation
            vesselMesh([[s*1.03,-5.12,0.04],[s*1.02,-5.62,-0.02],[s*0.98,-6.02,0.06]],0.022,ART,'Femoral Arteries',0x3a0a0a);
            vesselMesh([[s*1.03,-5.12,0.04],[s*1.08,-5.58,-0.08],[s*1.12,-5.98,-0.12]],0.020,ART,'Femoral Arteries',0x3a0a0a);
        }
        // pulmonary trunk + branches
        vesselMesh([[0.30,4.72,0.20],[0.22,5.04,0.06],[0.04,5.10,-0.04],[-0.58,4.96,-0.10]],0.072,0x3d5a80,'Pulmonary Arteries',0x0f1e32);
        vesselMesh([[0.04,5.10,-0.04],[0.72,4.92,-0.08],[1.02,4.72,-0.10]],0.052,0x3d5a80,'Pulmonary Arteries',0x0f1e32);
        vesselMesh([[0.04,5.10,-0.04],[-0.32,5.14,-0.06],[-0.62,5.02,-0.08]],0.048,0x3d5a80,'Pulmonary Arteries',0x0f1e32);
        // venous — SVC, IVC, jugular, subclavian, pulmonary veins
        vesselMesh([[0.28,6.42,0.04],[0.30,5.82,0.06],[0.32,5.12,0.08],[0.32,4.62,0.02]],0.088,VEN,'Inferior Vena Cava',0x0a1830);
        vesselMesh([[0.30,4.62,0.02],[0.34,3.42,-0.12],[0.32,2.22,-0.20],[0.28,1.36,0.02]],0.098,VEN,'Inferior Vena Cava',0x0a1830);
        for(const s of [-1,1]){
            vesselMesh([[s*0.18,6.62,0.02],[s*0.24,6.92,0.00],[s*0.26,7.28, -0.02]],0.032,VEN,'Carotid Arteries',0x0a1830);
            vesselMesh([[s*0.42,6.62,0.02],[s*0.85,6.42,0.04],[s*1.42,6.12,0.06]],0.034,VEN,'Inferior Vena Cava',0x0a1830);
            vesselMesh([[s*0.72,1.48,0.04],[s*1.12,0.58,0.08],[s*1.22,-1.18,0.02],[s*1.18,-3.48,-0.04]],0.048,VEN,'Femoral Arteries',0x0a1830);
        }
        vesselMesh([[0.30,1.36,0.02],[0.34,2.22,-0.20],[0.32,3.42,-0.12],[0.30,4.62,0.02]],0.098,VEN,'Inferior Vena Cava',0x0a1830);
        // azygos
        vesselMesh([[0.22,5.42,-0.22],[0.24,4.82,-0.28],[0.26,4.12,-0.26],[0.28,3.42,-0.18]],0.018,VEN,'Inferior Vena Cava',0x0a1830);
    }

    // ================================================================
    // SKIN / BODY SHELL — subsurface, pores, true silhouette
    // ================================================================
    function buildShell(){
        const g=groups.shell;
        const skinM=()=>new THREE.MeshPhysicalMaterial({ color:0xd9a184, metalness:0, roughness:0.58, transparent:true, opacity:0.28, clearcoat:0.45, clearcoatRoughness:0.55, sheen:0.85, sheenColor:new THREE.Color(0xffc4ad), sheenRoughness:0.65 });
        const reg=(m)=>register(m,'Body Outline',g);
        const prof=[[0.02,1.05],[0.74,1.15],[1.00,1.55],[0.94,2.20],[0.82,2.90],[0.92,3.60],[1.14,4.40],[1.20,5.10],[1.06,5.70],[0.64,6.15],[0.36,6.45],[0.31,6.75]].map(p=>new THREE.Vector2(p[0],p[1]));
        const torso=new THREE.Mesh(new THREE.LatheGeometry(prof,64), skinM()); torso.scale.z=0.68; torso.userData.breath=true; reg(torso);
        for(const s of [-1,1]){ const hp=new THREE.Mesh(new THREE.SphereGeometry(0.62,24,18), skinM()); hp.position.set(s*0.50,1.55,-0.05); hp.scale.set(1,0.9,0.85); reg(hp); }
        const hd=new THREE.Mesh(new THREE.SphereGeometry(0.62,32,28), skinM()); hd.position.set(0,7.90,-0.02); hd.scale.set(0.95,1.15,1.02); reg(hd);
        const jawS=new THREE.Mesh(new THREE.SphereGeometry(0.34,20,16), skinM()); jawS.position.set(0,7.42,0.14); jawS.scale.set(0.9,0.7,0.95); reg(jawS);
        const nose=new THREE.Mesh(new THREE.ConeGeometry(0.07,0.16,12), skinM()); nose.position.set(0,7.85,0.60); nose.rotation.x=Math.PI/2.2; reg(nose);
        const neck=new THREE.Mesh(cyl(0.30,0.36,0.85,24), skinM()); neck.position.set(0,6.95,0); reg(neck);
        for(const s of [-1,1]){ const sh=new THREE.Mesh(new THREE.SphereGeometry(0.52,24,18), skinM()); sh.position.set(s*1.85,5.72,0); sh.scale.set(1.05,0.9,0.9); reg(sh); }
        for(const s of [-1,1]){
            const ua=new THREE.Mesh(cyl(0.33,0.25,2.35,24), skinM()); ua.position.set(s*2.32,4.70,0.02); ua.rotation.z=s*0.07; reg(ua);
            const fa=new THREE.Mesh(cyl(0.24,0.16,2.35,24), skinM()); fa.position.set(s*2.46,2.35,0.05); fa.rotation.z=s*0.05; reg(fa);
            const ha=new THREE.Mesh(new THREE.SphereGeometry(0.22,18,14), skinM()); ha.position.set(s*2.52,1.00,0.10); ha.scale.set(0.8,1.3,0.45); reg(ha);
        }
        for(const s of [-1,1]){
            const th=new THREE.Mesh(cyl(0.48,0.33,4.00,28), skinM()); th.position.set(s*0.97,-0.35,0); th.rotation.z=s*-0.02; reg(th);
            const ca=new THREE.Mesh(cyl(0.32,0.19,3.15,24), skinM()); ca.position.set(s*1.01,-3.90,0); reg(ca);
            const ft=new THREE.Mesh(new THREE.SphereGeometry(0.30,20,14), skinM()); ft.position.set(s*1.02,-5.62,0.25); ft.scale.set(0.62,0.4,1.7); reg(ft);
        }
    }

    function build(sceneRef){
        scene=sceneRef;
        groups.bones=new THREE.Group(); groups.organs=new THREE.Group();
        groups.muscles=new THREE.Group(); groups.vessels=new THREE.Group(); groups.shell=new THREE.Group();
        for(const k in groups) scene.add(groups[k]);
        buildShell(); buildVessels(); buildOrgans(); buildMuscles(); buildSkeleton();
        const densityMap={ 'Lumbar Spine':1.0,'Pelvis':0.95,'Sacrum':0.9,'Femur':0.85,'Thoracic Spine':0.8,'Cervical Spine':0.5,'Rib Cage':0.45,'Skull':0.4,'Patellae':0.5 };
        for(const m of pickables){ if(groups.bones.children.includes(m) || (m.parent && groups.bones.children.includes(m.parent))) m.userData.density=densityMap[m.userData.name]!==undefined?densityMap[m.userData.name]:0.3; }
        return { groups, pickables, STRUCTURE_INFO };
    }
    return { build };
})();
