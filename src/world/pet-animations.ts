export type PetSpecies = "cat" | "dog";
export type PetAnimationTag = "idle" | "follow" | "rest" | "play";

export const neutralPetPose = {
  lift: 0,
  lean: 0,
  roll: 0,
  turn: 0,
  headPitch: 0,
  headYaw: 0,
  headRoll: 0,
  tail: 0,
  tailYaw: 0,
  tailTip: 0,
  earLeft: 0,
  earRight: 0,
  frontLeft: 0,
  frontRight: 0,
  backLeft: 0,
  backRight: 0,
  blink: 0,
};
export type PetPose = typeof neutralPetPose;
type Pose = Partial<PetPose>;
export interface PetAnimation {
  readonly name: string;
  readonly species: PetSpecies;
  readonly duration: number;
  readonly tags: readonly PetAnimationTag[];
  readonly poses: readonly Pose[];
}
const channels = Object.keys(neutralPetPose) as (keyof PetPose)[];
const catalog: PetAnimation[] = [];
function add(
  species: PetSpecies,
  name: string,
  duration: number,
  tag: PetAnimationTag,
  ...poses: Pose[]
) {
  catalog.push({
    name: `${species}-${name}`,
    species,
    duration,
    tags: [tag],
    poses,
  });
}
const cat = (
  name: string,
  duration: number,
  tag: PetAnimationTag,
  ...poses: Pose[]
) => add("cat", name, duration, tag, ...poses);
const dog = (
  name: string,
  duration: number,
  tag: PetAnimationTag,
  ...poses: Pose[]
) => add("dog", name, duration, tag, ...poses);
const sit: Pose = {
  lift: -0.1,
  lean: -0.2,
  backLeft: -0.95,
  backRight: -0.95,
  tail: 0.6,
};
const crouch: Pose = {
  lift: -0.17,
  frontLeft: 0.65,
  frontRight: 0.65,
  backLeft: -0.65,
  backRight: -0.65,
};
const loaf: Pose = {
  lift: -0.23,
  frontLeft: -1.35,
  frontRight: -1.35,
  backLeft: 1.3,
  backRight: 1.3,
  tail: 1,
  tailYaw: 1.1,
  tailTip: 1.2,
};
const curl: Pose = {
  ...loaf,
  headYaw: 1.15,
  headPitch: 0.25,
  tailYaw: 1.5,
  tailTip: 1.7,
  roll: 0.22,
  blink: 0.9,
};
const bow: Pose = {
  lean: 0.36,
  lift: -0.07,
  frontLeft: -0.9,
  frontRight: -0.9,
  tail: 0.65,
  headPitch: -0.35,
};

