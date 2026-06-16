import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { UserPlus } from 'lucide-react';
import VantaBirdsBackground from '../components/VantaBirdsBackground';
import api from '../utils/api';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const { data } = await api.post('/api/auth/signup', { name, email, password });
      login(data.user, data.token);
      navigate('/onboarding');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-vanta-shell fixed inset-0 top-16 overflow-y-auto px-3 py-4 sm:px-6 lg:py-6">
      <VantaBirdsBackground />
      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-5rem)] max-w-5xl items-center gap-6 lg:grid-cols-[0.9fr_420px] lg:gap-10">
        <section className="hidden lg:block">
          <p className="login-hero-eyebrow text-sm font-semibold uppercase">Start in under a minute</p>
          <h1 className="login-hero-title mt-3 max-w-xl text-4xl font-bold tracking-normal">Create your nutrition tracker and set personal targets.</h1>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            <div className="login-feature-tile rounded-lg p-4 backdrop-blur-xl">
              <p className="text-2xl font-bold text-teal-500 dark:text-teal-200">AI</p>
              <p className="login-feature-label mt-1 text-sm">food assist</p>
            </div>
            <div className="login-feature-tile rounded-lg p-4 backdrop-blur-xl">
              <p className="text-2xl font-bold text-sky-500 dark:text-sky-200">TDEE</p>
              <p className="login-feature-label mt-1 text-sm">targets</p>
            </div>
            <div className="login-feature-tile rounded-lg p-4 backdrop-blur-xl">
              <p className="text-2xl font-bold text-amber-500 dark:text-amber-200">7</p>
              <p className="login-feature-label mt-1 text-sm">day view</p>
            </div>
          </div>
        </section>

      <div className="login-card card mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-600 text-white">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Create Account</h2>
            <p className="muted mt-1">Set up your tracker.</p>
          </div>
        </div>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Name</label>
            <input 
              type="text" 
              className="input-field"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
            <input 
              type="email" 
              className="input-field"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Password</label>
            <input 
              type="password" 
              className="input-field"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength="6"
            />
          </div>
          <button type="submit" className="btn-primary w-full mt-6" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account? <Link to="/login" className="text-primary-600 hover:underline">Login</Link>
        </p>
      </div>
      </div>
    </div>
  );
}
