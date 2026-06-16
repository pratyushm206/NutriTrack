import { useState } from 'react';
import { Activity, Edit3, X } from 'lucide-react';
import api from '../utils/api';
import NutriAILogo from './NutriAILogo';

export default function ExerciseLogger({ date, onLogAdded }) {
  const [customDescription, setCustomDescription] = useState('');
  const [durationMins, setDurationMins] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyzeCustomExercise = async () => {
    if (!customDescription) return;
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/api/exercise/analyze', {
        description: customDescription,
        duration_mins: durationMins ? parseInt(durationMins) : undefined
      });
      setPreviewData(data);
    } catch (err) {
      setError(getFriendlyExerciseError(err));
    } finally {
      setLoading(false);
    }
  };

  const savePreview = async () => {
    if (!previewData) return;
    await saveExercise({
      exercise_name: previewData.exercise_name,
      duration_mins: parseInt(previewData.duration_mins || durationMins),
      calories_burned: parseInt(previewData.calories_burned)
    }, previewData);
  };

  const saveExercise = async (payload, analysis) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/api/exercise/log', {
        date,
        ...payload
      });
      onLogAdded({ ...data, analysis });
      reset();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save exercise');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setDurationMins('');
    setCustomDescription('');
    setPreviewData(null);
  };

  return (
    <div className="card">
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-teal-300/20 bg-teal-300/10 text-teal-300 shadow-[0_0_24px_rgba(45,212,191,0.16)]">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="section-title">Log Exercise</h3>
            <p className="muted mt-1">AI burn estimate</p>
          </div>
        </div>
        <div className="flex shrink-0 rounded-lg border border-slate-700/60 bg-slate-950/40 p-1">
          <button type="button" aria-label="Custom exercise" title="Edit" onClick={() => setPreviewData(null)} className="icon-button h-9 w-9 bg-white text-primary-600 shadow-sm dark:bg-[#1b2530] dark:text-primary-300"><Edit3 size={18} /></button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-400/30 bg-red-950/35 p-3 text-sm font-medium text-red-200">{error}</div>}

      {!previewData && (
        <div className="space-y-3">
          <textarea
            className="input-field min-h-24 py-3"
              placeholder="e.g. climbed 6 floors, 20 pushups, or 35 minutes of intense dance practice"
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="number"
              placeholder="Duration (optional)"
              className="input-field"
              value={durationMins}
              onChange={(e) => setDurationMins(e.target.value)}
            />
            <button className="btn-primary" onClick={analyzeCustomExercise} disabled={loading || !customDescription}>
              {loading ? <span className="inline-flex items-center gap-2"><NutriAILogo className="nutriai-button-logo" /> Analyzing...</span> : 'Analyze'}
            </button>
          </div>
        </div>
      )}

      {previewData && (
        <div className="rounded-lg border border-slate-700/70 bg-slate-950/35 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-bold text-teal-300">Exercise Estimate</h4>
            <button onClick={() => setPreviewData(null)} className="icon-button h-8 w-8 text-slate-400 hover:text-red-500" aria-label="Clear exercise estimate"><X size={18} /></button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniMetric label="Calories" value={`${Math.round(previewData.calories_burned || 0)} kcal`} />
            <MiniMetric label="Fat burn" value={`${Math.round(previewData.fat_burn_g || 0)}g`} />
            <MiniMetric label="Carb burn" value={`${Math.round(previewData.carbs_burn_g || 0)}g`} />
            <MiniMetric label="Intensity" value={previewData.intensity} />
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-300">{previewData.summary}</p>

          {Array.isArray(previewData.breakdown) && (
            <div className="mt-4 divide-y divide-slate-800 rounded-lg border border-slate-800/80 bg-slate-950/45">
              {previewData.breakdown.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="font-bold text-slate-100">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          <button className="btn-primary mt-4 w-full" onClick={savePreview} disabled={loading}>
            {loading ? 'Saving...' : 'Confirm & Log'}
          </button>
        </div>
      )}
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/45 p-3">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="neon-text mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function getFriendlyExerciseError(err) {
  const message = err.response?.data?.error || err.message || '';

  if (message.includes('503') || message.toLowerCase().includes('high demand')) {
    return 'Gemini is busy right now. Try analyzing again in a moment.';
  }

  if (message.includes('429') || message.toLowerCase().includes('quota')) {
    return 'Gemini quota is temporarily unavailable for this project.';
  }

  return message || 'Failed to analyze exercise';
}
