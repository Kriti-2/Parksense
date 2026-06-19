import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No token received from OAuth provider');
      return;
    }
    loginWithToken(token)
      .then((user) => navigate(user.role === 'officer' ? '/' : '/congestion', { replace: true }))
      .catch(() => setError('Failed to complete sign-in'));
  }, [searchParams, loginWithToken, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-command-bg text-command-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-command-bg text-gray-400">
      Completing sign-in...
    </div>
  );
}
