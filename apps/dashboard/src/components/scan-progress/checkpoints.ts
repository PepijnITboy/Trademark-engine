export type CheckpointId =
  | "exact"
  | "similarity"
  | "conflict"
  | "final";

export type CheckpointState = "pending" | "active" | "complete";

export interface ProgressCheckpoint {
  readonly id: CheckpointId;
  readonly label: string;
  readonly statusLabel: string;
  /** Percent at which this checkpoint completes / celebrates. */
  readonly threshold: number;
}

export const PROGRESS_CHECKPOINTS: readonly ProgressCheckpoint[] = [
  {
    id: "exact",
    label: "Exact match",
    statusLabel: "Searching for identical marks…",
    threshold: 22,
  },
  {
    id: "similarity",
    label: "Similarity",
    statusLabel: "Looking for similar marks…",
    threshold: 48,
  },
  {
    id: "conflict",
    label: "Conflict check",
    statusLabel: "Comparing possible conflicts…",
    threshold: 72,
  },
  {
    id: "final",
    label: "Final review",
    statusLabel: "Finalizing results…",
    threshold: 95,
  },
] as const;

export function checkpointState(
  checkpoint: ProgressCheckpoint,
  percent: number,
  scanCompleted: boolean,
): CheckpointState {
  if (scanCompleted || percent >= checkpoint.threshold) {
    return "complete";
  }

  const index = PROGRESS_CHECKPOINTS.findIndex((item) => item.id === checkpoint.id);
  const prevThreshold =
    index <= 0 ? 0 : PROGRESS_CHECKPOINTS[index - 1]!.threshold;

  if (percent >= prevThreshold) {
    return "active";
  }

  return "pending";
}

export function resolveActiveCheckpoint(
  percent: number,
  scanCompleted: boolean,
): ProgressCheckpoint {
  if (scanCompleted || percent >= PROGRESS_CHECKPOINTS[PROGRESS_CHECKPOINTS.length - 1]!.threshold) {
    return PROGRESS_CHECKPOINTS[PROGRESS_CHECKPOINTS.length - 1]!;
  }

  for (const checkpoint of PROGRESS_CHECKPOINTS) {
    if (checkpointState(checkpoint, percent, false) === "active") {
      return checkpoint;
    }
  }

  return PROGRESS_CHECKPOINTS[0]!;
}