cat(
  "walk",
  0.72,
  "follow",
  {
    frontLeft: 0.5,
    frontRight: -0.5,
    backLeft: -0.5,
    backRight: 0.5,
    tailYaw: -0.15,
  },
  {
    frontLeft: -0.5,
    frontRight: 0.5,
    backLeft: 0.5,
    backRight: -0.5,
    lift: 0.035,
    tailYaw: 0.15,
  },
  {
    frontLeft: 0.5,
    frontRight: -0.5,
    backLeft: -0.5,
    backRight: 0.5,
    tailYaw: -0.15,
  },
);
cat(
  "trot",
  0.46,
  "follow",
  {
    frontLeft: 0.8,
    backRight: 0.8,
    frontRight: -0.7,
    backLeft: -0.7,
    lean: 0.08,
  },
  {
    lift: 0.09,
    frontLeft: -0.7,
    backRight: -0.7,
    frontRight: 0.8,
    backLeft: 0.8,
    tail: 0.5,
  },
  {
    frontLeft: 0.8,
    backRight: 0.8,
    frontRight: -0.7,
    backLeft: -0.7,
    lean: 0.08,
  },
);
cat(
  "stalk",
  1.8,
  "follow",
  { ...crouch, headPitch: -0.15, frontLeft: -0.4 },
  { ...crouch, headYaw: 0.15, frontRight: -0.4, backLeft: 0.35 },
  { ...crouch, headPitch: -0.15, frontLeft: -0.4 },
);
cat(
  "jump",
  1.25,
  "play",
  {},
  crouch,
  {
    lean: -0.25,
    frontLeft: -1.1,
    frontRight: -1.1,
    backLeft: 0.55,
    backRight: 0.55,
    tail: -0.7,
  },
  { lean: 0.2, frontLeft: 0.4, frontRight: 0.4 },
  crouch,
  {},
);
cat(
  "pounce",
  1.5,
  "play",
  { ...crouch, tailYaw: -0.6 },
  { ...crouch, tailYaw: 0.6 },
  {
    lift: 0.28,
    lean: 0.24,
    frontLeft: -1.3,
    frontRight: -1.3,
    backLeft: 0.7,
    backRight: 0.7,
  },
  { ...crouch, headPitch: 0.4 },
  {},
);
cat("loaf", 5, "rest", loaf, { ...loaf, blink: 0.8, headPitch: 0.1 }, loaf);
cat("curl", 6, "rest", curl, { ...curl, lift: -0.21, headPitch: 0.32 }, curl);
cat(
  "sit-watch",
  4,
  "idle",
  sit,
  { ...sit, headYaw: -0.65, earLeft: -0.25 },
  { ...sit, headYaw: 0.65, earRight: 0.25 },
  sit,
);
cat(
  "slow-blink",
  3.2,
  "idle",
  {},
  { blink: 0.1, headPitch: -0.07 },
  { blink: 1, headPitch: 0.07 },
  { blink: 0.2 },
  {},
);
cat(
  "ear-twitch",
  1.4,
  "idle",
  {},
  { earLeft: -0.7, earRight: 0.2 },
  { earLeft: 0.25, earRight: -0.4 },
  {},
);
cat(
  "tail-question",
  3,
  "idle",
  {},
  { tail: 1.1, tailTip: 1.7, headRoll: 0.3 },
  { tail: 1.1, tailTip: 1.7, tailYaw: 0.4 },
  {},
);
cat(
  "tail-flick",
  2,
  "idle",
  { tail: 0.6 },
  { tail: 0.6, tailTip: -0.9 },
  { tail: 0.6, tailTip: 1.1 },
  { tail: 0.6 },
);
cat(
  "wash-left-paw",
  4.2,
  "idle",
  sit,
  { ...sit, frontLeft: -1.8, headPitch: 0.6, headYaw: -0.25 },
  { ...sit, frontLeft: -1.65, headPitch: 0.25, headYaw: -0.2 },
  { ...sit, frontLeft: -1.8, headPitch: 0.6 },
  sit,
);
cat(
  "wash-right-paw",
  4,
  "idle",
  sit,
  { ...sit, frontRight: -1.9, headYaw: 0.3, headPitch: 0.5 },
  { ...sit, frontRight: -1.2, headPitch: 0.1 },
  { ...sit, frontRight: -1.9, headYaw: 0.3, headPitch: 0.5 },
  sit,
);
cat(
  "wipe-face",
  3.4,
  "idle",
  sit,
  { ...sit, frontLeft: -2.4, headRoll: 0.2, blink: 0.9 },
  { ...sit, frontLeft: -1.2, headPitch: 0.4 },
  sit,
);
cat(
  "groom-shoulder",
  4.4,
  "idle",
  sit,
  { ...sit, headYaw: -1.1, headPitch: 0.65, earLeft: 0.4 },
  { ...sit, headYaw: -0.9, headPitch: 0.3 },
  sit,
);
cat(
  "groom-tail",
  4.8,
  "idle",
  { ...sit, tailYaw: 1.4, tailTip: 1.4 },
  { ...sit, turn: 0.35, headYaw: 1.3, headPitch: 0.7, tailYaw: 1.4 },
  { ...sit, turn: 0.35, headYaw: 1.15, tailTip: 1.6 },
  sit,
);
cat(
  "scratch-ear",
  2.6,
  "idle",
  { ...sit, headRoll: 0.5 },
  { ...sit, headRoll: 0.5, backRight: -2, earRight: -0.4 },
  { ...sit, headRoll: 0.45, backRight: -1.3 },
  { ...sit, headRoll: 0.5, backRight: -2 },
  sit,
);
cat(
  "knead",
  3,
  "rest",
  { ...crouch, frontLeft: 0.3, frontRight: -0.45, blink: 0.6 },
  { ...crouch, frontLeft: -0.45, frontRight: 0.3, blink: 0.8 },
  { ...crouch, frontLeft: 0.3, frontRight: -0.45, blink: 0.6 },
);
cat(
  "front-stretch",
  3.5,
  "rest",
  {},
  { ...bow, tail: 1, backLeft: 0.2, backRight: 0.2 },
  { ...bow, frontLeft: -1.3, frontRight: -1.3, blink: 0.8 },
  {},
);
cat(
  "back-stretch",
  3.2,
  "rest",
  {},
  {
    lean: -0.23,
    lift: 0.06,
    backLeft: 1.3,
    backRight: 1.3,
    headPitch: -0.3,
    tail: 1,
  },
  { backLeft: 0.65, headYaw: 0.4 },
  {},
);
cat(
  "arch-back",
  2.7,
  "play",
  {},
  {
    lift: 0.13,
    lean: 0.07,
    headPitch: 0.45,
    tail: 1.3,
    earLeft: -0.5,
    earRight: 0.5,
  },
  { lift: 0.1, roll: -0.1, tailYaw: -0.4 },
  {},
);
cat(
  "belly-roll",
  4,
  "play",
  crouch,
  { roll: 1.5, lift: -0.1, frontLeft: -1.1, frontRight: -1.1 },
  { roll: 3.14, lift: 0.06, frontLeft: -0.5, backRight: 0.8, headRoll: 0.3 },
  { roll: 4.7, lift: -0.1 },
  { roll: 6.28 },
);
cat(
  "side-nap",
  7,
  "rest",
  { roll: 1.5, lift: -0.17, blink: 1, frontLeft: -0.3, tailYaw: 0.6 },
  { roll: 1.5, lift: -0.15, blink: 1, frontLeft: -0.5, tailYaw: 0.65 },
  { roll: 1.5, lift: -0.17, blink: 1, frontLeft: -0.3, tailYaw: 0.6 },
);
cat(
  "yawn",
  4.2,
  "rest",
  sit,
  {
    ...sit,
    headPitch: -0.4,
    blink: 0.8,
    earLeft: -0.25,
    earRight: 0.25,
  },
  { ...sit, headPitch: 0.2 },
  sit,
);
cat(
  "nose-sniff",
  2.6,
  "idle",
  {},
  { headPitch: 0.65, lean: 0.12, tail: 0.7 },
  { headPitch: 0.65, headYaw: -0.35 },
  { headPitch: 0.55, headYaw: 0.35 },
  {},
);
cat(
  "air-sniff",
  3,
  "idle",
  sit,
  { ...sit, headPitch: -0.65, earLeft: -0.2, tailTip: 0.7 },
  { ...sit, headPitch: -0.55, headYaw: 0.3 },
  sit,
);
cat(
  "paw-bat",
  2.2,
  "play",
  {},
  { frontLeft: -1.1, headYaw: -0.4, tailYaw: -0.7 },
  { frontLeft: 0.5, headYaw: 0.2, tailYaw: 0.5 },
  {},
);
cat(
  "two-paw-catch",
  1.8,
  "play",
  sit,
  {
    ...sit,
    lean: -0.45,
    frontLeft: -2,
    frontRight: -2,
    headPitch: -0.5,
    tail: 1,
  },
  { ...sit, frontLeft: -1.4, frontRight: -1.4, headPitch: 0.2 },
  sit,
);
cat(
  "head-rub",
  3.4,
  "idle",
  {},
  { headRoll: -0.6, headYaw: -0.3, roll: -0.13, blink: 0.75 },
  { headRoll: -0.3, headYaw: 0.3, lean: -0.1, blink: 0.9 },
  {},
);
cat(
  "look-up",
  3.7,
  "idle",
  sit,
  { ...sit, headPitch: -0.8, tailTip: 0.8 },
  { ...sit, headPitch: -0.7, headYaw: -0.4 },
  sit,
);
cat(
  "ledge-peek",
  3.8,
  "idle",
  crouch,
  { ...crouch, lean: 0.22, headPitch: 0.75, frontLeft: -0.2, frontRight: -0.2 },
  { ...crouch, headPitch: 0.75, headYaw: 0.4 },
  crouch,
);
cat(
  "startled-hop",
  1.1,
  "play",
  {},
  {
    lift: 0.32,
    roll: -0.18,
    earLeft: -0.8,
    earRight: 0.8,
    tail: 1.4,
    frontLeft: -0.7,
    frontRight: -0.7,
  },
  { ...crouch, headYaw: -0.5 },
  {},
);
cat(
  "chase-tail",
  2.8,
  "play",
  { headYaw: 0.9, tailYaw: 1.1 },
  { turn: 2.1, headYaw: 1, frontLeft: 0.65, backRight: -0.65, tailTip: 1.5 },
  { turn: 4.2, headYaw: 1, frontRight: 0.65, backLeft: -0.65 },
  { turn: 6.28, headYaw: 0.9, tailYaw: 1.1 },
);
cat(
  "happy-prance",
  1.3,
  "follow",
  { frontLeft: -0.8, backRight: 0.5, tail: 1.1, headPitch: -0.2 },
  { lift: 0.12, frontRight: -0.8, backLeft: 0.5, tailTip: 1 },
  { frontLeft: -0.8, backRight: 0.5, tail: 1.1, headPitch: -0.2 },
);
cat(
  "settle-down",
  4.6,
  "rest",
  sit,
  { ...crouch, headPitch: 0.3 },
  loaf,
  { ...loaf, blink: 1 },
  loaf,
);

