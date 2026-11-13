import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'cs-token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) onUnauthorized();
    return Promise.reject(err);
  }
);

/** Human-readable error message from an axios error. */
export const errMsg = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.message || (err?.code === 'ECONNABORTED' ? 'Request timed out' : err?.message) || fallback;

/** Field errors map { field: message } from a 422 response. */
export const fieldErrors = (err) =>
  Object.fromEntries((err?.response?.data?.errors || []).map((e) => [e.field, e.message]));

/** Downloads a binary API response (PDF / Excel) as a file. */
export async function download(url, params, fallbackName = 'download') {
  const res = await api.get(url, { params, responseType: 'blob' });
  const cd = res.headers['content-disposition'] || '';
  const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

/** Resolves an uploaded asset path (/uploads/..) against the API origin. */
export function assetUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//.test(url) || url.startsWith('data:')) return url;
  if (API_URL.startsWith('http')) return new URL(API_URL).origin + url;
  return url;
}

export default api;
