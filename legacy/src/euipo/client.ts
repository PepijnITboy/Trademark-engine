import { loadEuipoConfig, type EuipoConfig } from './config.js';
import { EuipoOAuthClient } from './oauth-client.js';

/** Default fields for search — identity + word mark + status + pagination. */
export const DEFAULT_SEARCH_FIELDS =
  'trademarks(applicationNumber,markFeature,status,wordMarkSpecification,niceClasses,applicationDate,registrationDate,publications),page,size,totalElements,totalPages';

export interface EuipoSearchParams {
  /** RSQL query, e.g. `wordMarkSpecification.verbalElement==Nike` */
  readonly query?: string;
  readonly page?: number;
  /** OpenAPI requires size 10–100 on Default Plan. */
  readonly size?: number;
  readonly sort?: string;
  readonly fields?: string;
}

/**
 * High-level EUIPO Trademark Search reader (sandbox by default via .env).
 */
export class EuipoClient {
  private readonly oauth: EuipoOAuthClient;

  constructor(
    config?: EuipoConfig,
    options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
  ) {
    this.oauth = new EuipoOAuthClient(config ?? loadEuipoConfig(), options);
  }

  /** Lightweight connectivity check: token + search page. */
  async probe(): Promise<{ ok: true; totalElements: number } | { ok: false; error: string }> {
    try {
      const body = await this.search({ size: 10, page: 0 });
      const total =
        typeof body === 'object' &&
        body !== null &&
        'totalElements' in body &&
        typeof (body as { totalElements: unknown }).totalElements === 'number'
          ? (body as { totalElements: number }).totalElements
          : 0;
      return { ok: true, totalElements: total };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** GET `/trademarks` */
  async search(params: EuipoSearchParams = {}): Promise<unknown> {
    const size = Math.min(100, Math.max(10, params.size ?? 10));
    const searchParams: Record<string, string> = {
      page: String(params.page ?? 0),
      size: String(size),
      fields: params.fields ?? DEFAULT_SEARCH_FIELDS,
    };
    if (params.query) searchParams['query'] = params.query;
    if (params.sort) searchParams['sort'] = params.sort;
    return this.oauth.getJson('/trademarks', searchParams);
  }

  /** GET `/trademarks/{applicationNumber}` */
  async getTrademark(applicationNumber: string, fields?: string): Promise<unknown> {
    const searchParams: Record<string, string> = {};
    if (fields) searchParams['fields'] = fields;
    return this.oauth.getJson(`/trademarks/${encodeURIComponent(applicationNumber)}`, searchParams);
  }
}
