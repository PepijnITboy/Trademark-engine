/**
 * Shared EUIPO rate limiter — Default Plan hard ceilings from live headers:
 *   x-burstlimit-limit: 200 / minute
 *   x-ratelimit-limit:  25000 / day
 */
export const EUIPO_HARD_BURST_PER_MINUTE = 200;
export const EUIPO_HARD_DAILY = 25_000;

/** Soft caps leave headroom under the gateway firewall. */
export const EUIPO_SOFT_BURST_PER_MINUTE = 140;
export const EUIPO_SOFT_DAILY = 24_000;

export class EuipoRateLimitError extends Error {
  constructor(
    readonly kind: 'daily' | 'burst',
    message: string,
  ) {
    super(message);
    this.name = 'EuipoRateLimitError';
  }
}

export class EuipoSharedRateLimiter {
  private readonly perMinute: number;
  private readonly perDay: number;
  private timestamps: number[] = [];
  private dayKey = '';
  private dayCount = 0;
  private chain: Promise<void> = Promise.resolve();

  constructor(
    perMinute = EUIPO_SOFT_BURST_PER_MINUTE,
    perDay = EUIPO_SOFT_DAILY,
  ) {
    this.perMinute = Math.min(perMinute, EUIPO_HARD_BURST_PER_MINUTE);
    this.perDay = Math.min(perDay, EUIPO_HARD_DAILY);
  }

  /** Serialize acquires so concurrent workers share one budget. */
  acquire(): Promise<void> {
    const run = this.chain.then(() => this.acquireInternal());
    // Prevent unhandled rejection from breaking the chain
    this.chain = run.catch(() => undefined);
    return run;
  }

  get stats(): { perMinute: number; dayCount: number; dayKey: string } {
    this.prune(Date.now());
    return { perMinute: this.timestamps.length, dayCount: this.dayCount, dayKey: this.dayKey };
  }

  private async acquireInternal(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.rollDay(now);
      this.prune(now);

      if (this.dayCount >= this.perDay) {
        throw new EuipoRateLimitError(
          'daily',
          `EUIPO daily soft cap reached (${this.perDay}/day). Resume tomorrow.`,
        );
      }

      if (this.timestamps.length < this.perMinute) {
        this.timestamps.push(now);
        this.dayCount += 1;
        return;
      }

      const oldest = this.timestamps[0] ?? now;
      const waitMs = Math.max(50, 60_000 - (now - oldest) + 25);
      await sleep(waitMs);
    }
  }

  private rollDay(now: number): void {
    const key = new Date(now).toISOString().slice(0, 10);
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.dayCount = 0;
    }
  }

  private prune(now: number): void {
    const cutoff = now - 60_000;
    while (this.timestamps.length > 0 && (this.timestamps[0] ?? 0) <= cutoff) {
      this.timestamps.shift();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Process-wide singleton for all scrape workers in this Node process. */
let shared: EuipoSharedRateLimiter | undefined;

export function getSharedEuipoRateLimiter(): EuipoSharedRateLimiter {
  if (!shared) shared = new EuipoSharedRateLimiter();
  return shared;
}
