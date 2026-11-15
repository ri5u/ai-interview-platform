import { useState, useRef, useEffect } from 'react';

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
      const response = await fetch(`http://localhost:8080${endpoint}`, {
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
    <dialog ref={dialogRef} 
            onCancel={(e) => e.preventDefault()} 
            onClose={() => {
              if(dialogRef.current && !dialogRef.current.open){
                dialogRef.current.showModal();
              }
            }}>
      <h3>{isSignUp ? 'Candidate Sign Up' : 'Candidate Log In'}</h3>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="auth-username">Username: </label>
          <input
            id="auth-username"
            type="text"
            value={username}
            disabled={loading}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="auth-password">Password: </label>
          <input
            id="auth-password"
            type="password"
            value={password}
            disabled={loading}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {statusMessage && <p style={{ color: 'red' }}>{statusMessage}</p>}

        <div>
          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Log In'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setIsSignUp(!isSignUp);
              setStatusMessage('');
            }}
          >
            {isSignUp ? 'Switch to Log In' : 'Switch to Sign Up'}
          </button>
        </div>
      </form>
    </dialog>
  );
}