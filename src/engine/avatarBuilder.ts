import * as THREE from 'three';
import { AvatarConfig, HatStyle, ShirtStyle } from '../types/blockhaven';

export const DEFAULT_AVATAR: AvatarConfig = {
  displayName: 'Ashley',
  bodyColor: '#F2C29B',
  shirtColor: '#2563EB',
  shirtStyle: 'striped',
  pantsColor: '#334155',
  hat: 'cap',
  hatColor: '#F59E0B',
};

export const BODY_COLORS = [
  { label: 'Peach', hex: '#F2C29B' },
  { label: 'Warm Tan', hex: '#D89E72' },
  { label: 'Chestnut', hex: '#8D5524' },
  { label: 'Deep Umber', hex: '#5C3820' },
  { label: 'Sunburst', hex: '#FACC15' },
  { label: 'Mint', hex: '#6EE7B7' },
  { label: 'Sky', hex: '#7DD3FC' },
  { label: 'Coral', hex: '#FDA4AF' },
];

export const SHIRT_COLORS = [
  { label: 'Cobalt', hex: '#2563EB' },
  { label: 'Forest', hex: '#16A34A' },
  { label: 'Brick Red', hex: '#DC2626' },
  { label: 'Amber', hex: '#F59E0B' },
  { label: 'Plum', hex: '#7C3AED' },
  { label: 'Teal', hex: '#0D9488' },
  { label: 'Slate', hex: '#334155' },
  { label: 'Snow', hex: '#F8FAFC' },
];

export const HAT_COLORS = [
  { label: 'Marigold', hex: '#F59E0B' },
  { label: 'Crimson', hex: '#DC2626' },
  { label: 'Navy', hex: '#1D4ED8' },
  { label: 'Emerald', hex: '#15803D' },
  { label: 'Royal', hex: '#6D28D9' },
  { label: 'Cream', hex: '#FEF3C7' },
];

export const SHIRT_STYLES: Array<{ id: ShirtStyle; label: string }> = [
  { id: 'classic', label: 'Classic Tee' },
  { id: 'striped', label: 'Striped' },
  { id: 'overalls', label: 'Overalls' },
  { id: 'hoodie', label: 'Hoodie' },
];

