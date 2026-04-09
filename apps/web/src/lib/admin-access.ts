const ADMIN_KEY_STORAGE_KEY = "twincoach.adminKey";
const ADMIN_KEY_COOKIE_NAME = "twincoachAdminKey";

export function getAdminKey() {
  if (typeof window === "undefined") {
    return "";
  }

  const sessionKey = window.sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY);

  if (sessionKey) {
    return sessionKey;
  }

  return readCookieValue(ADMIN_KEY_COOKIE_NAME);
}

export function hasAdminKey() {
  return getAdminKey().length > 0;
}

export function setAdminKey(adminKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, adminKey);
  document.cookie = `${ADMIN_KEY_COOKIE_NAME}=${encodeURIComponent(adminKey)}; Path=/; SameSite=Strict`;
}

export function clearAdminKey() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
  document.cookie = `${ADMIN_KEY_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Strict`;
}

function readCookieValue(name: string) {
  if (typeof document === "undefined") {
    return "";
  }

  const prefix = `${name}=`;
  const cookies = document.cookie.split(";").map((part) => part.trim());
  const match = cookies.find((part) => part.startsWith(prefix));

  if (!match) {
    return "";
  }

  return decodeURIComponent(match.slice(prefix.length));
}
