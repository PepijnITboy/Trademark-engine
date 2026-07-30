/** Load EUIPO sandbox config from environment. */

export interface EuipoConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly apiBaseUrl: string;
  readonly tokenUrl: string;
}

const DEFAULT_API_BASE_URL = 'https://api-sandbox.euipo.europa.eu/trademark-search';
const DEFAULT_TOKEN_URL = 'https://auth-sandbox.euipo.europa.eu/oidc/accessToken';

function nonEmpty(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Read config from `process.env`. Throws if client id/secret are missing. */
export function loadEuipoConfig(
  env: Record<string, string | undefined> = process.env,
): EuipoConfig {
  const clientId = nonEmpty(env['EUIPO_CLIENT_ID']);
  const clientSecret = nonEmpty(env['EUIPO_CLIENT_SECRET']);
  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing EUIPO_CLIENT_ID / EUIPO_CLIENT_SECRET. Copy .env.example to .env and fill sandbox credentials from https://dev.euipo.europa.eu',
    );
  }

  return {
    clientId,
    clientSecret,
    apiBaseUrl: nonEmpty(env['EUIPO_API_BASE_URL']) ?? DEFAULT_API_BASE_URL,
    tokenUrl: nonEmpty(env['EUIPO_TOKEN_URL']) ?? DEFAULT_TOKEN_URL,
  };
}
