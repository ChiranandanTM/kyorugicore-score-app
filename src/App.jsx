import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import RoomEntry from './pages/RoomEntry';
import ScoringUI from './pages/ScoringUI';
import OrientationWarning from './components/OrientationWarning';

export default function App() {
  const isLoggedIn = useStore((s) => s.isLoggedIn);
  const logout = useStore((s) => s.logout);

  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('isLoggedIn');
      sessionStorage.removeItem('currentRoomId');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [logout]);

  return (
    <BrowserRouter>
      <OrientationWarning />
      <Routes>
        <Route
          path="/"
          element={isLoggedIn ? <Navigate to="/scoring" replace /> : <RoomEntry />}
        />
        <Route
          path="/scoring"
          element={isLoggedIn ? <ScoringUI /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
