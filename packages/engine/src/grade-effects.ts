/** Approved rules only. Pending bleeding, dismemberment and forced movement are excluded. */
export const gradeEffectsVersion = "approved-grade-effects-v1";
export const approvedGradeEffects = [
  {
    weaponId: "hacha",
    threshold: "half",
    kind: "knocked_down",
    source: "Diseño incremental, Hacha / Derribado, 20/11/2026",
  },
  {
    weaponId: "lanza",
    threshold: "quarter",
    kind: "ignore_armor_reduction",
    source: "Diseño incremental, Lanza larga, 20/11/2026",
  },
  {
    weaponId: "charge",
    profileId: "night_hound",
    threshold: "quarter",
    kind: "knocked_down",
    source: "Diseño incremental, Arremetida, 20/11/2026",
  },
  {
    weaponId: "large_rock",
    profileId: "humped_man",
    threshold: "quarter",
    kind: "stunned",
    source: "Diseño incremental, Roca grande, 20/11/2026",
  },
] as const;
export function gradeEffectsFor(
  weaponId: string,
  profileId: string | undefined,
  grade: string,
) {
  const rank: Record<string, number> = {
    normal: 0,
    half: 1,
    quarter: 2,
    critical: 3,
  };
  return approvedGradeEffects.filter(
    (e) =>
      e.weaponId === weaponId &&
      (!("profileId" in e) || e.profileId === profileId) &&
      (rank[grade] ?? -1) >= rank[e.threshold]!,
  );
}
