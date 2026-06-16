import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import api from '../utils/api';

export default function Onboarding() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    age: '',
    gender: 'male',
    weight_kg: '',
    height_cm: '',
    activity_level: 'sedentary',
    goal: 'maintain'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/api/profile', formData);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="card">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-600 text-white">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Complete Your Profile</h2>
            <p className="muted mt-1">We'll calculate your daily calorie and protein targets.</p>
          </div>
        </div>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Age</label>
              <input type="number" name="age" value={formData.age} onChange={handleChange} required className="input-field" min="1" max="120" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange} className="input-field">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Weight (kg)</label>
              <input type="number" step="0.1" name="weight_kg" value={formData.weight_kg} onChange={handleChange} required className="input-field" min="20" max="300" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Height (cm)</label>
              <input type="number" step="0.1" name="height_cm" value={formData.height_cm} onChange={handleChange} required className="input-field" min="50" max="300" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Activity Level</label>
            <select name="activity_level" value={formData.activity_level} onChange={handleChange} className="input-field">
              <option value="sedentary">Sedentary (little to no exercise)</option>
              <option value="light">Lightly active (light exercise 1-3 days/week)</option>
              <option value="moderate">Moderately active (moderate exercise 3-5 days/week)</option>
              <option value="active">Active (hard exercise 6-7 days/week)</option>
              <option value="very_active">Very Active (very hard exercise/physical job)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Goal</label>
            <select name="goal" value={formData.goal} onChange={handleChange} className="input-field">
              <option value="lose">Lose Weight</option>
              <option value="maintain">Maintain Weight</option>
              <option value="gain">Gain Muscle</option>
            </select>
          </div>

          <button type="submit" className="btn-primary w-full mt-6" disabled={loading}>
            {loading ? 'Calculating Targets...' : 'Calculate My Targets'}
          </button>
        </form>
      </div>
    </div>
  );
}
