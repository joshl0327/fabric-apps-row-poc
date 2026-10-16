import { resolveRayfinFunctionsBaseUrl } from '@microsoft/rayfin-local-dev';

import type { IAuthService } from './IAuthService';
import { RayfinAuthService } from './RayfinAuthService';
import { initRayfinClient } from './rayfinClient';

function isLocalBackendUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Read VITE_* env vars, initialize the Rayfin client, and return the right
 * auth service for the target backend.
 *
 * - Localhost API URL → backend-free LocalAuthService (DEV-only)
 * - Anything else     → {@link RayfinAuthService} (requires VITE_FABRIC_* vars)
 */
export async function bootstrapAuth(): Promise<IAuthService> {
  const apiUrl = import.meta.env.VITE_RAYFIN_API_URL || 'http://localhost:5168';
  const localDev = isLocalBackendUrl(apiUrl);
  const publishableKey = import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY;

  if (!publishableKey && !localDev) {
    throw new Error(
      'VITE_RAYFIN_PUBLISHABLE_KEY environment variable is required'
    );
  }

  const client = await initRayfinClient({
    baseUrl: apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`,
    publishableKey: publishableKey ?? 'local-dev-key',
    localDev,
    functionsBaseUrl: resolveRayfinFunctionsBaseUrl(),
    runtimeConfig: {
      workspaceId: import.meta.env.VITE_FABRIC_WORKSPACE_ID,
      itemId: import.meta.env.VITE_FABRIC_ITEM_ID,
      portalUrl: import.meta.env.VITE_FABRIC_PORTAL_URL,
    },
  });

  if (localDev && import.meta.env.DEV) {
    // Load the local stub only in dev so it stays out of production bundles.
    const { LocalAuthService } = await import('./LocalAuthService');
    return new LocalAuthService();
  }

  const {
    workspaceId,
    itemId: projectId,
    portalUrl: fabricPortalUrl,
  } = client.runtimeConfig ?? {};

  if (!workspaceId || !projectId || !fabricPortalUrl) {
    throw new Error(
      'Missing required Fabric config. Set VITE_FABRIC_WORKSPACE_ID, VITE_FABRIC_ITEM_ID, and VITE_FABRIC_PORTAL_URL.'
    );
  }

  return new RayfinAuthService(client, {
    workspaceId,
    projectId,
    fabricPortalUrl,
    returnOrigin: window.location.origin,
  });
}
