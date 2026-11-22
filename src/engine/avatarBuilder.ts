import * as THREE from 'three';
import {
  AvatarConfig,
  BeardStyle,
  HairStyle,
  HatStyle,
  ShirtStyle,
} from '../types/blockhaven';

export const DEFAULT_AVATAR: AvatarConfig = {
  displayName: 'Ashley',
  bodyColor: '#DFB796',
  shirtColor: '#3C5064',
  shirtStyle: 'striped',
  pantsColor: '#3C352E',
  hat: 'cap',
  hatColor: '#7D5838',
  hairStyle: 'short',
  beardStyle: 'none',
  hairColor: '#5F4936',
};

export const BODY_COLORS = [
  { label: 'Fair Nordic', hex: '#DFB796' },
  { label: 'Warm Rose', hex: '#D1A182' },
  { label: 'Honey Tan', hex: '#BE8C64' },
  { label: 'Weathered Bronze', hex: '#9E6E4A' },
  { label: 'Chestnut', hex: '#7B4F32' },
  { label: 'Deep Umber', hex: '#583824' },
  { label: 'Frost Pale', hex: '#CFC3B8' },
  { label: 'Moss Kin', hex: '#969E82' },
];

export const SHIRT_COLORS = [
  { label: 'Fjord Slate', hex: '#3C5064' },
  { label: 'Pine Moss', hex: '#485A40' },
  { label: 'Hearth Rust', hex: '#7B4033' },
  { label: 'Ochre Linen', hex: '#967440' },
  { label: 'Heather Plum', hex: '#5A4A5B' },
  { label: 'Seaweed Teal', hex: '#3B5C59' },
  { label: 'Charcoal Wool', hex: '#3F3B37' },
  { label: 'Undyed Linen', hex: '#C6BAA4' },
];

export const HAT_COLORS = [
  { label: 'Tanned Leather', hex: '#7D5838' },
  { label: 'Weathered Ochre', hex: '#9A7842' },
  { label: 'Muted Crimson', hex: '#763B33' },
  { label: 'Deep Fjord', hex: '#3A4B5C' },
  { label: 'Dark Pine', hex: '#3E5039' },
  { label: 'Raw Wool', hex: '#C2B69E' },
];

export const HAIR_COLORS = [
  { label: 'Flaxen Blonde', hex: '#C2A572' },
  { label: 'Ash Brown', hex: '#5F4936' },
  { label: 'Dark Oak', hex: '#3B2C22' },
  { label: 'Copper Red', hex: '#8B4D33' },
  { label: 'Raven Black', hex: '#262320' },
  { label: 'Frost Grey', hex: '#9B9892' },
];

export const SHIRT_STYLES: Array<{ id: ShirtStyle; label: string }> = [
  { id: 'classic', label: 'Linen Tunic' },
  { id: 'striped', label: 'Woven Tunic' },
  { id: 'overalls', label: 'Leather Apron' },
  { id: 'hoodie', label: 'Fur Cloak' },
];

export const HAT_STYLES: Array<{ id: HatStyle; label: string }> = [
  { id: 'none', label: 'No Hat' },
  { id: 'cap', label: 'Explorer Cap' },
  { id: 'sunhat', label: 'Sun Hat' },
  { id: 'crown', label: 'Crown' },
  { id: 'wizard', label: 'Wizard Hat' },
  { id: 'beanie', label: 'Beanie' },
];

export const HAIR_STYLES: Array<{ id: HairStyle; label: string }> = [
  { id: 'short', label: 'Nordic Crop' },
  { id: 'braids', label: 'Braids' },
  { id: 'long', label: 'Long Flowing' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'bald', label: 'Bald' },
];

export const BEARD_STYLES: Array<{ id: BeardStyle; label: string }> = [
  { id: 'none', label: 'Clean' },
  { id: 'stubble', label: 'Stubble' },
  { id: 'short', label: 'Trimmed' },
  { id: 'braided', label: 'Braided' },
  { id: 'full', label: 'Full Viking' },
];

export interface CharacterRig {
  root: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  walkPhase: number;
  dispose: () => void;
}

const _hslTmp = { h: 0, s: 0, l: 0 };

/**
 * Gently mutes bright legacy hex colors from older saves into Valheim's desaturated Nordic palette
 * without breaking backwards compatibility with stored AvatarConfig objects.
 */
