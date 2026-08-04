import {
  ATTORNEY_FIELD_LIMITS,
  attorneyModelResponseSchema,
  type AttorneyModelResponse,
} from "./schema.js";

export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Empty model response");
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response is not a JSON object");
  }

  return candidate.slice(start, end + 1);
}

function clip(value: unknown, max: number): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return trimmed.slice(0, max).trimEnd();
}

function clipDimension(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const dim = value as Record<string, unknown>;
  return {
    ...dim,
    toelichting: clip(dim.toelichting, ATTORNEY_FIELD_LIMITS.toelichting),
  };
}

/**
 * LLMs routinely overflow soft length hints. Clip strings to schema maxima
 * so a slightly long summary never fails the whole attorney stage.
 */
export function sanitizeAttorneyModelPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed;
  }

  const root = parsed as Record<string, unknown>;
  const overall =
    root.overallAdvice && typeof root.overallAdvice === "object"
      ? (root.overallAdvice as Record<string, unknown>)
      : null;

  const topRisks = Array.isArray(root.topRisks)
    ? root.topRisks.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return item;
        }
        const risk = item as Record<string, unknown>;
        const dimensions =
          risk.dimensions && typeof risk.dimensions === "object"
            ? (risk.dimensions as Record<string, unknown>)
            : null;

        return {
          ...risk,
          summary: clip(risk.summary, ATTORNEY_FIELD_LIMITS.summary),
          confusionRisk: clip(
            risk.confusionRisk,
            ATTORNEY_FIELD_LIMITS.confusionRisk,
          ),
          whySelected: clip(risk.whySelected, ATTORNEY_FIELD_LIMITS.whySelected),
          ...(dimensions
            ? {
                dimensions: {
                  ...dimensions,
                  visueel: clipDimension(dimensions.visueel),
                  auditief: clipDimension(dimensions.auditief),
                  conceptueel: clipDimension(dimensions.conceptueel),
                  warenDiensten: clipDimension(dimensions.warenDiensten),
                },
              }
            : {}),
        };
      })
    : root.topRisks;

  return {
    ...root,
    ...(overall
      ? {
          overallAdvice: {
            ...overall,
            text: clip(overall.text, ATTORNEY_FIELD_LIMITS.overallAdviceText),
          },
        }
      : {}),
    topRisks,
  };
}

export function parseAttorneyModelResponse(raw: string): AttorneyModelResponse {
  const jsonText = extractJsonObject(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const looksTruncated =
      !jsonText.trimEnd().endsWith("}") ||
      (jsonText.match(/"/g)?.length ?? 0) % 2 === 1;
    throw new Error(
      looksTruncated
        ? "Model response JSON truncated or incomplete (increase max_tokens / shorten output)"
        : "Model response JSON parse failed",
    );
  }

  const sanitized = sanitizeAttorneyModelPayload(parsed);
  const result = attorneyModelResponseSchema.safeParse(sanitized);
  if (!result.success) {
    throw new Error(
      `Model response schema invalid: ${result.error.issues
        .map((issue) => issue.path.join(".") + ": " + issue.message)
        .join("; ")}`,
    );
  }
  return result.data;
}

export function filterToKnownCandidates(
  response: AttorneyModelResponse,
  allowedIds: ReadonlySet<string>,
  topN: number,
): AttorneyModelResponse {
  const filtered = response.topRisks
    .filter((item) => allowedIds.has(item.candidateId))
    .slice(0, topN)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return {
    overallAdvice: response.overallAdvice,
    topRisks: filtered,
  };
}