dog(
  "walk",
  0.8,
  "follow",
  {
    frontLeft: 0.5,
    frontRight: -0.5,
    backLeft: -0.5,
    backRight: 0.5,
    tailYaw: -0.35,
  },
  {
    frontLeft: -0.5,
    frontRight: 0.5,
    backLeft: 0.5,
    backRight: -0.5,
    tailYaw: 0.35,
    lift: 0.035,
  },
  {
    frontLeft: 0.5,
    frontRight: -0.5,
    backLeft: -0.5,
    backRight: 0.5,
    tailYaw: -0.35,
  },
);
dog(
  "trot",
  0.5,
  "follow",
  {
    frontLeft: 0.85,
    backRight: 0.85,
    frontRight: -0.7,
    backLeft: -0.7,
  },
  {
    lift: 0.11,
    frontLeft: -0.7,
    backRight: -0.7,
    frontRight: 0.85,
    backLeft: 0.85,
    earLeft: 0.2,
    earRight: -0.2,
  },
  {
    frontLeft: 0.85,
    backRight: 0.85,
    frontRight: -0.7,
    backLeft: -0.7,
  },
);
dog(
  "bound",
  0.8,
  "follow",
  crouch,
  {
    lift: 0.25,
    frontLeft: -1.1,
    frontRight: -1.1,
    backLeft: 0.8,
    backRight: 0.8,
    lean: -0.13,
  },
  { frontLeft: 0.8, frontRight: 0.8, backLeft: -1, backRight: -1, lean: 0.15 },
  crouch,
);
dog(
  "sit",
  4.5,
  "idle",
  sit,
  { ...sit, headRoll: 0.12, tailYaw: 0.3 },
  { ...sit, headRoll: -0.12, tailYaw: -0.3 },
  sit,
);
dog(
  "tail-wag",
  1.3,
  "idle",
  { tail: 0.8, tailYaw: -0.8 },
  { tail: 0.8, tailYaw: 0.8, roll: 0.06 },
  { tail: 0.8, tailYaw: -0.8 },
);
dog(
  "whole-body-wag",
  2.2,
  "play",
  { tailYaw: -0.9, turn: -0.18, headYaw: 0.25, roll: 0.1 },
  { tailYaw: 0.9, turn: 0.18, headYaw: -0.25, roll: -0.1 },
  { tailYaw: -0.9, turn: -0.18, headYaw: 0.25, roll: 0.1 },
);
dog(
  "play-bow",
  3,
  "play",
  {},
  bow,
  { ...bow, tailYaw: -0.8 },
  { ...bow, tailYaw: 0.8 },
  {},
);
dog(
  "head-tilt-left",
  3.3,
  "idle",
  sit,
  { ...sit, headRoll: 0.55, earLeft: -0.3, headYaw: -0.15 },
  { ...sit, headRoll: 0.45 },
  sit,
);
dog(
  "head-tilt-right",
  3.5,
  "idle",
  {},
  { headRoll: -0.5, earRight: 0.4, frontRight: -0.25 },
  { headRoll: -0.3, headPitch: -0.2 },
  {},
);
dog(
  "sniff-ground",
  3.8,
  "idle",
  {},
  { lean: 0.25, headPitch: 0.8, tail: 0.5 },
  { lean: 0.25, headPitch: 0.8, headYaw: -0.5, frontLeft: 0.2 },
  { lean: 0.25, headPitch: 0.7, headYaw: 0.5 },
  {},
);
dog(
  "sniff-air",
  3.1,
  "idle",
  {},
  { headPitch: -0.55, earLeft: -0.4, earRight: 0.4, tail: 0.3 },
  { headPitch: -0.6, headYaw: -0.35 },
  {},
);
dog(
  "sniff-trail",
  1.6,
  "follow",
  { headPitch: 0.7, frontLeft: 0.4, backRight: 0.4 },
  {
    headPitch: 0.65,
    headYaw: -0.3,
    frontRight: 0.4,
    backLeft: 0.4,
    tailYaw: 0.4,
  },
  { headPitch: 0.7, frontLeft: 0.4, backRight: 0.4 },
);
dog(
  "offer-paw",
  3.6,
  "play",
  sit,
  { ...sit, frontRight: -1.5, headRoll: -0.2, tailYaw: 0.45 },
  { ...sit, frontRight: -1.2, headPitch: -0.2 },
  sit,
);
dog(
  "high-five",
  2.8,
  "play",
  sit,
  { ...sit, frontLeft: -2.2, lean: -0.3, headPitch: -0.4 },
  { ...sit, frontLeft: -1.8 },
  sit,
);
dog(
  "beg",
  4,
  "play",
  sit,
  {
    ...sit,
    lean: -0.55,
    frontLeft: -1.3,
    frontRight: -1.3,
    headPitch: -0.4,
    tailYaw: -0.6,
  },
  { ...sit, lean: -0.55, frontLeft: -1.5, frontRight: -1.1, tailYaw: 0.6 },
  sit,
);
dog(
  "happy-hop",
  1.2,
  "play",
  crouch,
  {
    lift: 0.4,
    frontLeft: -0.8,
    frontRight: -0.8,
    backLeft: -0.5,
    backRight: -0.5,
    tail: 1,
  },
  crouch,
);
dog(
  "spin",
  2.6,
  "play",
  {},
  { turn: 2.1, frontLeft: 0.7, backRight: -0.7, tailYaw: -0.5 },
  { turn: 4.2, frontRight: 0.7, backLeft: -0.7, tailYaw: 0.5 },
  { turn: 6.28 },
);
dog(
  "roll-over",
  4.2,
  "play",
  crouch,
  { roll: -1.5, lift: -0.12, frontRight: -0.8 },
  {
    roll: -3.14,
    lift: 0.04,
    frontLeft: -1,
    frontRight: -1,
    backLeft: -0.8,
    backRight: -0.8,
  },
  { roll: -4.7, lift: -0.12 },
  { roll: -6.28 },
);
dog(
  "belly-up",
  5.5,
  "rest",
  {
    roll: 3.14,
    lift: 0.04,
    frontLeft: -1.2,
    frontRight: -1.2,
    backLeft: -0.7,
    backRight: -0.7,
  },
  {
    roll: 3.14,
    lift: 0.06,
    frontLeft: -0.8,
    frontRight: -1.4,
    backLeft: -0.5,
    backRight: -0.9,
    blink: 0.7,
  },
  {
    roll: 3.14,
    lift: 0.04,
    frontLeft: -1.2,
    frontRight: -1.2,
    backLeft: -0.7,
    backRight: -0.7,
  },
);
dog(
  "scratch-collar",
  2.8,
  "idle",
  sit,
  { ...sit, headRoll: -0.55, backLeft: -1.9, earLeft: -0.4 },
  { ...sit, headRoll: -0.4, backLeft: -1.1 },
  { ...sit, headRoll: -0.55, backLeft: -1.9 },
  sit,
);
dog(
  "shake-off",
  1.5,
  "idle",
  {},
  { roll: -0.17, headYaw: 0.7, earLeft: -0.7, earRight: -0.3, tailYaw: 0.6 },
  { roll: 0.17, headYaw: -0.7, earLeft: 0.3, earRight: 0.7, tailYaw: -0.6 },
  { roll: -0.1, headYaw: 0.4 },
  {},
);
dog(
  "ear-perk",
  2.4,
  "idle",
  sit,
  { ...sit, earLeft: -0.65, earRight: 0.65, headPitch: -0.15 },
  { ...sit, headYaw: 0.4, earLeft: -0.65 },
  sit,
);
dog(
  "nose-lick",
  2.7,
  "idle",
  {},
  { headPitch: -0.2, blink: 0.6 },
  { headPitch: 0.12 },
  {},
);
dog(
  "pant",
  2,
  "idle",
  { headPitch: -0.15, tail: 0.6 },
  { lift: 0.025, headPitch: -0.13, tailYaw: 0.3 },
  { headPitch: -0.15, tail: 0.6 },
);
dog(
  "quiet-bark",
  1.5,
  "idle",
  {},
  { lean: -0.1, headPitch: -0.3, earLeft: -0.35, earRight: 0.35 },
  { headPitch: 0.1 },
  {},
);
dog(
  "howl",
  4,
  "idle",
  sit,
  { ...sit, headPitch: -0.9, earLeft: 0.3, earRight: -0.3 },
  { ...sit, headPitch: -0.8 },
  sit,
);
dog(
  "yawn",
  4.6,
  "rest",
  { ...loaf, tailYaw: 0.2 },
  { ...loaf, tailYaw: 0.2, headPitch: -0.5, blink: 0.9 },
  { ...loaf, tailYaw: 0.2 },
);
dog(
  "chin-on-paws",
  6,
  "rest",
  { ...loaf, tailYaw: 0.2, headPitch: 0.35, frontLeft: -0.4, frontRight: -0.4 },
  {
    ...loaf,
    tailYaw: 0.2,
    headPitch: 0.4,
    frontLeft: -0.4,
    frontRight: -0.4,
    blink: 0.95,
  },
  { ...loaf, tailYaw: 0.2, headPitch: 0.35, frontLeft: -0.4, frontRight: -0.4 },
);
dog(
  "dream-paws",
  5,
  "rest",
  { roll: -1.5, lift: -0.17, blink: 1, frontLeft: 0.2, backRight: -0.3 },
  {
    roll: -1.5,
    lift: -0.15,
    blink: 1,
    frontLeft: -0.6,
    backRight: 0.5,
    earRight: 0.3,
  },
  { roll: -1.5, lift: -0.17, blink: 1, frontLeft: 0.2, backRight: -0.3 },
);
dog(
  "curl-nap",
  7,
  "rest",
  { ...curl, headYaw: -0.9, tailYaw: -1 },
  { ...curl, headYaw: -0.95, tailYaw: -1, lift: -0.21 },
  { ...curl, headYaw: -0.9, tailYaw: -1 },
);
dog(
  "long-stretch",
  4,
  "rest",
  loaf,
  bow,
  { ...bow, headPitch: -0.5, backLeft: 0.6, backRight: 0.6 },
  {},
);
dog(
  "hind-leg-stretch",
  3.3,
  "rest",
  {},
  { backLeft: 1.5, lean: -0.15, tailYaw: 0.4 },
  { backRight: 1.5, lean: -0.15, tailYaw: -0.4 },
  {},
);
dog(
  "dig",
  2,
  "play",
  { ...bow, frontLeft: -1.1, frontRight: 0.4, headPitch: 0.2 },
  { ...bow, frontLeft: 0.4, frontRight: -1.1, headPitch: 0.3, tailYaw: 0.5 },
  { ...bow, frontLeft: -1.1, frontRight: 0.4, headPitch: 0.2 },
);
dog(
  "peek-behind",
  3.5,
  "idle",
  sit,
  { ...sit, headYaw: 1.2, turn: 0.15, earRight: -0.3 },
  { ...sit, headYaw: -1.1, turn: -0.15, earLeft: 0.3 },
  sit,
);
dog(
  "tiptoe",
  1.4,
  "follow",
  { lift: 0.03, frontLeft: -0.7, backRight: 0.3, headPitch: -0.3 },
  {
    lift: 0.06,
    frontRight: -0.7,
    backLeft: 0.3,
    headPitch: -0.3,
    earLeft: -0.2,
  },
  { lift: 0.03, frontLeft: -0.7, backRight: 0.3, headPitch: -0.3 },
);
dog(
  "settle-circle",
  5,
  "rest",
  { turn: 0.3, headPitch: 0.4 },
  { turn: 2.3, frontLeft: 0.4, backRight: -0.4 },
  { turn: 4.4, frontRight: 0.4, backLeft: -0.4 },
  { ...loaf, turn: 6.28, tailYaw: 0.2, blink: 0.8 },
);

export const animationCatalog: readonly PetAnimation[] = catalog;

/** Writes a complete pose so switching clips never retains a previous joint angle. */
export function samplePetAnimation(
  clip: PetAnimation,
  time: number,
  out: PetPose,
): void {
  const phase = ((time % clip.duration) + clip.duration) % clip.duration;
  const frame = (phase / clip.duration) * (clip.poses.length - 1);
  const index = Math.floor(frame);
  const from = clip.poses[index];
  const to = clip.poses[Math.min(index + 1, clip.poses.length - 1)];
  const fraction = frame - index;
  const eased = fraction * fraction * (3 - 2 * fraction);
  for (const channel of channels) {
    const start = from[channel] ?? 0;
    out[channel] = start + ((to[channel] ?? 0) - start) * eased;
  }
}
