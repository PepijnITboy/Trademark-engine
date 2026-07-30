import type { ConfidenceLevel, RiskBand } from "@trademark-engine/domain";

export type RankableResult = {
  id: string;
  markText: string;
  experimentalConflictScore: number;
  confidence: ConfidenceLevel;
  riskBand: RiskBand;
  independentChannelCount: number;
  activeRight: boolean;
  priorityDate?: string | null;
  ownerKey?: string | null;
};

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Deterministic lexicographic ranking with stable tie-breakers.
 * Order: score ↓, confidence ↓, active right, channel count ↓, earliest priority, id ↑
 */
export function rankResults<T extends RankableResult>(results: readonly T[]): T[] {
  return [...results].sort((a, b) => {
    if (b.experimentalConflictScore !== a.experimentalConflictScore) {
      return b.experimentalConflictScore - a.experimentalConflictScore;
    }
    if (CONFIDENCE_RANK[b.confidence] !== CONFIDENCE_RANK[a.confidence]) {
      return CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
    }
    if (a.activeRight !== b.activeRight) {
      return a.activeRight ? -1 : 1;
    }
    if (b.independentChannelCount !== a.independentChannelCount) {
      return b.independentChannelCount - a.independentChannelCount;
    }
    const ap = a.priorityDate ?? "9999-99-99";
    const bp = b.priorityDate ?? "9999-99-99";
    if (ap !== bp) {
      return ap < bp ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export type FamilyGroup<T extends RankableResult> = {
  representative: T;
  members: T[];
  memberCount: number;
  familyKey: string;
};

function familyKeyOf(item: RankableResult): string {
  const compact = item.markText
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("und")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  const owner = (item.ownerKey ?? "").trim().toLocaleLowerCase("und");
  return owner ? `${compact}::${owner}` : compact;
}

/**
 * Groups near-identical registrations so the top list shows one representative.
 * Skips grouping when familyKey would be empty.
 */
export function groupIntoFamilies<T extends RankableResult>(
  ranked: readonly T[],
): FamilyGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of ranked) {
    const key = familyKeyOf(item);
    if (!key) {
      map.set(`singleton:${item.id}`, [item]);
      continue;
    }
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }

  const groups: FamilyGroup<T>[] = [];
  for (const [familyKey, members] of map) {
    const ordered = rankResults(members);
    const representative = ordered[0];
    if (!representative) continue;
    groups.push({
      representative,
      members: ordered,
      memberCount: ordered.length,
      familyKey,
    });
  }

  return rankResults(
    groups.map((g) => ({
      ...g.representative,
      // preserve group metadata via parallel structure — re-sort groups by representative
    })),
  ).map((rep) => {
    const group = groups.find((g) => g.representative.id === rep.id);
    return group!;
  });
}
