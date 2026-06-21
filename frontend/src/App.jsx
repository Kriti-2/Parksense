import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import UserLayout from './layouts/UserLayout';
import PageLoader from './components/PageLoader';

// ── Lazy-load all pages so they're only fetched when visited ─────────────────
const Homepage = lazy(() => import('./pages/Homepage'));
const About = lazy(() => import('./pages/About'));
const Predict = lazy(() => import('./pages/Predict'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Corridors = lazy(() => import('./pages/Corridors'));
const LiveViolationReporter = lazy(() => import('./pages/LiveViolationReporter'));
const ShiftPlanner = lazy(() => import('./pages/ShiftPlanner'));
const CameraMonitor = lazy(() => import('./pages/CameraMonitor'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const UserCongestion = lazy(() => import('./pages/UserCongestion'));

function CorridorsRoute() {
  const { user } = useAuth();
  if (user?.role === 'officer') {
    return <DashboardLayout><Corridors /></DashboardLayout>;
  }
  return <UserLayout><Corridors /></UserLayout>;
}

function HomepageRoute() {
  const { user } = useAuth();
  if (user?.role === 'officer') {
    return <DashboardLayout><Homepage /></DashboardLayout>;
  }
  return <UserLayout><Homepage /></UserLayout>;
}

function AboutRoute() {
  const { user } = useAuth();
  if (user?.role === 'officer') {
    return <DashboardLayout><About /></DashboardLayout>;
  }
  return <UserLayout><About /></UserLayout>;
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<HomepageRoute />} />
                <Route path="/about" element={<AboutRoute />} />
                <Route path="/corridors" element={<CorridorsRoute />} />
              </Route>

              <Route element={<ProtectedRoute userOnly />}>
                <Route element={<UserLayout />}>
                  <Route path="/congestion" element={<UserCongestion />} />
                  <Route path="/reporter" element={<LiveViolationReporter />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute officerOnly />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/predict" element={<Predict />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/shift-planner" element={<ShiftPlanner />} />
                  <Route path="/monitor" element={<CameraMonitor />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
