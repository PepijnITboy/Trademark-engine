import type { EuipoConfig } from './config.js';
import {
  getSharedEuipoRateLimiter,
  type EuipoSharedRateLimiter,
} from './rate-limiter.js';

const OAUTH_SCOPE = 'uid';
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 30_000;

interface CachedToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

export interface EuipoOAuthClientOptions {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  /** Defaults to process-wide soft limiter (140/min, 24000/day). */
  readonly rateLimiter?: EuipoSharedRateLimiter | null;
}

/**
 * OAuth2 client-credentials + authenticated GETs for EUIPO Trademark Search.
 * Auth: `X-IBM-Client-Id` + Bearer (scope `uid`), per OpenAPI 1.1.0.
 *
 * Live Default Plan ceilings (from response headers):
 * - burst: 200 / minute (`x-burstlimit-limit`)
 * - daily: 25000 (`x-ratelimit-limit`)
 */
export class EuipoOAuthClient {
  private readonly config: EuipoConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly rateLimiter: EuipoSharedRateLimiter | null;
  private cachedToken: CachedToken | undefined;
  private tokenInflight: Promise<string> | undefined;

  constructor(config: EuipoConfig, options: EuipoOAuthClientOptions = {}) {
    this.config = config;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.rateLimiter =
      options.rateLimiter === null
        ? null
        : (options.rateLimiter ?? getSharedEuipoRateLimiter());
  }

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.accessToken;
    }
    if (this.tokenInflight) return this.tokenInflight;

    this.tokenInflight = this.fetchNewToken().finally(() => {
      this.tokenInflight = undefined;
    });
    return this.tokenInflight;
  }

  /** Drop cached bearer token (e.g. after HTTP 401). */
  invalidateAccessToken(): void {
    this.cachedToken = undefined;
  }

  /** Authenticated GET against Trademark Search (`path` relative to apiBaseUrl). */
  async getJson(
    path: string,
    searchParams: Readonly<Record<string, string>> = {},
  ): Promise<unknown> {
    return this.getJsonOnce(path, searchParams, true);
  }

  private async fetchNewToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: OAUTH_SCOPE,
    });

    const response = await this.fetchImpl(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`EUIPO OAuth token request failed (${response.status}): ${text.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw new Error('EUIPO OAuth token response missing access_token');
    }

    // FAQ: access token TTL is 2 hours (7200s).
    const expiresInMs = (json.expires_in ?? 7200) * 1000;
    this.cachedToken = {
      accessToken: json.access_token,
      expiresAt: Date.now() + Math.max(0, expiresInMs - TOKEN_EXPIRY_SAFETY_MARGIN_MS),
    };
    return this.cachedToken.accessToken;
  }

  private async getJsonOnce(
    path: string,
    searchParams: Readonly<Record<string, string>>,
    allowTokenRetry: boolean,
  ): Promise<unknown> {
    if (this.rateLimiter) {
      await this.rateLimiter.acquire();
    }

    const token = await this.getAccessToken();
    const url = new URL(path.replace(/^\//, ''), `${this.config.apiBaseUrl.replace(/\/$/, '')}/`);
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'X-IBM-Client-Id': this.config.clientId,
          'Accept-Language': 'en',
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`EUIPO request to ${path} timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 && allowTokenRetry) {
      this.invalidateAccessToken();
      return this.getJsonOnce(path, searchParams, false);
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After') ?? '60');
      const waitMs = Math.max(1_000, (Number.isFinite(retryAfter) ? retryAfter : 60) * 1000);
      throw new Error(`EUIPO ${path} failed (429): rate limited — retry-after ${Math.round(waitMs / 1000)}s`);
    }

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`EUIPO ${path} failed (${response.status}): ${text.slice(0, 300)}`);
    }

    return response.json();
  }
}
