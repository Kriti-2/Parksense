import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
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
  forgotPassword: (data) => client.post('/auth/forgot-password', data),
  verifyOTP: (data) => client.post('/auth/verify-otp', data),
  resetPassword: (data) => client.post('/auth/reset-password', data),
  getMe: () => client.get('/auth/me'),
  getCongestionPreview: () => client.get('/public/congestion-preview'),
  getNotices: () => client.get('/public/notices'),
  getTrafficRoutes: () => client.get('/public/traffic-routes'),
  getHeatmap: (limit = 2000) => client.get('/heatmap', { params: { limit } }),
  getAnalytics: () => client.get('/analytics'),
  getPredictions: () => client.get('/predictions'),
  getShortTermPredictions: () => client.get('/predictions/short-term'),
  getSeverityQueue: (limit = 50) => client.get('/severity-queue', { params: { limit } }),
  getRecidivism: () => client.get('/recidivism'),
  getCorridors: () => client.get('/corridors'),
  getShiftPlanner: () => client.get('/shift-planner'),
  getOfficers: () => client.get('/shift-planner/officers'),
  dispatchOfficer: (data) => client.post('/shift-planner/dispatch', data),
  toggleAutoDispatch: (enabled) => client.post('/shift-planner/toggle-auto-dispatch', { enabled }),
  getWeather: () => client.get('/weather'),
  getHealth: () => client.get('/health'),
  getLiveStatus: () => client.get('/live/status'),
  ingestViolation: (data) => client.post('/ingest/violation', data),
  getChallans: (vehicleNumber) => client.get(`/public/challan-lookup/${vehicleNumber}`),
  chat: (data) => client.post('/chat/', data),
  translate: (text, targetLang) => client.post('/public/translate', { text, target_lang: targetLang }),
  calculateRoute: (startLat, startLng, endLat, endLng) => client.get('/public/calculate-route', { params: { start_lat: startLat, start_lng: startLng, end_lat: endLat, end_lng: endLng } }),
  recordCommute: (co2Saved, fuelSaved, timeSaved) => client.post('/public/record-commute', { co2_saved: co2Saved, fuel_saved: fuelSaved, time_saved: timeSaved }),
};

export default client;
