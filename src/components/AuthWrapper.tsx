import React from 'react';
import { AuthProvider } from '../contexts/AuthContext';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}


