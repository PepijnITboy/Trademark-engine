export type WeightedEditRule = {
  id: string;
  from: string;
  to: string;
  cost: number;
  bidirectional?: boolean;
  localeProfiles?: string[];
};

export type EditOperation =
  | { kind: "match"; aIndex: number; bIndex: number; chars: string }
  | { kind: "substitute"; aIndex: number; bIndex: number; from: string; to: string; ruleId?: string }
  | { kind: "insert"; bIndex: number; char: string }
  | { kind: "delete"; aIndex: number; char: string };

export type WeightedEditResult = {
  rawCost: number;
  normalizedSimilarity: number;
  operations: EditOperation[];
  appliedRuleIds: string[];
  localeProfile: string;
  algorithmVersion: string;
};

export const ALGORITHM_VERSION = "2026.07.30-dp-v1";

const DEFAULT_INSERT_COST = 1;
const DEFAULT_DELETE_COST = 1;
const DEFAULT_SUBSTITUTE_COST = 1;

export function loadDefaultRules(): WeightedEditRule[] {
  return [
    { id: "s-z", from: "s", to: "z", cost: 0.25, bidirectional: true, localeProfiles: ["nl", "de", "en", "generic"] },
    { id: "c-k", from: "c", to: "k", cost: 0.25, bidirectional: true },
    { id: "ph-f", from: "ph", to: "f", cost: 0.2, bidirectional: true },
    { id: "f-ph", from: "f", to: "ph", cost: 0.2, bidirectional: true },
    { id: "qu-kw", from: "qu", to: "kw", cost: 0.2, bidirectional: true },
    { id: "ij-y", from: "ij", to: "y", cost: 0.2, bidirectional: true, localeProfiles: ["nl"] },
    { id: "y-ij", from: "y", to: "ij", cost: 0.2, bidirectional: true, localeProfiles: ["nl"] },
    { id: "ck-k", from: "ck", to: "k", cost: 0.2, bidirectional: true },
    { id: "x-ks", from: "x", to: "ks", cost: 0.35, bidirectional: true },
  ];
}

type SubstitutionOption = {
  aSlice: string;
  bSlice: string;
  cost: number;
  ruleId?: string;
  aLen: number;
  bLen: number;
};

function normalizeInput(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function buildSubstitutionOptions(
  a: string,
  b: string,
  endA: number,
  endB: number,
  rules: WeightedEditRule[],
  localeProfile: string,
): SubstitutionOption[] {
  const options: SubstitutionOption[] = [];
  const maxLen = 3;

  for (let aLen = 1; aLen <= maxLen && endA - aLen >= 0; aLen++) {
    for (let bLen = 1; bLen <= maxLen && endB - bLen >= 0; bLen++) {
      const aSlice = a.slice(endA - aLen, endA);
      const bSlice = b.slice(endB - bLen, endB);
      if (aSlice === bSlice) {
        options.push({ aSlice, bSlice, cost: 0, aLen, bLen });
        continue;
      }

      for (const rule of rules) {
        if (rule.localeProfiles && !rule.localeProfiles.includes(localeProfile)) {
          continue;
        }
        const forward = rule.from === aSlice && rule.to === bSlice;
        const backward =
          rule.bidirectional === true && rule.from === bSlice && rule.to === aSlice;
        if (forward || backward) {
          options.push({
            aSlice,
            bSlice,
            cost: rule.cost,
            ruleId: rule.id,
            aLen,
            bLen,
          });
        }
      }
    }
  }

  return options;
}

function backtrackOperations(
  a: string,
  b: string,
  costMatrix: number[][],
  choiceMatrix: Array<Array<SubstitutionOption | "insert" | "delete" | null>>,
): EditOperation[] {
  const ops: EditOperation[] = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    const choice = choiceMatrix[i]![j]!;
    if (choice === "insert") {
      j--;
      ops.push({ kind: "insert", bIndex: j, char: b[j]! });
      continue;
    }
    if (choice === "delete") {
      i--;
      ops.push({ kind: "delete", aIndex: i, char: a[i]! });
      continue;
    }

    const opt = choice as SubstitutionOption;
    i -= opt.aLen;
    j -= opt.bLen;

    if (opt.cost === 0) {
      ops.push({
        kind: "match",
        aIndex: i,
        bIndex: j,
        chars: opt.aSlice,
      });
    } else {
      ops.push({
        kind: "substitute",
        aIndex: i,
        bIndex: j,
        from: opt.aSlice,
        to: opt.bSlice,
        ...(opt.ruleId ? { ruleId: opt.ruleId } : {}),
      });
    }
  }

  return ops.reverse();
}

/**
 * Weighted edit distance with multi-character substitution rules (DP).
 */
export function weightedEdit(
  a: string,
  b: string,
  localeProfile = "generic",
  rules: WeightedEditRule[] = loadDefaultRules(),
): WeightedEditResult {
  const left = normalizeInput(a);
  const right = normalizeInput(b);

  if (left.length === 0 && right.length === 0) {
    return {
      rawCost: 0,
      normalizedSimilarity: 1,
      operations: [],
      appliedRuleIds: [],
      localeProfile,
      algorithmVersion: ALGORITHM_VERSION,
    };
  }

  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Number.POSITIVE_INFINITY),
  );
  const choices: Array<Array<SubstitutionOption | "insert" | "delete" | null>> = Array.from(
    { length: rows },
    () => Array.from({ length: cols }, () => null),
  );

  dp[0]![0] = 0;

  for (let i = 1; i < rows; i++) {
    dp[i]![0] = i * DEFAULT_DELETE_COST;
    choices[i]![0] = "delete";
  }
  for (let j = 1; j < cols; j++) {
    dp[0]![j] = j * DEFAULT_INSERT_COST;
    choices[0]![j] = "insert";
  }

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const deleteCost = dp[i - 1]![j]! + DEFAULT_DELETE_COST;
      const insertCost = dp[i]![j - 1]! + DEFAULT_INSERT_COST;
      let best = deleteCost;
      let bestChoice: SubstitutionOption | "insert" | "delete" | null = "delete";

      if (insertCost < best) {
        best = insertCost;
        bestChoice = "insert";
      }

      const subs = buildSubstitutionOptions(left, right, i, j, rules, localeProfile);
      for (const opt of subs) {
        const prevI = i - opt.aLen;
        const prevJ = j - opt.bLen;
        const subCost = dp[prevI]![prevJ]! + opt.cost;
        if (subCost < best) {
          best = subCost;
          bestChoice = opt;
        }
      }

      if (!Number.isFinite(best)) {
        best = DEFAULT_SUBSTITUTE_COST;
        bestChoice = {
          aSlice: left[i - 1]!,
          bSlice: right[j - 1]!,
          cost: DEFAULT_SUBSTITUTE_COST,
          aLen: 1,
          bLen: 1,
        };
      }

      dp[i]![j] = best;
      choices[i]![j] = bestChoice;
    }
  }

  const rawCost = dp[rows - 1]![cols - 1]!;
  const maxLen = Math.max(left.length, right.length, 1);
  const normalizedSimilarity = Math.max(0, Math.min(1, 1 - rawCost / maxLen));

  const operations = backtrackOperations(left, right, dp, choices);
  const appliedRuleIds = [
    ...new Set(
      operations
        .filter((op): op is Extract<EditOperation, { kind: "substitute" }> => op.kind === "substitute")
        .map((op) => op.ruleId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  return {
    rawCost,
    normalizedSimilarity,
    operations,
    appliedRuleIds,
    localeProfile,
    algorithmVersion: ALGORITHM_VERSION,
  };
}
