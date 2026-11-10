import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

/**
 * Route wrapper that redirects already-authenticated users to the main app,
 * preventing logged-in users from seeing login/register forms or having window resized.
 */
export const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0c0c0e] rounded-2xl border border-white/10 text-gray-300 select-none">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    const destination = location.state?.from?.pathname || '/channel/home';
    return <Navigate to={destination} replace />;
  }

  return children;
};

