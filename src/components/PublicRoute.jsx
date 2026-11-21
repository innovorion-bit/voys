import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { LoadingScreen } from './LoadingScreen';

/**
 * Route wrapper that redirects already-authenticated users to the main app,
 * preventing logged-in users from seeing login/register forms or having window resized.
 */
export const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    const destination = location.state?.from?.pathname || '/channel/home';
    return <Navigate to={destination} replace />;
  }

  return children;
};

