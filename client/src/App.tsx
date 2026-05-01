import { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Bots from './pages/Bots';
import Boards from './pages/Boards';
import ApiConfig from './pages/ApiConfig';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/bots" replace /> : <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/bots" element={<ProtectedRoute><Bots /></ProtectedRoute>} />
      <Route path="/boards" element={<ProtectedRoute><Boards /></ProtectedRoute>} />
      <Route path="/config" element={<ProtectedRoute><ApiConfig /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/bots" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