export const HAT_STYLES: Array<{ id: HatStyle; label: string }> = [
  { id: 'none', label: 'No Hat' },
  { id: 'cap', label: 'Explorer Cap' },
  { id: 'sunhat', label: 'Sun Hat' },
  { id: 'crown', label: 'Crown' },
  { id: 'wizard', label: 'Wizard Hat' },
  { id: 'beanie', label: 'Beanie' },
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

function createContactShadowTexture(): THREE.CanvasTexture {
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

function createNameTagSprite(name: string, role?: string): { sprite: THREE.Sprite; tex: THREE.CanvasTexture } {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 72;
  const ctx = c.getContext('2d')!;

  ctx.clearRect(0, 0, c.width, c.height);
  // Soft rounded backing
  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  ctx.beginPath();
  ctx.roundRect(14, 10, 228, role ? 52 : 38, 12);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, role ? 28 : 29);

  if (role) {
    ctx.fillStyle = '#CBD5E1';
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
 * Builds a grounded, composite multi-part blocky character (feet at y = 0, total height ~1.72m).
 * Used for both the 3rd-person player avatar and friendly village NPCs.
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

  const castShadow = options?.castShadow ?? true;

  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({ color: config.bodyColor, roughness: 0.72, metalness: 0.04 }),
  );
  const shirtMat = trackMat(
    new THREE.MeshStandardMaterial({ color: config.shirtColor, roughness: 0.85, metalness: 0.02 }),
  );
  const pantsMat = trackMat(
    new THREE.MeshStandardMaterial({ color: config.pantsColor || '#334155', roughness: 0.88, metalness: 0.02 }),
  );
  const shoeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.52, metalness: 0.08 }),
  );
  const eyeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.2, metalness: 0.1 }),
  );
  const eyeHighlightMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.15, metalness: 0 }),
  );
  const accentTrimMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.6, metalness: 0.05 }),
  );
  const hatMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: config.hat === 'crown' ? '#FBBF24' : config.hatColor,
      roughness: config.hat === 'crown' ? 0.25 : 0.78,
      metalness: config.hat === 'crown' ? 0.82 : 0.04,
    }),
  );

  // Soft contact shadow grounded right above ground plane
  if (!sharedShadowTex) {
    sharedShadowTex = createContactShadowTexture();
  }
  const shadowPlane = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.95, 0.95)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: sharedShadowTex,
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  const makeBox = (w: number, h: number, d: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    return mesh;
  };

  // Legs (pivot at hip y = 0.62)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.14, 0.62, 0);
  const leftLegMesh = makeBox(0.22, 0.52, 0.24, pantsMat);
  leftLegMesh.position.y = -0.26;
  const leftShoe = makeBox(0.23, 0.11, 0.28, shoeMat);
  leftShoe.position.set(0, -0.565, 0.02);
  leftLeg.add(leftLegMesh, leftShoe);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.14, 0.62, 0);
  const rightLegMesh = makeBox(0.22, 0.52, 0.24, pantsMat);
  rightLegMesh.position.y = -0.26;
  const rightShoe = makeBox(0.23, 0.11, 0.28, shoeMat);
  rightShoe.position.set(0, -0.565, 0.02);
  rightLeg.add(rightLegMesh, rightShoe);

  root.add(leftLeg, rightLeg);

  // Torso (sits from y = 0.62 to 1.22)
  const torso = makeBox(0.52, 0.6, 0.28, shirtMat);
  torso.position.y = 0.92;
  root.add(torso);

  // Shirt style accents
  if (config.shirtStyle === 'striped') {
    const stripe1 = makeBox(0.535, 0.09, 0.295, accentTrimMat);
    stripe1.position.y = 1.02;
    const stripe2 = makeBox(0.535, 0.09, 0.295, accentTrimMat);
    stripe2.position.y = 0.82;
    root.add(stripe1, stripe2);
  } else if (config.shirtStyle === 'overalls') {
    const bib = makeBox(0.36, 0.34, 0.3, pantsMat);
    bib.position.y = 0.79;
    const strapL = makeBox(0.08, 0.26, 0.3, pantsMat);
    strapL.position.set(-0.13, 1.08, 0);
    const strapR = makeBox(0.08, 0.26, 0.3, pantsMat);
    strapR.position.set(0.13, 1.08, 0);
    root.add(bib, strapL, strapR);
  } else if (config.shirtStyle === 'hoodie') {
    const pocket = makeBox(0.34, 0.16, 0.05, accentTrimMat);
    pocket.position.set(0, 0.76, 0.15);
    const hood = makeBox(0.42, 0.14, 0.14, shirtMat);
    hood.position.set(0, 1.18, -0.14);
    root.add(pocket, hood);
  }

  // Arms (pivoted at shoulders y = 1.16)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.36, 1.16, 0);
  const leftSleeve = makeBox(0.18, 0.24, 0.22, shirtMat);
  leftSleeve.position.y = -0.12;
  const leftHand = makeBox(0.17, 0.32, 0.2, skinMat);
  leftHand.position.y = -0.39;
  leftArm.add(leftSleeve, leftHand);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.36, 1.16, 0);
  const rightSleeve = makeBox(0.18, 0.24, 0.22, shirtMat);
  rightSleeve.position.y = -0.12;
  const rightHand = makeBox(0.17, 0.32, 0.2, skinMat);
  rightHand.position.y = -0.39;
  rightArm.add(rightSleeve, rightHand);

  root.add(leftArm, rightArm);

  // Head group (pivoted at neck y = 1.24)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.24, 0);

  const head = makeBox(0.46, 0.46, 0.46, skinMat);
  head.position.y = 0.23;
  headGroup.add(head);

  // Friendly blocky eyes (+Z is forward)
  const eyeL = makeBox(0.065, 0.085, 0.02, eyeMat);
  eyeL.position.set(-0.1, 0.26, 0.235);
  const eyeR = makeBox(0.065, 0.085, 0.02, eyeMat);
  eyeR.position.set(0.1, 0.26, 0.235);
  const glintL = makeBox(0.022, 0.022, 0.022, eyeHighlightMat);
  glintL.position.set(-0.085, 0.282, 0.242);
  const glintR = makeBox(0.022, 0.022, 0.022, eyeHighlightMat);
  glintR.position.set(0.115, 0.282, 0.242);
  const smile = makeBox(0.14, 0.032, 0.02, eyeMat);
  smile.position.set(0, 0.14, 0.235);
  headGroup.add(eyeL, eyeR, glintL, glintR, smile);

  // Hats (multi-part sculpted accessories)
  if (config.hat === 'cap') {
    const dome = makeBox(0.5, 0.18, 0.5, hatMat);
    dome.position.set(0, 0.48, 0);
    const brim = makeBox(0.48, 0.055, 0.26, hatMat);
    brim.position.set(0, 0.415, 0.27);
    const button = makeBox(0.08, 0.04, 0.08, accentTrimMat);
    button.position.set(0, 0.58, 0);
    headGroup.add(dome, brim, button);
  } else if (config.hat === 'sunhat') {
    const brim = makeBox(0.84, 0.05, 0.84, hatMat);
    brim.position.set(0, 0.45, 0);
    const crown = makeBox(0.48, 0.19, 0.48, hatMat);
    crown.position.set(0, 0.55, 0);
    const ribbon = makeBox(0.51, 0.06, 0.51, shirtMat);
    ribbon.position.set(0, 0.49, 0);
    headGroup.add(brim, crown, ribbon);
  } else if (config.hat === 'crown') {
    const band = makeBox(0.5, 0.11, 0.5, hatMat);
    band.position.set(0, 0.49, 0);
    headGroup.add(band);
    for (const [px, pz] of [
      [-0.2, 0.2],
      [0, 0.2],
      [0.2, 0.2],
      [-0.2, -0.2],
      [0.2, -0.2],
      [0, -0.2],
    ]) {
      const spike = makeBox(0.08, 0.12, 0.08, hatMat);
      spike.position.set(px, 0.59, pz);
      headGroup.add(spike);
    }
  } else if (config.hat === 'wizard') {
    const brim = makeBox(0.76, 0.05, 0.76, hatMat);
    brim.position.set(0, 0.46, 0);
    const cone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.28, 0.62, 6)), hatMat);
    cone.position.set(0, 0.77, -0.02);
    cone.rotation.x = -0.1;
    cone.castShadow = castShadow;
    const starBand = makeBox(0.44, 0.06, 0.44, accentTrimMat);
    starBand.position.set(0, 0.5, 0);
    headGroup.add(brim, cone, starBand);
  } else if (config.hat === 'beanie') {
    const cuff = makeBox(0.51, 0.11, 0.51, accentTrimMat);
    cuff.position.set(0, 0.44, 0);
    const dome = makeBox(0.48, 0.18, 0.48, hatMat);
    dome.position.set(0, 0.56, 0);
    const pom = makeBox(0.14, 0.14, 0.14, accentTrimMat);
    pom.position.set(0, 0.69, 0);
    headGroup.add(cuff, dome, pom);
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
  const swingTarget = moving ? Math.sin(rig.walkPhase) * 0.62 : 0;
  const damp = 1 - Math.exp(-14 * dt);

  if (isAirborne) {
    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, 0.35, damp);
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, -0.25, damp);
    rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, -0.55, damp);
    rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, -0.55, damp);
  } else {
    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, swingTarget, damp);
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, -swingTarget, damp);
    rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, -swingTarget * 0.85, damp);
    rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, swingTarget * 0.85, damp);
  }
}
