const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export interface DatabaseStats {
  mode: "database";
  trademarkCount: number;
  corpusSourceCount: number;
  searchableCount: number;
  normalizedCount: number;
  snapshotCount: number;
  ready: boolean;
}

export interface ScanCreateResponse {
  id: string;
  status: string;
  markCount: number;
  markTexts: string[];
}

export interface ScanDetail {
  id: string;
  status: string;
  input: { markText: string; markTexts?: string[]; selectedNiceClasses?: number[] };
  createdAt: string;
  completedAt: string | null;
}

export interface ScanStage {
  id: string;
  label: string;
  status: string;
  counts?: Record<string, number>;
  message?: string;
}

export interface ScanMarkProgress {
  markText: string;
  status: string;
  resultCount: number;
  error?: string;
}

export interface ScanProgressResponse {
  stages: ScanStage[];
  percentComplete: number;
  elapsedMs: number;
  estimatedRemainingMs: number | null;
  message: string | null;
  marks: ScanMarkProgress[];
  currentMarkIndex: number;
  markTotal: number;
}

export interface ScanResultItem {
  candidateId: string;
  markText: string;
  niceClasses: number[];
  status: string;
  score: {
    experimentalConflictScore: number;
    riskBand: string;
    confidence: string;
  };
  explanations: string[];
}

export interface ScanMarkResults {
  markText: string;
  status: string;
  resultCount: number;
  results: ScanResultItem[];
  error?: string;
}

export interface ScanResultsResponse {
  results: ScanResultItem[];
  resultCount: number;
  mode: string;
  marks: ScanMarkResults[];
}

export function fetchDatabaseStats() {
  return request<DatabaseStats>("/api/database/stats");
}

export function createScan(payload: {
  markText?: string;
  markTexts?: string[];
  selectedNiceClasses?: number[];
}) {
  return request<ScanCreateResponse>("/api/scans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchScan(id: string) {
  return request<ScanDetail>(`/api/scans/${id}`);
}

export function fetchScanProgress(id: string) {
  return request<ScanProgressResponse>(`/api/scans/${id}/progress`);
}

export function fetchScanResults(id: string) {
  return request<ScanResultsResponse>(`/api/scans/${id}/results`);
}

/** Parse comma-separated mark names (max 10 unique). */
export function parseMarkTexts(value: string, max = 10): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(",")) {
    const mark = part.trim();
    if (!mark) {
      continue;
    }
    const key = mark.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(mark);
    if (unique.length >= max) {
      break;
    }
  }
  return unique;
}
