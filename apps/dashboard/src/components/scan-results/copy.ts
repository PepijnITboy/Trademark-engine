import type { AttorneyAnalysisPayload, AttorneyRiskItem } from "../../api/client";
import { formatAanbeveling, formatNiceClasses, formatRiskLevel, sortRisksByRank } from "./formatters";

export interface AttorneyCopySection {
  markText: string;
  attorney: AttorneyAnalysisPayload | undefined;
  niceByCandidateId: Record<string, number[]>;
}

export function buildAttorneyCopyText(input: {
  scanId: string;
  sections: readonly AttorneyCopySection[];
}): string {
  const lines: string[] = [];
  lines.push(`Attorney risico-overzicht (${input.scanId})`);
  lines.push("");

  for (const section of input.sections) {
    lines.push(`=== ${section.markText} ===`);
    const analysis = section.attorney;

    if (!analysis) {
      lines.push("Geen attorney-analyse beschikbaar.");
      lines.push("");
      continue;
    }

    if (analysis.status === "skipped") {
      lines.push("Geen attorney-analyse — attorney staat uit of is overgeslagen.");
      if (analysis.error) {
        lines.push(analysis.error);
      }
      lines.push("");
      continue;
    }

    if (analysis.status === "failed") {
      lines.push(`Attorney-analyse mislukt${analysis.error ? `: ${analysis.error}` : "."}`);
      lines.push("");
      continue;
    }

    if (analysis.aanbeveling) {
      lines.push(`Aanbeveling: ${formatAanbeveling(analysis.aanbeveling)}`);
    }
    if (analysis.overallAdvice) {
      lines.push(`Advies: ${analysis.overallAdvice}`);
    }
    lines.push(`Beoordeeld: ${analysis.candidatesConsidered} kandidaten`);

    const risks = sortRisksByRank(analysis.topRisks);
    if (risks.length === 0) {
      lines.push("Geen materiële risico’s geselecteerd.");
    } else {
      for (const risk of risks) {
        lines.push(formatRiskCopyLine(risk, section.niceByCandidateId[risk.candidateId]));
      }
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function formatRiskCopyLine(
  risk: AttorneyRiskItem,
  niceClasses: number[] | undefined,
): string {
  const nice = formatNiceClasses(niceClasses);
  return `${risk.rank}. ${risk.markText} | Nice ${nice} | ${formatRiskLevel(risk.riskLevel)} | ${risk.summary}`;
}
