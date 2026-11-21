import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { resizeToMainWindow } from '../utils/windowManager';
import { LoadingScreen } from './LoadingScreen';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      resizeToMainWindow();
    }
  }, [isAuthenticated]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export { PublicRoute } from './PublicRoute';

