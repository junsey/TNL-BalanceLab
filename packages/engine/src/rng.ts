export const rngVersion = "mulberry32-utf8-v1";
export type Rng = Readonly<{ word: number; draws: number }>;

export function seedRng(seed: string): Rng {
  let word = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(seed)) {
    word = Math.imul(word ^ byte, 0x01000193);
  }
  return { word: word >>> 0, draws: 0 };
}

export function runRng(seed: string, index: number): Rng {
  if (!Number.isSafeInteger(index) || index < 0)
    throw new RangeError("Índice inválido");
  return seedRng(JSON.stringify([seed, index]));
}

export function nextWord(rng: Rng): readonly [number, Rng] {
  const word = (rng.word + 0x6d2b79f5) >>> 0;
  let mixed = Math.imul(word ^ (word >>> 15), word | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return [(mixed ^ (mixed >>> 14)) >>> 0, { word, draws: rng.draws + 1 }];
}

export function rollDie(rng: Rng, sides: number): readonly [number, Rng] {
  const range = 2 ** 32;
  if (!Number.isInteger(sides) || sides < 2 || sides > range) {
    throw new RangeError("Número de caras inválido");
  }
  const limit = range - (range % sides);
  let state = rng;
  for (;;) {
    const [word, next] = nextWord(state);
    if (word < limit) return [(word % sides) + 1, next];
    state = next;
  }
}
