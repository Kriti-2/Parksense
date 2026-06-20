import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Homepage from './pages/Homepage';
import About from './pages/About';
import Predict from './pages/Predict';
import Analytics from './pages/Analytics';
import Corridors from './pages/Corridors';
import LiveViolationReporter from './pages/LiveViolationReporter';
import ShiftPlanner from './pages/ShiftPlanner';
import CameraMonitor from './pages/CameraMonitor';
import Login from './pages/Login';
import Register from './pages/Register';
import UserCongestion from './pages/UserCongestion';
import UserLayout from './layouts/UserLayout';


function CorridorsRoute() {
  const { user } = useAuth();
  if (user?.role === 'officer') {
    return (
      <DashboardLayout>
        <Corridors />
      </DashboardLayout>
    );
  }
  return (
    <UserLayout>
      <Corridors />
    </UserLayout>
  );
}

function HomepageRoute() {
  const { user } = useAuth();
  if (user?.role === 'officer') {
    return (
      <DashboardLayout>
        <Homepage />
      </DashboardLayout>
    );
  }
  return (
    <UserLayout>
      <Homepage />
    </UserLayout>
  );
}

function AboutRoute() {
  const { user } = useAuth();
  if (user?.role === 'officer') {
    return (
      <DashboardLayout>
        <About />
      </DashboardLayout>
    );
  }
  return (
    <UserLayout>
      <About />
    </UserLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
}
