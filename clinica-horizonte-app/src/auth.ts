import Keycloak from 'keycloak-js';

export const auth = new Keycloak({
  url: import.meta.env.VITE_OIDC_URL,
  realm: import.meta.env.VITE_OIDC_REALM,
  clientId: import.meta.env.VITE_OIDC_CLIENT_ID,
});

let initialization: Promise<boolean> | undefined;
export function initializeAuth() {
  initialization ??= auth.init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false });
  return initialization;
}
export function hasRole(...roles: string[]) { return roles.some((role) => auth.hasRealmRole(role)); }
export async function accessToken() {
  if (!auth.authenticated) throw new Error('La sesión no está autenticada.');
  await auth.updateToken(30);
  return auth.token ?? '';
}
