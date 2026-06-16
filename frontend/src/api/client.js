import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

export const api = {
  getHeatmap: (limit = 2000) => client.get('/heatmap', { params: { limit } }),
  getAnalytics: () => client.get('/analytics'),
  getPredictions: () => client.get('/predictions'),
  getSeverityQueue: (limit = 50) => client.get('/severity-queue', { params: { limit } }),
  getRecidivism: () => client.get('/recidivism'),
  getCorridors: () => client.get('/corridors'),
  getShiftPlanner: () => client.get('/shift-planner'),
  getHealth: () => client.get('/health'),
};

export default client;
