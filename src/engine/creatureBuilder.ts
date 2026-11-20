import * as THREE from 'three';
import { CreatureSpecies, GearRarity } from '../types/blockhaven';

export interface CreatureRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  limbs: THREE.Object3D[];
  hitFlashMaterials: THREE.MeshStandardMaterial[];
  phase: number;
  dispose: () => void;
}

export interface PropRig {
  root: THREE.Group;
  spinTarget?: THREE.Object3D;
  dispose: () => void;
}

function createShadowTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
  grad.addColorStop(0.65, 'rgba(15, 23, 42, 0.16)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;

function createLabelSprite(title: string, subtitle?: string, accent = '#FFFFFF'): { sprite: THREE.Sprite; tex: THREE.CanvasTexture } {
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 76;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  ctx.beginPath();
  ctx.roundRect(10, 8, 280, subtitle ? 58 : 42, 12);
  ctx.fill();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 21px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 150, subtitle ? 28 : 29);

  if (subtitle) {
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(subtitle, 150, 50);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.75, 0.45, 1);
  sprite.userData.isOverheadLabel = true;
  return { sprite, tex };
}

/**
 * Builds composite multi-part procedural 3D wildlife, monsters, and dungeon bosses.
 * Every rig is pivoted at bottom-center (feet at y = 0) with a soft contact shadow.
 */