function muteToNordicColor(hex: string, kind: 'cloth' | 'skin' | 'hair'): THREE.Color {
  const col = new THREE.Color(hex || '#5A5248');
  col.getHSL(_hslTmp);
  if (kind === 'cloth') {
    const s = Math.min(_hslTmp.s, 0.38);
    const l = THREE.MathUtils.clamp(_hslTmp.l, 0.16, 0.64);
    col.setHSL(_hslTmp.h, s, l);
    col.lerp(new THREE.Color('#5A5246'), 0.12);
  } else if (kind === 'skin') {
    const s = Math.min(_hslTmp.s, 0.44);
    const l = THREE.MathUtils.clamp(_hslTmp.l, 0.2, 0.76);
    col.setHSL(_hslTmp.h, s, l);
  } else {
    const s = Math.min(_hslTmp.s, 0.42);
    const l = THREE.MathUtils.clamp(_hslTmp.l, 0.12, 0.64);
    col.setHSL(_hslTmp.h, s, l);
  }
  return col;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(14, 11, 8, 0.48)');
  grad.addColorStop(0.62, 'rgba(14, 11, 8, 0.20)');
  grad.addColorStop(1, 'rgba(14, 11, 8, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Shared procedural 32x32 woven wool/linen bump map for earthy Nordic garment grain.
 */
function createWeaveBumpTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 32, 32);

  for (let y = 0; y < 32; y += 2) {
    for (let x = 0; x < 32; x += 2) {
      const alt = ((x + y) >> 1) & 1;
      const shade = alt ? 148 : 108;
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, y, 2, 1);
      ctx.fillStyle = `rgb(${256 - shade},${256 - shade},${256 - shade})`;
      ctx.fillRect(x, y + 1, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.needsUpdate = true;
  return tex;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;
let sharedWeaveBumpTex: THREE.CanvasTexture | null = null;

function createNameTagSprite(name: string, role?: string): { sprite: THREE.Sprite; tex: THREE.CanvasTexture } {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 72;
  const ctx = c.getContext('2d')!;

  ctx.clearRect(0, 0, c.width, c.height);
  // Rustic dark timber & parchment badge
  ctx.fillStyle = 'rgba(26, 20, 15, 0.84)';
  ctx.beginPath();
  ctx.roundRect(14, 10, 228, role ? 52 : 38, 10);
  ctx.fill();

  ctx.strokeStyle = 'rgba(176, 138, 84, 0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#F3E9D6';
  ctx.font = '700 21px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, role ? 28 : 29);

  if (role) {
    ctx.fillStyle = '#C9B89C';
    ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(role, 128, 49);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.55, 0.44, 1);
  sprite.userData.isOverheadLabel = true;
  return { sprite, tex };
}

/**
 * Builds a grounded, smooth-shaded Valheim-inspired low-poly humanoid character
 * (feet grounded at y = 0, total standing height ~1.74m).
 * Used for both the 3rd-person player avatar and Elderglen NPCs.
 */
export function buildCharacterRig(
  config: AvatarConfig,
  options?: { showNameTag?: boolean; subtitle?: string; castShadow?: boolean },
): CharacterRig {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  if (!sharedShadowTex) sharedShadowTex = createContactShadowTexture();
  if (!sharedWeaveBumpTex) sharedWeaveBumpTex = createWeaveBumpTexture();

  const castShadow = options?.castShadow ?? true;
  const hairStyle: HairStyle = config.hairStyle ?? 'short';
  const beardStyle: BeardStyle = config.beardStyle ?? 'none';

  const skinColor = muteToNordicColor(config.bodyColor, 'skin');
  const tunicColor = muteToNordicColor(config.shirtColor, 'cloth');
  const pantsColor = muteToNordicColor(config.pantsColor || '#3C352E', 'cloth');
  const hatColor =
    config.hat === 'crown'
      ? new THREE.Color('#B5904C')
      : muteToNordicColor(config.hatColor || '#7D5838', 'cloth');
  const hairColor = muteToNordicColor(config.hairColor || '#5F4936', 'hair');

  const lipColor = skinColor.clone().multiplyScalar(0.74).lerp(new THREE.Color('#8A554A'), 0.35);
  const browColor = hairColor.clone().multiplyScalar(0.78);
  const darkTunicColor = tunicColor.clone().multiplyScalar(0.76);

  // Smooth-shaded PBR materials with varied roughness/metalness for Nordic fabrics, leather, fur, and iron
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.72,
      metalness: 0.02,
      flatShading: false,
    }),
  );
  const lipMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: lipColor,
      roughness: 0.65,
      metalness: 0.02,
      flatShading: false,
    }),
  );
  const shirtMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: tunicColor,
      roughness: 0.9,
      metalness: 0.01,
      bumpMap: sharedWeaveBumpTex,
      bumpScale: 0.009,
      flatShading: false,
    }),
  );
  const darkShirtMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: darkTunicColor,
      roughness: 0.92,
      metalness: 0.01,
      bumpMap: sharedWeaveBumpTex,
      bumpScale: 0.01,
      flatShading: false,
    }),
  );
  const pantsMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: pantsColor,
      roughness: 0.9,
      metalness: 0.01,
      bumpMap: sharedWeaveBumpTex,
      bumpScale: 0.008,
      flatShading: false,
    }),
  );
  const leatherMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#4B3626',
      roughness: 0.56,
      metalness: 0.07,
      flatShading: false,
    }),
  );
  const darkLeatherMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#342419',
      roughness: 0.52,
      metalness: 0.08,
      flatShading: false,
    }),
  );
  const soleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#221812',
      roughness: 0.78,
      metalness: 0.04,
      flatShading: false,
    }),
  );
  const linenTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#CFC2AA',
      roughness: 0.88,
      metalness: 0.01,
      bumpMap: sharedWeaveBumpTex,
      bumpScale: 0.008,
      flatShading: false,
    }),
  );
  const wovenAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#8B6B46',
      roughness: 0.86,
      metalness: 0.02,
      bumpMap: sharedWeaveBumpTex,
      bumpScale: 0.009,
      flatShading: false,
    }),
  );
  const furTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#6E6153',
      roughness: 0.96,
      metalness: 0.0,
      bumpMap: sharedWeaveBumpTex,
      bumpScale: 0.018,
      flatShading: false,
    }),
  );
  const ironMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#8A847A',
      roughness: 0.36,
      metalness: 0.78,
      flatShading: false,
    }),
  );
  const bronzeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#A98348',
      roughness: 0.32,
      metalness: 0.76,
      flatShading: false,
    }),
  );
  const hairMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: hairColor,
      roughness: 0.84,
      metalness: 0.03,
      flatShading: false,
    }),
  );
  const browMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: browColor,
      roughness: 0.86,
      metalness: 0.02,
      flatShading: false,
    }),
  );
  const stubbleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: hairColor.clone().lerp(skinColor, 0.42),
      roughness: 0.85,
      metalness: 0.01,
      flatShading: false,
    }),
  );
  const scleraMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#E6DFD3',
      roughness: 0.35,
      metalness: 0.0,
      flatShading: false,
    }),
  );
  const irisMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#465D67',
      roughness: 0.25,
      metalness: 0.05,
      flatShading: false,
    }),
  );
  const pupilMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#171412',
      roughness: 0.18,
      metalness: 0.08,
      flatShading: false,
    }),
  );
  const hatMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: hatColor,
      roughness: config.hat === 'crown' ? 0.3 : 0.82,
      metalness: config.hat === 'crown' ? 0.8 : 0.03,
      bumpMap: config.hat === 'crown' ? undefined : sharedWeaveBumpTex,
      bumpScale: 0.008,
      flatShading: false,
    }),
  );

  const makeMesh = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(trackGeo(geo), mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    return mesh;
  };

  // Ground contact shadow
  const shadowPlane = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.96, 0.96)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: sharedShadowTex,
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.018;
  root.add(shadowPlane);

  /* ==========================================================================
   * 1. TAPERED LEGS & FUR-CUFFED LEATHER BOOTS (Hip pivot at y = 0.76, feet at y = 0)
   * ========================================================================== */
  const buildLeg = (side: -1 | 1): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.112, 0.76, 0);

    // Rounded hip cap to keep joint seamless during walk stride
    const hipCap = makeMesh(new THREE.SphereGeometry(0.094, 12, 8), pantsMat);
    hipCap.scale.set(1.0, 1.0, 0.94);
    leg.add(hipCap);

    // Tapered thigh
    const thigh = makeMesh(new THREE.CylinderGeometry(0.096, 0.075, 0.34, 12), pantsMat);
    thigh.position.y = -0.17;
    thigh.scale.set(1.0, 1.0, 0.95);
    leg.add(thigh);

    // Smooth knee joint
    const knee = makeMesh(new THREE.SphereGeometry(0.075, 10, 8), pantsMat);
    knee.position.set(0, -0.34, 0.008);
    leg.add(knee);

    // Fur/fleece boot cuff
    const cuff = makeMesh(new THREE.CylinderGeometry(0.088, 0.08, 0.075, 12), furTrimMat);
    cuff.position.y = -0.365;
    leg.add(cuff);

    // Tapered leather boot shaft
    const calf = makeMesh(new THREE.CylinderGeometry(0.075, 0.056, 0.31, 12), leatherMat);
    calf.position.y = -0.535;
    leg.add(calf);

    // Leather ankle wrap strap
    const strap = makeMesh(new THREE.TorusGeometry(0.062, 0.011, 8, 14), darkLeatherMat);
    strap.rotation.x = Math.PI / 2;
    strap.position.y = -0.57;
    leg.add(strap);

    // Sculpted low-poly boot foot (toe extends forward +Z)
    const vamp = makeMesh(new THREE.CapsuleGeometry(0.054, 0.085, 6, 10), leatherMat);
    vamp.rotation.x = Math.PI / 2;
    vamp.scale.set(1.06, 1.08, 0.8);
    vamp.position.set(0, -0.706, 0.044);
    leg.add(vamp);

    // Flat weathered boot sole grounded exactly at y = -0.76 (world y = 0)
    const sole = makeMesh(new THREE.CylinderGeometry(0.06, 0.064, 0.032, 12), soleMat);
    sole.scale.set(1.0, 1.0, 1.66);
    sole.position.set(0, -0.744, 0.042);
    leg.add(sole);

    return leg;
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  root.add(leftLeg, rightLeg);

  /* ==========================================================================
   * 2. TAPERED NORDIC TORSO, BELT, TUNIC HEM & GARMENT VARIATIONS (y = 0.64..1.36)
   * ========================================================================== */
  const pelvis = makeMesh(new THREE.SphereGeometry(0.165, 12, 8), pantsMat);
  pelvis.scale.set(1.12, 0.72, 0.76);
  pelvis.position.y = 0.75;
  root.add(pelvis);

  // Smooth LatheGeometry torso profile: flared tunic skirt -> cinched waist -> broad chest -> tapered shoulders
  const torsoProfile = [
    new THREE.Vector2(0.001, 0.64),
    new THREE.Vector2(0.215, 0.64),
    new THREE.Vector2(0.205, 0.73),
    new THREE.Vector2(0.172, 0.84),
    new THREE.Vector2(0.184, 0.96),
    new THREE.Vector2(0.216, 1.12),
    new THREE.Vector2(0.236, 1.25),
    new THREE.Vector2(0.188, 1.32),
    new THREE.Vector2(0.105, 1.355),
    new THREE.Vector2(0.001, 1.36),
  ];
  const torsoMesh = makeMesh(new THREE.LatheGeometry(torsoProfile, 16), shirtMat);
  torsoMesh.scale.set(1.0, 1.0, 0.68);
  root.add(torsoMesh);

  // Linen neckline collar & subtle laced V-front
  const collarRing = makeMesh(new THREE.TorusGeometry(0.092, 0.018, 8, 16), linenTrimMat);
  collarRing.rotation.x = Math.PI / 2;
  collarRing.scale.set(1.04, 0.82, 1.0);
  collarRing.position.set(0, 1.345, 0.006);
  root.add(collarRing);

  const tunicHemTrim = makeMesh(new THREE.CylinderGeometry(0.212, 0.219, 0.045, 16, 1, true), linenTrimMat);
  tunicHemTrim.scale.set(1.0, 1.0, 0.69);
  tunicHemTrim.position.y = 0.662;
  root.add(tunicHemTrim);

  // Heavy leather waist belt + forged iron buckle + hip travel pouch
  const belt = makeMesh(new THREE.CylinderGeometry(0.184, 0.188, 0.072, 16), darkLeatherMat);
  belt.scale.set(1.0, 1.0, 0.7);
  belt.position.y = 0.845;
  root.add(belt);

  const buckleFrame = makeMesh(new THREE.TorusGeometry(0.028, 0.007, 6, 12), ironMat);
  buckleFrame.position.set(0, 0.845, 0.132);
  buckleFrame.scale.set(1.15, 0.95, 0.7);
  root.add(buckleFrame);

  const pouch = makeMesh(new THREE.SphereGeometry(0.048, 10, 8), leatherMat);
  pouch.scale.set(0.75, 1.12, 0.92);
  pouch.position.set(0.185, 0.775, 0.048);
  const pouchFlap = makeMesh(new THREE.SphereGeometry(0.042, 8, 6), darkLeatherMat);
  pouchFlap.scale.set(0.82, 0.56, 0.95);
  pouchFlap.position.set(0.19, 0.81, 0.052);
  const pouchStud = makeMesh(new THREE.SphereGeometry(0.008, 6, 6), bronzeMat);
  pouchStud.position.set(0.222, 0.79, 0.062);
  root.add(pouch, pouchFlap, pouchStud);

  // Garment style variations (all muted Nordic wool, linen, leather & fur)
  if (config.shirtStyle === 'classic') {
    // Diagonal weathered leather explorer baldric strap across chest
    const strapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.15, 1.32, 0.09),
      new THREE.Vector3(-0.04, 1.12, 0.15),
      new THREE.Vector3(0.09, 0.94, 0.135),
      new THREE.Vector3(0.175, 0.85, 0.04),
      new THREE.Vector3(0.06, 1.06, -0.145),
      new THREE.Vector3(-0.12, 1.29, -0.09),
    ], true);
    const baldric = makeMesh(new THREE.TubeGeometry(strapCurve, 24, 0.019, 6, true), leatherMat);
    root.add(baldric);
  } else if (config.shirtStyle === 'striped') {
    // Two hand-woven Nordic chest bands (undyed linen & muted ochre) contoured to the tapered torso
    const bandUpper = makeMesh(new THREE.CylinderGeometry(0.228, 0.214, 0.068, 16), linenTrimMat);
    bandUpper.scale.set(1.015, 1.0, 0.695);
    bandUpper.position.y = 1.165;
    const bandLower = makeMesh(new THREE.CylinderGeometry(0.205, 0.192, 0.058, 16), wovenAccentMat);
    bandLower.scale.set(1.015, 1.0, 0.695);
    bandLower.position.y = 1.02;
    root.add(bandUpper, bandLower);
  } else if (config.shirtStyle === 'overalls') {
    // Heavy stitched leather craftsman apron / jerkin with shoulder straps & bronze rivets
    const apronProfile = [
      new THREE.Vector2(0.224, 0.625),
      new THREE.Vector2(0.212, 0.74),
      new THREE.Vector2(0.184, 0.85),
      new THREE.Vector2(0.198, 1.02),
      new THREE.Vector2(0.206, 1.14),
    ];
    const apron = makeMesh(
      new THREE.LatheGeometry(apronProfile, 14, -Math.PI * 0.5, Math.PI),
      leatherMat,
    );
    apron.scale.set(1.0, 1.0, 0.7);
    root.add(apron);

    for (const side of [-1, 1] as const) {
      const strapPts = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.115, 1.12, 0.135),
        new THREE.Vector3(side * 0.135, 1.29, 0.075),
        new THREE.Vector3(side * 0.135, 1.32, -0.04),
        new THREE.Vector3(side * 0.11, 1.08, -0.145),
        new THREE.Vector3(side * 0.10, 0.86, -0.125),
      ]);
      const strap = makeMesh(new THREE.TubeGeometry(strapPts, 14, 0.022, 6, false), darkLeatherMat);
      const rivet = makeMesh(new THREE.SphereGeometry(0.012, 8, 6), bronzeMat);
      rivet.position.set(side * 0.115, 1.125, 0.146);
      root.add(strap, rivet);
    }
  } else if (config.shirtStyle === 'hoodie') {
    // Sculpted wolf/sheep fur shoulder mantle + bronze cloak clasp + draped back cloak & folded hood
    const furMantle = makeMesh(new THREE.TorusGeometry(0.195, 0.062, 10, 18), furTrimMat);
    furMantle.rotation.x = Math.PI / 2;
    furMantle.scale.set(1.22, 0.86, 0.82);
    furMantle.position.set(0, 1.295, -0.008);
    root.add(furMantle);

    // Extra fur tufts along the collar shoulders for organic Nordic silhouette
    for (const side of [-1, 1] as const) {
      const shoulderFur = makeMesh(new THREE.SphereGeometry(0.088, 10, 8), furTrimMat);
      shoulderFur.scale.set(1.15, 0.72, 1.02);
      shoulderFur.position.set(side * 0.21, 1.305, -0.01);
      root.add(shoulderFur);
    }

    // Bronze cloak brooch on upper chest
    const brooch = makeMesh(new THREE.CylinderGeometry(0.026, 0.026, 0.014, 12), bronzeMat);
    brooch.rotation.x = Math.PI / 2;
    brooch.position.set(0, 1.265, 0.142);
    root.add(brooch);

    // Draped woolen back cloak flaring gently toward lower calves
    const cloakGeo = new THREE.CylinderGeometry(0.18, 0.27, 0.78, 12, 3, true, Math.PI * 0.65, Math.PI * 0.7);
    const cloakMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: darkTunicColor,
        roughness: 0.92,
        metalness: 0.01,
        bumpMap: sharedWeaveBumpTex,
        bumpScale: 0.01,
        side: THREE.DoubleSide,
        flatShading: false,
      }),
    );
    const cloak = makeMesh(cloakGeo, cloakMat);
    cloak.scale.set(1.05, 1.0, 0.75);
    cloak.position.set(0, 0.9, -0.035);
    cloak.rotation.x = 0.08;
    root.add(cloak);

    // Soft folded woolen hood resting behind neck
    const foldedHood = makeMesh(new THREE.SphereGeometry(0.11, 12, 8), darkShirtMat);
    foldedHood.scale.set(1.28, 0.62, 0.88);
    foldedHood.position.set(0, 1.325, -0.145);
    root.add(foldedHood);
  }

  /* ==========================================================================
   * 3. TAPERED ARMS, LEATHER BRACERS & VISIBLE SCULPTED HANDS (Shoulder y = 1.26)
   * ========================================================================== */
  const buildArm = (side: -1 | 1): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.248, 1.255, 0);
    arm.rotation.z = side * -0.07;

    // Rounded deltoid shoulder cap
    const shoulder = makeMesh(new THREE.SphereGeometry(0.082, 12, 8), shirtMat);
    shoulder.scale.set(0.98, 1.05, 0.95);
    arm.add(shoulder);

    // Tapered upper arm sleeve
    const upperArm = makeMesh(new THREE.CylinderGeometry(0.072, 0.056, 0.245, 12), shirtMat);
    upperArm.position.y = -0.125;
    arm.add(upperArm);

    // Sleeve cuff trim
    const sleeveCuff = makeMesh(
      new THREE.TorusGeometry(0.058, 0.013, 8, 14),
      config.shirtStyle === 'hoodie' ? furTrimMat : linenTrimMat,
    );
    sleeveCuff.rotation.x = Math.PI / 2;
    sleeveCuff.position.y = -0.242;
    arm.add(sleeveCuff);

    // Smooth elbow joint
    const elbow = makeMesh(new THREE.SphereGeometry(0.054, 10, 8), skinMat);
    elbow.position.y = -0.255;
    arm.add(elbow);

    // Tapered forearm (skin)
    const forearm = makeMesh(new THREE.CylinderGeometry(0.054, 0.041, 0.23, 12), skinMat);
    forearm.position.y = -0.365;
    arm.add(forearm);

    // Laced leather wrist bracer
    const bracer = makeMesh(new THREE.CylinderGeometry(0.056, 0.046, 0.145, 12), darkLeatherMat);
    bracer.position.y = -0.375;
    arm.add(bracer);

    const bracerRim = makeMesh(new THREE.TorusGeometry(0.047, 0.007, 6, 12), bronzeMat);
    bracerRim.rotation.x = Math.PI / 2;
    bracerRim.position.y = -0.442;
    arm.add(bracerRim);

    // Visible sculpted hand: rounded palm + contoured fingers + distinct thumb
    const wrist = makeMesh(new THREE.SphereGeometry(0.037, 10, 8), skinMat);
    wrist.position.y = -0.482;
    arm.add(wrist);

    const palm = makeMesh(new THREE.SphereGeometry(0.044, 10, 8), skinMat);
    palm.scale.set(0.72, 1.08, 1.04);
    palm.position.set(0, -0.515, 0.008);
    arm.add(palm);

    const fingers = makeMesh(new THREE.CapsuleGeometry(0.025, 0.036, 5, 8), skinMat);
    fingers.scale.set(0.84, 1.0, 1.18);
    fingers.position.set(side * -0.004, -0.562, 0.018);
    fingers.rotation.x = -0.18;
    arm.add(fingers);

    const thumb = makeMesh(new THREE.CapsuleGeometry(0.013, 0.026, 4, 8), skinMat);
    thumb.position.set(side * -0.024, -0.525, 0.038);
    thumb.rotation.set(0.45, 0, side * 0.28);
    arm.add(thumb);

    return arm;
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  root.add(leftArm, rightArm);

  /* ==========================================================================
   * 4. NECK & NATURALLY SHAPED HEAD WITH SCULPTED FACE (Pivot y = 1.35)
   * ========================================================================== */
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.35, 0);

  // Smooth tapered neck
  const neck = makeMesh(new THREE.CylinderGeometry(0.062, 0.076, 0.13, 12), skinMat);
  neck.position.set(0, 0.045, -0.004);
  headGroup.add(neck);

  // Sculpted oval cranium (head top ~ 1.35 + 0.39 = 1.74m)
  const cranium = makeMesh(new THREE.SphereGeometry(0.156, 18, 14), skinMat);
  cranium.scale.set(0.91, 1.06, 0.99);
  cranium.position.set(0, 0.228, 0);
  headGroup.add(cranium);

  // Smoothly tapered jaw & chin for humanoid face silhouette
  const jaw = makeMesh(new THREE.SphereGeometry(0.114, 14, 10), skinMat);
  jaw.scale.set(0.84, 0.82, 0.92);
  jaw.position.set(0, 0.14, 0.024);
  headGroup.add(jaw);

  // Sculpted ears
  for (const side of [-1, 1] as const) {
    const ear = makeMesh(new THREE.SphereGeometry(0.031, 10, 8), skinMat);
    ear.scale.set(0.42, 1.12, 0.78);
    ear.position.set(side * 0.141, 0.205, -0.008);
    ear.rotation.y = side * -0.22;
    headGroup.add(ear);
  }

  // Sculpted nose bridge & rounded tip
  const noseBridge = makeMesh(new THREE.ConeGeometry(0.024, 0.062, 10), skinMat);
  noseBridge.scale.set(0.82, 1.0, 1.05);
  noseBridge.rotation.x = 0.22;
  noseBridge.position.set(0, 0.202, 0.152);
  const noseTip = makeMesh(new THREE.SphereGeometry(0.018, 8, 8), skinMat);
  noseTip.scale.set(1.05, 0.85, 0.95);
  noseTip.position.set(0, 0.18, 0.163);
  headGroup.add(noseBridge, noseTip);

  // Expressive eyes (sclera + muted iris + pupil + brow ridge)
  for (const side of [-1, 1] as const) {
    const sclera = makeMesh(new THREE.SphereGeometry(0.023, 10, 8), scleraMat);
    sclera.scale.set(1.18, 0.76, 0.42);
    sclera.position.set(side * 0.052, 0.224, 0.138);

    const iris = makeMesh(new THREE.SphereGeometry(0.014, 10, 8), irisMat);
    iris.scale.set(1.0, 1.0, 0.42);
    iris.position.set(side * 0.052, 0.224, 0.146);

    const pupil = makeMesh(new THREE.SphereGeometry(0.008, 8, 6), pupilMat);
    pupil.scale.set(1.0, 1.0, 0.45);
    pupil.position.set(side * 0.052, 0.224, 0.15);

    const brow = makeMesh(new THREE.CapsuleGeometry(0.0085, 0.036, 4, 8), browMat);
    brow.rotation.z = Math.PI / 2 + side * -0.1;
    brow.position.set(side * 0.052, 0.252, 0.14);

    headGroup.add(sclera, iris, pupil, brow);
  }

  // Soft natural mouth
  const mouth = makeMesh(new THREE.CapsuleGeometry(0.007, 0.036, 4, 8), lipMat);
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, 0.134, 0.132);
  headGroup.add(mouth);

  /* ==========================================================================
   * 5. SCULPTED HAIR STYLES (Trimmed subtly at crown when wearing full hats)
   * ========================================================================== */
  const wearingClosedHat =
    config.hat === 'cap' ||
    config.hat === 'sunhat' ||
    config.hat === 'wizard' ||
    config.hat === 'beanie';

  if (hairStyle !== 'bald') {
    // Base sculpted scalp hair covering upper & back head
    const capYScale = wearingClosedHat ? 0.94 : 1.07;
    const hairCap = makeMesh(
      new THREE.SphereGeometry(0.163, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hairMat,
    );
    hairCap.scale.set(0.95, capYScale, 1.02);
    hairCap.position.set(0, wearingClosedHat ? 0.222 : 0.236, -0.006);
    hairCap.rotation.x = -0.18;
    headGroup.add(hairCap);

    // Sideburns & temple locks
    for (const side of [-1, 1] as const) {
      const temple = makeMesh(new THREE.CapsuleGeometry(0.028, 0.075, 5, 8), hairMat);
      temple.position.set(side * 0.132, 0.22, 0.038);
      temple.rotation.z = side * 0.12;
      headGroup.add(temple);
    }

    if (hairStyle === 'short') {
      // Swept Nordic fringe + textured back nape hair
      const fringe = makeMesh(new THREE.SphereGeometry(0.088, 12, 8), hairMat);
      fringe.scale.set(1.5, 0.56, 0.85);
      fringe.position.set(0.012, wearingClosedHat ? 0.295 : 0.312, 0.092);
      fringe.rotation.z = -0.12;

      const nape = makeMesh(new THREE.SphereGeometry(0.128, 12, 8), hairMat);
      nape.scale.set(1.04, 0.92, 0.72);
      nape.position.set(0, 0.17, -0.095);
      headGroup.add(fringe, nape);
    } else if (hairStyle === 'braids') {
      // Center-parted bangs + twin sculpted Viking shoulder braids with bronze ties
      for (const side of [-1, 1] as const) {
        const partLock = makeMesh(new THREE.CapsuleGeometry(0.036, 0.07, 5, 8), hairMat);
        partLock.position.set(side * 0.078, 0.292, 0.092);
        partLock.rotation.set(0.2, 0, side * 0.52);
        headGroup.add(partLock);

        // 4 overlapping tapered braid links draping past shoulders
        const linkOffsets: Array<[number, number, number, number]> = [
          [0.146, 0.18, -0.035, 0.036],
          [0.155, 0.115, -0.015, 0.032],
          [0.152, 0.055, 0.012, 0.027],
          [0.144, 0.0, 0.032, 0.022],
        ];
        for (const [bx, by, bz, r] of linkOffsets) {
          const link = makeMesh(new THREE.SphereGeometry(r, 8, 8), hairMat);
          link.scale.set(0.95, 1.32, 0.95);
          link.position.set(side * bx, by, bz);
          headGroup.add(link);
        }
        const tie = makeMesh(new THREE.TorusGeometry(0.021, 0.006, 6, 10), bronzeMat);
        tie.rotation.x = Math.PI / 2;
        tie.position.set(side * 0.146, 0.022, 0.025);
        const tip = makeMesh(new THREE.ConeGeometry(0.018, 0.05, 8), hairMat);
        tip.rotation.x = Math.PI;
        tip.position.set(side * 0.142, -0.035, 0.036);
        headGroup.add(tie, tip);
      }

      const backHair = makeMesh(new THREE.SphereGeometry(0.134, 12, 8), hairMat);
      backHair.scale.set(1.04, 0.95, 0.72);
      backHair.position.set(0, 0.18, -0.095);
      headGroup.add(backHair);
    } else if (hairStyle === 'long') {
      // Flowing shoulder-length Nordic hair framing cheeks & draping across upper back
      const backCurtain = makeMesh(new THREE.CylinderGeometry(0.135, 0.165, 0.29, 14), hairMat);
      backCurtain.scale.set(1.06, 1.0, 0.56);
      backCurtain.position.set(0, 0.115, -0.095);
      backCurtain.rotation.x = 0.14;
      headGroup.add(backCurtain);

      for (const side of [-1, 1] as const) {
        const sideFlow = makeMesh(new THREE.CapsuleGeometry(0.044, 0.19, 6, 10), hairMat);
        sideFlow.position.set(side * 0.138, 0.135, -0.005);
        sideFlow.rotation.set(0.08, 0, side * -0.14);
        headGroup.add(sideFlow);
      }
    } else if (hairStyle === 'ponytail') {
      // Swept-back crown + leather tie + curved tapered ponytail
      const band = makeMesh(new THREE.TorusGeometry(0.038, 0.011, 8, 12), leatherMat);
      band.position.set(0, 0.215, -0.162);
      band.rotation.x = 0.25;
      headGroup.add(band);

      const tailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.215, -0.165),
        new THREE.Vector3(0, 0.175, -0.22),
        new THREE.Vector3(0, 0.095, -0.235),
        new THREE.Vector3(0, 0.005, -0.215),
      ]);
      const tailMain = makeMesh(new THREE.TubeGeometry(tailCurve, 12, 0.034, 8, false), hairMat);
      const tailTip = makeMesh(new THREE.ConeGeometry(0.032, 0.09, 8), hairMat);
      tailTip.rotation.x = Math.PI - 0.18;
      tailTip.position.set(0, -0.03, -0.205);
      headGroup.add(tailMain, tailTip);
    }
  }

  /* ==========================================================================
   * 6. SCULPTED NORDIC BEARD STYLES
   * ========================================================================== */
  if (beardStyle === 'stubble') {
    const stubble = makeMesh(new THREE.SphereGeometry(0.116, 14, 10), stubbleMat);
    stubble.scale.set(0.86, 0.72, 0.94);
    stubble.position.set(0, 0.13, 0.028);
    headGroup.add(stubble);
  } else if (beardStyle === 'short') {
    // Trimmed Nordic jaw beard + mustache
    const chinBeard = makeMesh(new THREE.SphereGeometry(0.116, 14, 10), hairMat);
    chinBeard.scale.set(0.92, 0.78, 0.94);
    chinBeard.position.set(0, 0.112, 0.034);
    const chinTip = makeMesh(new THREE.ConeGeometry(0.068, 0.08, 10), hairMat);
    chinTip.rotation.x = Math.PI;
    chinTip.scale.set(1.15, 1.0, 0.78);
    chinTip.position.set(0, 0.048, 0.088);
    headGroup.add(chinBeard, chinTip);

    for (const side of [-1, 1] as const) {
      const stache = makeMesh(new THREE.CapsuleGeometry(0.015, 0.034, 4, 8), hairMat);
      stache.rotation.z = Math.PI / 2 + side * -0.34;
      stache.position.set(side * 0.028, 0.148, 0.142);
      headGroup.add(stache);
    }
  } else if (beardStyle === 'braided') {
    // Broad Viking jaw beard + twin bound chin braids with bronze clasps
    const jawBase = makeMesh(new THREE.SphereGeometry(0.118, 14, 10), hairMat);
    jawBase.scale.set(0.95, 0.82, 0.94);
    jawBase.position.set(0, 0.112, 0.036);
    headGroup.add(jawBase);

    for (const side of [-1, 1] as const) {
      const stache = makeMesh(new THREE.CapsuleGeometry(0.018, 0.042, 4, 8), hairMat);
      stache.rotation.z = Math.PI / 2 + side * -0.4;
      stache.position.set(side * 0.032, 0.148, 0.144);
      headGroup.add(stache);

      const braid1 = makeMesh(new THREE.SphereGeometry(0.03, 8, 8), hairMat);
      braid1.scale.set(0.9, 1.35, 0.9);
      braid1.position.set(side * 0.036, 0.048, 0.108);

      const braid2 = makeMesh(new THREE.SphereGeometry(0.024, 8, 8), hairMat);
      braid2.scale.set(0.9, 1.35, 0.9);
      braid2.position.set(side * 0.042, -0.008, 0.114);

      const ring = makeMesh(new THREE.TorusGeometry(0.022, 0.006, 6, 10), bronzeMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(side * 0.042, -0.032, 0.116);

      const tassel = makeMesh(new THREE.ConeGeometry(0.02, 0.045, 8), hairMat);
      tassel.rotation.x = Math.PI;
      tassel.position.set(side * 0.042, -0.062, 0.116);

      headGroup.add(braid1, braid2, ring, tassel);
    }
  } else if (beardStyle === 'full') {
    // Lush full Valheim warrior beard covering chin & chest collar + bushy mustache
    const beardUpper = makeMesh(new THREE.SphereGeometry(0.122, 14, 10), hairMat);
    beardUpper.scale.set(0.98, 0.88, 0.96);
    beardUpper.position.set(0, 0.11, 0.038);

    const beardBody = makeMesh(new THREE.ConeGeometry(0.095, 0.18, 12), hairMat);
    beardBody.rotation.x = Math.PI + 0.08;
    beardBody.scale.set(1.12, 1.0, 0.72);
    beardBody.position.set(0, 0.015, 0.096);

    headGroup.add(beardUpper, beardBody);

    for (const side of [-1, 1] as const) {
      const stache = makeMesh(new THREE.CapsuleGeometry(0.02, 0.048, 5, 8), hairMat);
      stache.rotation.z = Math.PI / 2 + side * -0.44;
      stache.position.set(side * 0.036, 0.148, 0.146);
      headGroup.add(stache);
    }
  }

  /* ==========================================================================
   * 7. RESTYLED HATS (Proportioned & smooth-shaded for the sculpted humanoid head)
   * ========================================================================== */
  if (config.hat === 'cap') {
    // Restyled Nordic Explorer Cap: smooth stitched dome + curved forward visor + leather band + brass stud
    const dome = makeMesh(
      new THREE.SphereGeometry(0.168, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hatMat,
    );
    dome.scale.set(0.96, 0.88, 1.03);
    dome.position.set(0, 0.258, -0.002);
    dome.rotation.x = -0.1;

    const band = makeMesh(new THREE.TorusGeometry(0.158, 0.014, 8, 18), darkLeatherMat);
    band.rotation.x = Math.PI / 2 - 0.1;
    band.scale.set(0.96, 1.03, 1.0);
    band.position.set(0, 0.272, 0.002);

    // Curved explorer visor brim projecting forward (+Z)
    const brim = makeMesh(
      new THREE.CylinderGeometry(0.162, 0.172, 0.018, 14, 1, false, -Math.PI * 0.36, Math.PI * 0.72),
      hatMat,
    );
    brim.scale.set(1.0, 1.0, 1.28);
    brim.position.set(0, 0.268, 0.068);
    brim.rotation.x = 0.08;

    const stud = makeMesh(new THREE.SphereGeometry(0.016, 8, 6), bronzeMat);
    stud.scale.set(1.0, 0.55, 1.0);
    stud.position.set(0, 0.405, -0.012);

    headGroup.add(dome, band, brim, stud);
  } else if (config.hat === 'sunhat') {
    // Wide gently drooping woven traveler hat + linen ribbon band
    const brimProfile = [
      new THREE.Vector2(0.145, 0.295),
      new THREE.Vector2(0.245, 0.285),
      new THREE.Vector2(0.33, 0.258),
      new THREE.Vector2(0.335, 0.268),
      new THREE.Vector2(0.245, 0.296),
      new THREE.Vector2(0.152, 0.312),
    ];
    const brim = makeMesh(new THREE.LatheGeometry(brimProfile, 22), hatMat);
    brim.scale.set(0.98, 1.0, 1.04);

    const crown = makeMesh(new THREE.CylinderGeometry(0.132, 0.156, 0.13, 18), hatMat);
    crown.scale.set(0.96, 1.0, 1.02);
    crown.position.y = 0.365;

    const crownTop = makeMesh(new THREE.SphereGeometry(0.132, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hatMat);
    crownTop.scale.set(0.96, 0.42, 1.02);
    crownTop.position.y = 0.426;

    const ribbon = makeMesh(new THREE.CylinderGeometry(0.154, 0.159, 0.032, 18), shirtMat);
    ribbon.scale.set(0.97, 1.0, 1.03);
    ribbon.position.y = 0.318;

    headGroup.add(brim, crown, crownTop, ribbon);
  } else if (config.hat === 'crown') {
    // Forged weathered-gold Nordic circlet crown with tapered peaks & hammered studs
    const bandProfile = [
      new THREE.Vector2(0.156, 0.298),
      new THREE.Vector2(0.168, 0.298),
      new THREE.Vector2(0.17, 0.348),
      new THREE.Vector2(0.158, 0.348),
      new THREE.Vector2(0.156, 0.298),
    ];
    const band = makeMesh(new THREE.LatheGeometry(bandProfile, 20), hatMat);
    band.scale.set(0.95, 1.0, 1.02);
    headGroup.add(band);

    const peakCount = 7;
    for (let i = 0; i < peakCount; i++) {
      const angle = (i / peakCount) * Math.PI * 2;
      const isFront = Math.cos(angle) > 0.7;
      const height = isFront ? 0.088 : 0.062;
      const peak = makeMesh(new THREE.ConeGeometry(0.024, height, 6), hatMat);
      peak.position.set(
        Math.sin(angle) * 0.156,
        0.345 + height * 0.48,
        Math.cos(angle) * 0.166,
      );
      peak.rotation.z = -Math.sin(angle) * 0.14;
      peak.rotation.x = Math.cos(angle) * 0.14;
      headGroup.add(peak);
    }
  } else if (config.hat === 'wizard') {
    // Tall softly bent Nordic rune-weaver hat + wide sculpted brim + leather cord
    const brimProfile = [
      new THREE.Vector2(0.14, 0.295),
      new THREE.Vector2(0.24, 0.288),
      new THREE.Vector2(0.325, 0.268),
      new THREE.Vector2(0.328, 0.278),
      new THREE.Vector2(0.24, 0.302),
      new THREE.Vector2(0.148, 0.315),
    ];
    const brim = makeMesh(new THREE.LatheGeometry(brimProfile, 22), hatMat);
    brim.scale.set(0.98, 1.0, 1.05);
    brim.rotation.x = -0.06;

    const lowerCone = makeMesh(new THREE.ConeGeometry(0.165, 0.32, 16), hatMat);
    lowerCone.position.set(0, 0.455, -0.015);
    lowerCone.rotation.x = -0.14;

    const bentTip = makeMesh(new THREE.ConeGeometry(0.072, 0.22, 12), hatMat);
    bentTip.position.set(0.025, 0.625, -0.075);
    bentTip.rotation.set(-0.48, 0, -0.22);

    const cord = makeMesh(new THREE.TorusGeometry(0.156, 0.014, 8, 18), darkLeatherMat);
    cord.rotation.x = Math.PI / 2 - 0.06;
    cord.position.set(0, 0.318, -0.002);

    const buckle = makeMesh(new THREE.BoxGeometry(0.036, 0.034, 0.014), bronzeMat);
    buckle.position.set(0, 0.32, 0.156);

    headGroup.add(brim, lowerCone, bentTip, cord, buckle);
  } else if (config.hat === 'beanie') {
    // Soft knit Nordic wool cap with folded cuff & top wool knot
    const cuff = makeMesh(new THREE.TorusGeometry(0.156, 0.028, 10, 18), linenTrimMat);
    cuff.rotation.x = Math.PI / 2 - 0.12;
    cuff.scale.set(0.97, 1.04, 1.15);
    cuff.position.set(0, 0.285, -0.005);

    const dome = makeMesh(
      new THREE.SphereGeometry(0.166, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hatMat,
    );
    dome.scale.set(0.96, 1.16, 1.04);
    dome.position.set(0, 0.282, -0.012);
    dome.rotation.x = -0.16;

    const knot = makeMesh(new THREE.SphereGeometry(0.034, 10, 8), linenTrimMat);
    knot.position.set(0, 0.478, -0.044);

    headGroup.add(cuff, dome, knot);
  }

  root.add(headGroup);

  if (options?.showNameTag && config.displayName.trim()) {
    const { sprite, tex } = createNameTagSprite(config.displayName.trim(), options.subtitle);
    textures.push(tex);
    materials.push(sprite.material);
    sprite.position.set(0, 2.28, 0);
    root.add(sprite);
  }

  return {
    root,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    walkPhase: 0,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

export function animateCharacterRig(
  rig: CharacterRig,
  horizontalSpeed: number,
  isAirborne: boolean,
  dt: number,
): void {
  const moving = horizontalSpeed > 0.15;
  if (moving) {
    rig.walkPhase += dt * Math.min(12, 4 + horizontalSpeed * 1.4);
  }
  const swingTarget = moving ? Math.sin(rig.walkPhase) * 0.58 : 0;
  const damp = 1 - Math.exp(-14 * dt);

  if (isAirborne) {
    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, 0.34, damp);
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, -0.24, damp);
    rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, -0.48, damp);
    rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, -0.48, damp);
  } else {
    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, swingTarget, damp);
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, -swingTarget, damp);
    rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, -swingTarget * 0.78, damp);
    rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, swingTarget * 0.78, damp);
  }
}
