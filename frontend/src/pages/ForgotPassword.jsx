import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import VantaBirdsBackground from '../components/VantaBirdsBackground';
import api from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('');
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/api/auth/forgot-password', { email });
      setStatus(data.message || 'If this email exists, a reset link has been sent.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-vanta-shell fixed inset-0 top-16 overflow-y-auto px-3 py-3 sm:overflow-hidden sm:px-6 sm:py-4 lg:py-6">
      <VantaBirdsBackground />
      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-5rem)] max-w-5xl items-center gap-5 sm:h-[calc(100vh-5rem)] lg:-translate-y-4 lg:grid-cols-[1fr_420px] lg:gap-8">
        <section className="hidden lg:block">
          <p className="login-hero-eyebrow text-sm font-semibold uppercase">NutriTrack</p>
          <h1 className="login-hero-title mt-3 max-w-xl text-4xl font-bold tracking-normal">Get back to your nutrition dashboard securely.</h1>
          <p className="login-creator-credit mt-4 text-sm font-semibold">Password reset links expire in 15 minutes.</p>
        </section>

        <div className="login-card card mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-600 text-white">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Forgot Password</h2>
              <p className="muted mt-1">Enter your email to receive a reset link.</p>
            </div>
          </div>

          {status && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">{status}</div>}
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={event => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <button type="submit" className="btn-primary mt-6 w-full" disabled={loading}>
              {loading ? 'Sending link...' : 'Send reset link'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
            Remembered it? <Link to="/login" className="text-primary-600 hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