export function buildCreatureRig(
  species: CreatureSpecies,
  label: string,
  level: number,
  options?: { castShadow?: boolean; accentColor?: string },
): CreatureRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const hitFlashMaterials: THREE.MeshStandardMaterial[] = [];
  const limbs: THREE.Object3D[] = [];
  const castShadow = options?.castShadow ?? true;

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const makeMat = (
    color: string,
    roughness = 0.78,
    metalness = 0.04,
    extra?: Partial<THREE.MeshStandardMaterialParameters>,
  ) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    materials.push(m);
    hitFlashMaterials.push(m);
    return m;
  };
  const makeBox = (w: number, h: number, d: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    return m;
  };

  if (!sharedShadowTex) sharedShadowTex = createShadowTex();
  const shadowSize = species === 'boss' ? 1.8 : species === 'rabbit' ? 0.55 : 1.0;
  const shadowPlane = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(shadowSize, shadowSize)),
    new THREE.MeshBasicMaterial({ map: sharedShadowTex, transparent: true, depthWrite: false }),
  );
  materials.push(shadowPlane.material as THREE.Material);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  let labelY = 1.45;
  let tagAccent = '#38BDF8';

  if (species === 'deer') {
    tagAccent = '#34D399';
    const coat = makeMat('#B5804D', 0.86);
    const belly = makeMat('#E9D5B8', 0.88);
    const antler = makeMat('#E2D2B5', 0.62);
    const eye = makeMat('#0F172A', 0.2);

    const torso = makeBox(0.42, 0.36, 0.78, coat);
    torso.position.set(0, 0.66, 0);
    const neck = makeBox(0.2, 0.32, 0.2, coat);
    neck.position.set(0, 0.9, 0.32);
    neck.rotation.x = 0.22;
    const head = makeBox(0.24, 0.22, 0.34, coat);
    head.position.set(0, 1.06, 0.44);
    const tail = makeBox(0.12, 0.14, 0.12, belly);
    tail.position.set(0, 0.76, -0.44);
    const antL = makeBox(0.05, 0.26, 0.05, antler);
    antL.position.set(-0.1, 1.26, 0.38);
    antL.rotation.z = 0.35;
    const antR = makeBox(0.05, 0.26, 0.05, antler);
    antR.position.set(0.1, 1.26, 0.38);
    antR.rotation.z = -0.35;
    const eyeL = makeBox(0.04, 0.04, 0.04, eye);
    eyeL.position.set(-0.12, 1.08, 0.5);
    const eyeR = makeBox(0.04, 0.04, 0.04, eye);
    eyeR.position.set(0.12, 1.08, 0.5);
    bodyGroup.add(torso, neck, head, tail, antL, antR, eyeL, eyeR);

    for (const [lx, lz] of [[-0.14, 0.28], [0.14, 0.28], [-0.14, -0.28], [0.14, -0.28]]) {
      const leg = makeBox(0.1, 0.52, 0.1, coat);
      leg.position.set(lx, 0.26, lz);
      bodyGroup.add(leg);
      limbs.push(leg);
    }
    labelY = 1.6;
  } else if (species === 'rabbit') {
    tagAccent = '#A7F3D0';
    const fur = makeMat('#F1ECE4', 0.9);
    const earInner = makeMat('#F9A8D4', 0.85);
    const eye = makeMat('#1E293B', 0.2);

    const torso = makeBox(0.28, 0.22, 0.36, fur);
    torso.position.set(0, 0.2, 0);
    const head = makeBox(0.22, 0.2, 0.22, fur);
    head.position.set(0, 0.32, 0.2);
    const earL = makeBox(0.06, 0.22, 0.06, fur);
    earL.position.set(-0.07, 0.5, 0.16);
    const earR = makeBox(0.06, 0.22, 0.06, fur);
    earR.position.set(0.07, 0.5, 0.16);
    const nose = makeBox(0.05, 0.04, 0.04, earInner);
    nose.position.set(0, 0.3, 0.32);
    const tail = makeBox(0.11, 0.11, 0.11, fur);
    tail.position.set(0, 0.2, -0.22);
    const eyeL = makeBox(0.035, 0.04, 0.03, eye);
    eyeL.position.set(-0.1, 0.34, 0.27);
    const eyeR = makeBox(0.035, 0.04, 0.03, eye);
    eyeR.position.set(0.1, 0.34, 0.27);
    bodyGroup.add(torso, head, earL, earR, nose, tail, eyeL, eyeR);
    labelY = 0.95;
  } else if (species === 'boar') {
    tagAccent = '#FBBF24';
    const hide = makeMat('#6B4A38', 0.88);
    const mane = makeMat('#3E2B22', 0.92);
    const tusk = makeMat('#F8FAFC', 0.35);

    const torso = makeBox(0.48, 0.38, 0.66, hide);
    torso.position.set(0, 0.44, 0);
    const crest = makeBox(0.12, 0.12, 0.54, mane);
    crest.position.set(0, 0.66, 0.02);
    const head = makeBox(0.36, 0.3, 0.3, hide);
    head.position.set(0, 0.46, 0.44);
    const snout = makeBox(0.22, 0.14, 0.14, mane);
    snout.position.set(0, 0.4, 0.6);
    const tuskL = makeBox(0.05, 0.14, 0.05, tusk);
    tuskL.position.set(-0.14, 0.44, 0.6);
    tuskL.rotation.x = 0.4;
    const tuskR = makeBox(0.05, 0.14, 0.05, tusk);
    tuskR.position.set(0.14, 0.44, 0.6);
    tuskR.rotation.x = 0.4;
    bodyGroup.add(torso, crest, head, snout, tuskL, tuskR);

    for (const [lx, lz] of [[-0.16, 0.22], [0.16, 0.22], [-0.16, -0.22], [0.16, -0.22]]) {
      const leg = makeBox(0.12, 0.28, 0.12, mane);
      leg.position.set(lx, 0.14, lz);
      bodyGroup.add(leg);
      limbs.push(leg);
    }
    labelY = 1.15;
  } else if (species === 'wolf') {
    tagAccent = '#F87171';
    const fur = makeMat(options?.accentColor ?? '#64748B', 0.85);
    const chest = makeMat('#CBD5E1', 0.88);
    const eye = makeMat('#F59E0B', 0.25, 0.1, { emissive: '#D97706', emissiveIntensity: 0.6 });

    const torso = makeBox(0.38, 0.32, 0.72, fur);
    torso.position.set(0, 0.5, 0);
    const ruff = makeBox(0.42, 0.34, 0.26, chest);
    ruff.position.set(0, 0.52, 0.24);
    const head = makeBox(0.28, 0.26, 0.3, fur);
    head.position.set(0, 0.62, 0.46);
    const snout = makeBox(0.16, 0.12, 0.18, chest);
    snout.position.set(0, 0.57, 0.66);
    const earL = makeBox(0.08, 0.12, 0.06, fur);
    earL.position.set(-0.1, 0.79, 0.42);
    const earR = makeBox(0.08, 0.12, 0.06, fur);
    earR.position.set(0.1, 0.79, 0.42);
    const tail = makeBox(0.1, 0.1, 0.38, fur);
    tail.position.set(0, 0.54, -0.5);
    tail.rotation.x = -0.35;
    const eyeL = makeBox(0.05, 0.04, 0.03, eye);
    eyeL.position.set(-0.08, 0.65, 0.61);
    const eyeR = makeBox(0.05, 0.04, 0.03, eye);
    eyeR.position.set(0.08, 0.65, 0.61);
    bodyGroup.add(torso, ruff, head, snout, earL, earR, tail, eyeL, eyeR);

    for (const [lx, lz] of [[-0.13, 0.24], [0.13, 0.24], [-0.13, -0.24], [0.13, -0.24]]) {
      const leg = makeBox(0.1, 0.36, 0.1, fur);
      leg.position.set(lx, 0.18, lz);
      bodyGroup.add(leg);
      limbs.push(leg);
    }
    labelY = 1.25;
  } else if (species === 'slime') {
    tagAccent = '#4ADE80';
    const gel = makeMat(options?.accentColor ?? '#22C55E', 0.25, 0.05, {
      transparent: true,
      opacity: 0.82,
    });
    const core = makeMat('#14532D', 0.4);
    const eye = makeMat('#0F172A', 0.15);

    const outer = makeBox(0.68, 0.56, 0.68, gel);
    outer.position.set(0, 0.28, 0);
    const inner = makeBox(0.36, 0.28, 0.36, core);
    inner.position.set(0, 0.26, 0);
    const eyeL = makeBox(0.08, 0.09, 0.06, eye);
    eyeL.position.set(-0.14, 0.34, 0.33);
    const eyeR = makeBox(0.08, 0.09, 0.06, eye);
    eyeR.position.set(0.14, 0.34, 0.33);
    bodyGroup.add(outer, inner, eyeL, eyeR);
    labelY = 1.05;
  } else if (species === 'skeleton') {
    tagAccent = '#F87171';
    const bone = makeMat('#E2E8F0', 0.68);
    const dark = makeMat('#1E293B', 0.3);
    const steel = makeMat('#94A3B8', 0.3, 0.8);

    const skull = makeBox(0.38, 0.36, 0.38, bone);
    skull.position.set(0, 1.32, 0);
    const eyeL = makeBox(0.08, 0.07, 0.04, dark);
    eyeL.position.set(-0.09, 1.34, 0.19);
    const eyeR = makeBox(0.08, 0.07, 0.04, dark);
    eyeR.position.set(0.09, 1.34, 0.19);
    const spine = makeBox(0.12, 0.52, 0.12, bone);
    spine.position.set(0, 0.86, 0);
    const ribs1 = makeBox(0.38, 0.08, 0.22, bone);
    ribs1.position.set(0, 1.0, 0);
    const ribs2 = makeBox(0.34, 0.08, 0.2, bone);
    ribs2.position.set(0, 0.84, 0);
    const armL = makeBox(0.1, 0.48, 0.1, bone);
    armL.position.set(-0.27, 0.88, 0.1);
    armL.rotation.x = -0.6;
    const armR = makeBox(0.1, 0.48, 0.1, bone);
    armR.position.set(0.27, 0.88, 0.1);
    armR.rotation.x = -0.6;
    const sword = makeBox(0.06, 0.48, 0.08, steel);
    sword.position.set(0.27, 0.92, 0.38);
    sword.rotation.x = 0.7;
    const legL = makeBox(0.11, 0.56, 0.11, bone);
    legL.position.set(-0.12, 0.28, 0);
    const legR = makeBox(0.11, 0.56, 0.11, bone);
    legR.position.set(0.12, 0.28, 0);
    bodyGroup.add(skull, eyeL, eyeR, spine, ribs1, ribs2, armL, armR, sword, legL, legR);
    limbs.push(legL, legR);
    labelY = 1.92;
  } else if (species === 'goblin') {
    tagAccent = '#FB923C';
    const skin = makeMat('#4D9B45', 0.82);
    const tunic = makeMat('#7C4A2A', 0.9);
    const eye = makeMat('#FACC15', 0.25, 0.1, { emissive: '#CA8A04', emissiveIntensity: 0.45 });
    const club = makeMat('#5B3A1E', 0.88);

    const torso = makeBox(0.38, 0.4, 0.24, tunic);
    torso.position.set(0, 0.54, 0);
    const head = makeBox(0.36, 0.32, 0.34, skin);
    head.position.set(0, 0.92, 0);
    const earL = makeBox(0.2, 0.08, 0.06, skin);
    earL.position.set(-0.24, 0.94, 0);
    earL.rotation.z = 0.25;
    const earR = makeBox(0.2, 0.08, 0.06, skin);
    earR.position.set(0.24, 0.94, 0);
    earR.rotation.z = -0.25;
    const eyeL = makeBox(0.07, 0.06, 0.03, eye);
    eyeL.position.set(-0.08, 0.95, 0.17);
    const eyeR = makeBox(0.07, 0.06, 0.03, eye);
    eyeR.position.set(0.08, 0.95, 0.17);
    const armL = makeBox(0.12, 0.34, 0.12, skin);
    armL.position.set(-0.26, 0.56, 0);
    const armR = makeBox(0.12, 0.34, 0.12, skin);
    armR.position.set(0.26, 0.56, 0.08);
    armR.rotation.x = -0.5;
    const clubMesh = makeBox(0.11, 0.42, 0.11, club);
    clubMesh.position.set(0.26, 0.62, 0.32);
    clubMesh.rotation.x = 0.6;
    const legL = makeBox(0.13, 0.34, 0.14, tunic);
    legL.position.set(-0.11, 0.17, 0);
    const legR = makeBox(0.13, 0.34, 0.14, tunic);
    legR.position.set(0.11, 0.17, 0);
    bodyGroup.add(torso, head, earL, earR, eyeL, eyeR, armL, armR, clubMesh, legL, legR);
    limbs.push(legL, legR);
    labelY = 1.5;
  } else {
    // Dungeon Boss (imposing armored composite multi-part figure)
    tagAccent = '#F43F5E';
    const armor = makeMat(options?.accentColor ?? '#312E81', 0.35, 0.72);
    const trim = makeMat('#F59E0B', 0.28, 0.85);
    const glow = makeMat('#F43F5E', 0.2, 0.2, { emissive: '#FB7185', emissiveIntensity: 1.1 });

    const torso = makeBox(0.86, 0.92, 0.48, armor);
    torso.position.set(0, 1.24, 0);
    const chestTrim = makeBox(0.54, 0.36, 0.52, trim);
    chestTrim.position.set(0, 1.32, 0);
    const head = makeBox(0.56, 0.54, 0.56, armor);
    head.position.set(0, 2.0, 0);
    const visor = makeBox(0.42, 0.12, 0.08, glow);
    visor.position.set(0, 2.02, 0.28);
    const hornL = makeBox(0.12, 0.38, 0.12, trim);
    hornL.position.set(-0.28, 2.38, 0);
    hornL.rotation.z = 0.3;
    const hornR = makeBox(0.12, 0.38, 0.12, trim);
    hornR.position.set(0.28, 2.38, 0);
    hornR.rotation.z = -0.3;
    const pauldronL = makeBox(0.34, 0.28, 0.44, trim);
    pauldronL.position.set(-0.56, 1.56, 0);
    const pauldronR = makeBox(0.34, 0.28, 0.44, trim);
    pauldronR.position.set(0.56, 1.56, 0);
    const armL = makeBox(0.26, 0.74, 0.26, armor);
    armL.position.set(-0.58, 1.12, 0);
    const armR = makeBox(0.26, 0.74, 0.26, armor);
    armR.position.set(0.58, 1.12, 0.12);
    armR.rotation.x = -0.45;
    const blade = makeBox(0.14, 1.15, 0.18, glow);
    blade.position.set(0.62, 1.28, 0.54);
    blade.rotation.x = 0.65;
    const legL = makeBox(0.3, 0.76, 0.32, armor);
    legL.position.set(-0.24, 0.38, 0);
    const legR = makeBox(0.3, 0.76, 0.32, armor);
    legR.position.set(0.24, 0.38, 0);
    bodyGroup.add(
      torso,
      chestTrim,
      head,
      visor,
      hornL,
      hornR,
      pauldronL,
      pauldronR,
      armL,
      armR,
      blade,
      legL,
      legR,
    );
    limbs.push(legL, legR);
    labelY = 2.95;
  }

  const { sprite, tex } = createLabelSprite(label, `Lv ${level}`, tagAccent);
  textures.push(tex);
  materials.push(sprite.material);
  sprite.position.set(0, labelY, 0);
  root.add(sprite);

  return {
    root,
    bodyGroup,
    limbs,
    hitFlashMaterials,
    phase: Math.random() * Math.PI * 2,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

/** Builds a glowing multi-part dimensional / dungeon portal arch or village landmark */
export function buildPortalProp(
  label: string,
  subtitle: string,
  colorHex: string,
  kind: 'realm' | 'dungeon' | 'shrine' | 'quest_board' | 'dungeon_exit' | 'map_pedestal',
): PropRig {
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

  let spinTarget: THREE.Object3D | undefined;

  if (kind === 'quest_board') {
    const wood = trackMat(new THREE.MeshStandardMaterial({ color: '#8A5A32', roughness: 0.85 }));
    const board = trackMat(new THREE.MeshStandardMaterial({ color: '#B88452', roughness: 0.82 }));
    const paper1 = trackMat(new THREE.MeshStandardMaterial({ color: '#FEF3C7', roughness: 0.9 }));
    const paper2 = trackMat(new THREE.MeshStandardMaterial({ color: '#E0F2FE', roughness: 0.9 }));

    const postL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 1.5, 0.14)), wood);
    postL.position.set(-0.62, 0.75, 0);
    const postR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 1.5, 0.14)), wood);
    postR.position.set(0.62, 0.75, 0);
    const frame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 0.92, 0.12)), board);
    frame.position.set(0, 1.05, 0);
    const roof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 0.14, 0.38)), wood);
    roof.position.set(0, 1.56, 0);
    const note1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.38, 0.15)), paper1);
    note1.position.set(-0.34, 1.12, 0);
    const note2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.34, 0.15)), paper2);
    note2.position.set(0.06, 1.05, 0);
    const note3 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.36, 0.15)), paper1);
    note3.position.set(0.42, 1.14, 0);
    root.add(postL, postR, frame, roof, note1, note2, note3);
  } else if (kind === 'shrine') {
    const stone = trackMat(new THREE.MeshStandardMaterial({ color: '#CBD5E1', roughness: 0.62 }));
    const gold = trackMat(new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.25, metalness: 0.8 }));
    const crystal = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        emissive: '#0EA5E9',
        emissiveIntensity: 1.2,
        roughness: 0.15,
      }),
    );

    const base1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 0.24, 1.6)), stone);
    base1.position.y = 0.12;
    const base2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 0.34, 1.1)), stone);
    base2.position.y = 0.41;
    const ring = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.42, 0.06, 8, 20)), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.62;
    const gem = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.36, 0)), crystal);
    gem.position.y = 1.32;
    spinTarget = gem;
    root.add(base1, base2, ring, gem);
  } else if (kind === 'map_pedestal') {
    const stone = trackMat(new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.72 }));
    const gold = trackMat(new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.28, metalness: 0.75 }));
    const parchment = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#FEF3C7',
        emissive: '#F59E0B',
        emissiveIntensity: 0.9,
        roughness: 0.4,
      }),
    );

    const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.95, 0.24, 0.95)), stone);
    plinth.position.y = 0.12;
    const column = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.46, 0.72, 0.46)), stone);
    column.position.y = 0.6;
    const desk = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.76, 0.12, 0.64)), gold);
    desk.position.y = 1.0;

    const scrollGroup = new THREE.Group();
    scrollGroup.position.y = 1.42;
    const scrollBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.48, 0.08, 0.34)), parchment);
    scrollBody.rotation.x = 0.38;
    const rollL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 8)), gold);
    rollL.rotation.x = Math.PI / 2;
    rollL.position.x = -0.25;
    const rollR = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 8)), gold);
    rollR.rotation.x = Math.PI / 2;
    rollR.position.x = 0.25;
    scrollGroup.add(scrollBody, rollL, rollR);
    spinTarget = scrollGroup;

    root.add(plinth, column, desk, scrollGroup);
  } else {
    // Swirling Portal Arch (Realm / Dungeon / Dungeon Exit)
    const stone = trackMat(
      new THREE.MeshStandardMaterial({
        color: kind === 'dungeon' ? '#334155' : '#475569',
        roughness: 0.72,
        metalness: 0.18,
      }),
    );
    const glowMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 1.25,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      }),
    );

    const pillarL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 2.2, 0.38)), stone);
    pillarL.position.set(-0.78, 1.1, 0);
    const pillarR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 2.2, 0.38)), stone);
    pillarR.position.set(0.78, 1.1, 0);
    const lintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.0, 0.34, 0.44)), stone);
    lintel.position.set(0, 2.24, 0);
    const vortex = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.24, 1.95)), glowMat);
    vortex.position.set(0, 1.12, 0);
    const rune = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.24, 0)), glowMat);
    rune.position.set(0, 2.68, 0);
    spinTarget = rune;
    root.add(pillarL, pillarR, lintel, vortex, rune);
  }

  const { sprite, tex } = createLabelSprite(label, subtitle, colorHex);
  textures.push(tex);
  materials.push(sprite.material);
  sprite.position.set(
    0,
    kind === 'quest_board' || kind === 'shrine' || kind === 'map_pedestal' ? 2.15 : 3.2,
    0,
  );
  root.add(sprite);

  return {
    root,
    spinTarget,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

/** Builds a golden multi-part Loot Chest or Death Grave Recovery Marker */
export function buildLootChestProp(rarity: GearRarity, isGrave = false): PropRig {
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

  const accent = isGrave
    ? '#F43F5E'
    : rarity === 'Legendary'
      ? '#F59E0B'
      : rarity === 'Epic'
        ? '#A855F7'
        : rarity === 'Rare'
          ? '#3B82F6'
          : '#22C55E';

  const wood = trackMat(
    new THREE.MeshStandardMaterial({ color: isGrave ? '#334155' : '#854D27', roughness: 0.75 }),
  );
  const metal = trackMat(
    new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.78,
    }),
  );

  const box = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.42, 0.48)), wood);
  box.position.y = 0.21;
  const lid = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.72, 0.14, 0.52)), wood);
  lid.position.y = 0.47;
  const clasp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.16, 0.54)), metal);
  clasp.position.y = 0.4;
  const band = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.74, 0.08, 0.54)), metal);
  band.position.y = 0.2;
  root.add(box, lid, clasp, band);

  const { sprite, tex } = createLabelSprite(
    isGrave ? 'Dropped Gear' : `${rarity} Chest`,
    'Click to Collect',
    accent,
  );
  textures.push(tex);
  materials.push(sprite.material);
  sprite.position.set(0, 1.05, 0);
  root.add(sprite);

  return {
    root,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
