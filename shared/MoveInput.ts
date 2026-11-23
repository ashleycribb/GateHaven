import { schema, t } from '@colyseus/schema';

export const MoveInput = schema(
  {
    moveX: t.float32().default(0),
    moveZ: t.float32().default(0),
    rotY: t.float32().default(0),
    attack: t.boolean().default(false),
    useSkill: t.boolean().default(false),
    placeTrap: t.boolean().default(false),
    interact: t.boolean().default(false),
  },
  'MoveInput',
);

export type MoveInputState = InstanceType<typeof MoveInput>;

export const MOVE_INPUT_SANITIZE = {
  moveX: [-1, 1] as const,
  moveZ: [-1, 1] as const,
  rotY: [-Math.PI * 2, Math.PI * 2] as const,
} as const;
