import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

export function setAuthToken(token) {
  if (token) {
    client.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common.Authorization;
  }
}

export const api = {
  login: (data) => client.post('/auth/login', data),
  register: (data) => client.post('/auth/register', data),
  getMe: () => client.get('/auth/me'),
  getCongestionPreview: () => client.get('/public/congestion-preview'),
  getNotices: () => client.get('/public/notices'),
  getHeatmap: (limit = 2000) => client.get('/heatmap', { params: { limit } }),
  getAnalytics: () => client.get('/analytics'),
  getPredictions: () => client.get('/predictions'),
  getSeverityQueue: (limit = 50) => client.get('/severity-queue', { params: { limit } }),
  getRecidivism: () => client.get('/recidivism'),
  getCorridors: () => client.get('/corridors'),
  getShiftPlanner: () => client.get('/shift-planner'),
  getWeather: () => client.get('/weather'),
  getHealth: () => client.get('/health'),
  getLiveStatus: () => client.get('/live/status'),
  ingestViolation: (data) => client.post('/ingest/violation', data),
  getChallans: (vehicleNumber) => client.get(`/public/challan-lookup/${vehicleNumber}`),
  chat: (data) => client.post('/chat/', data),
};

export const getGoogleOAuthUrl = () => `${API_BASE}/auth/google/login`;

export default client;
