// Access tokens live only in memory. The refresh token is held by the API's
// HttpOnly cookie and is intentionally never exposed to JavaScript.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
