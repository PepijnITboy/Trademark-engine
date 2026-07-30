import { describe, expect, it, vi } from 'vitest';
import { EuipoClient } from './client.js';
import type { EuipoConfig } from './config.js';

const config: EuipoConfig = {
  clientId: 'test-client',
  clientSecret: 'test-secret',
  apiBaseUrl: 'https://api-sandbox.example/trademark-search',
  tokenUrl: 'https://auth-sandbox.example/oidc/accessToken',
};

describe('EuipoClient', () => {
  it('acquires a token and searches trademarks', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/oidc/accessToken')) {
        expect(init?.method).toBe('POST');
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      expect(url).toContain('/trademarks');
      expect((init?.headers as Record<string, string>)['X-IBM-Client-Id']).toBe('test-client');
      expect((init?.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
      return new Response(
        JSON.stringify({
          trademarks: [{ applicationNumber: '018123456', status: 'REGISTERED' }],
          totalElements: 1,
          page: 0,
          size: 10,
          totalPages: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const client = new EuipoClient(config, { fetchImpl: fetchImpl as unknown as typeof fetch });
    const probe = await client.probe();
    expect(probe).toEqual({ ok: true, totalElements: 1 });
    expect(fetchImpl).toHaveBeenCalled();
  });
});
