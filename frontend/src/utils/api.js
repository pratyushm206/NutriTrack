import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const BACKEND_WAKE_EVENT = 'nutritrack:backend-ready';
export const BACKEND_KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;
export const BACKEND_WAKE_RETRY_MS = 3000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000
});

const healthApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function wakeBackend() {
  const response = await healthApi.get('/health', {
    params: { t: Date.now() }
  });
  window.dispatchEvent(new Event(BACKEND_WAKE_EVENT));
  return response;
}

export default api;
