import { useState, useRef, useEffect } from 'react';
const API_BASE = import.meta.env.VITE_API_URL || '';

export default function AuthDialog({ onAuthSuccess }) {
  const dialogRef = useRef(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Open the native modal automatically on mount
    dialogRef.current?.showModal();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatusMessage('');

    const cleanUsername = username.trim();
    if (!username || !password.trim()) {
      setStatusMessage('Enter both username and password.');
      return;
    }

    if (isSignUp) {
      if (cleanUsername.length < 3 || cleanUsername.length > 20) {
        setStatusMessage('Username must be between 3 and 20 characters.');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
        setStatusMessage('Username can only contain letters, numbers, and underscores.');
        return;
      }
      if (password.length < 6 || password.length > 72) {
        setStatusMessage('Password must be between 6 and 72 characters.');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Close modal and notify parent App
      dialogRef.current?.close();
      onAuthSuccess(data.user);
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2 className="modal-title">
          {isSignUp ? 'Create Candidate Account' : 'Welcome Back'}
        </h2>
        <p className="modal-subtitle">
          {isSignUp
            ? 'Set up your profile to enter the live mock interview room.'
            : 'Sign in to configure your track and start your interview.'}
        </p>

        <form onSubmit={handleSubmit} className="form-stack">
          <div className="field-group">
            <label htmlFor="auth-username" className="field-label">
              Username
            </label>
            <input
              id="auth-username"
              type="text"
              className="field-input"
              placeholder="e.g. dev_candidate"
              value={username}
              disabled={loading}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label htmlFor="auth-password" className="field-label">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              className="field-input"
              placeholder="••••••••"
              value={password}
              disabled={loading}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {statusMessage && <div className="form-error">{statusMessage}</div>}

          <div className="modal-actions">
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Log In'}
            </button>
            <button
              type="button"
              disabled={loading}
              className="btn btn-ghost"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setStatusMessage('');
              }}
            >
              {isSignUp ? 'Already have an account? Log In' : 'New here? Create an Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

}