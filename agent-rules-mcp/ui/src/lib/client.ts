import axios from 'axios';

export const api = axios.create({ baseURL: '/', headers: { accept: 'application/json' } });

api.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isCancel(error)) return Promise.reject(error);
  if (!axios.isAxiosError(error)) return Promise.reject(error);
  const method = error.config?.method?.toUpperCase() ?? 'GET';
  const path = error.config?.url ?? '/';
  return Promise.reject(
    new Error(`${method} ${path} → ${error.response?.status ?? 'network error'}`),
  );
});
