import { useState, useRef } from 'react';
import { Beef, Camera, Edit3, Flame, Leaf, Sparkles, Wheat, X } from 'lucide-react';
import api from '../utils/api';
import NutriAILogo from './NutriAILogo';

const MAX_ANALYSIS_IMAGE_DIMENSION = 1280;
const ANALYSIS_IMAGE_QUALITY = 0.82;
const MAX_ANALYSIS_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_ANALYSIS_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function FoodLogger({ date, onLogAdded }) {
  const [mode, setMode] = useState('text'); // text, photo, manual
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoName, setPhotoName] = useState('');
  const [photoPayload, setPhotoPayload] = useState(null);
  
  const [previewData, setPreviewData] = useState(null); // {name, calories, protein_g}
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  
  const fileInputRef = useRef(null);

  const handleTextAnalyze = async () => {
    if (!description) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/api/food/analyze-text', { description });
      setPreviewData(data);
      setActiveItemIndex(0);
    } catch (err) {
      setError(err.response?.data?.error || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const { dataUrl, base64Image, mimeType } = await prepareImageForAnalysis(file);
      setPhotoPreview(dataUrl);
      setPhotoName(file.name);
      setPhotoPayload({ base64Image, mimeType });

      await analyzePhoto({ base64Image, mimeType });
    } catch (err) {
      setError(err.message || 'Failed to prepare image. Try a smaller JPEG photo or enter it manually.');
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const analyzePhoto = async (payload = photoPayload) => {
    if (!payload) return;
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/api/food/analyze-photo', payload);
      setPreviewData(data);
      setActiveItemIndex(0);
    } catch (err) {
      setError(getFriendlyAnalysisError(err, 'Photo analysis failed. You can try again in a moment or enter it manually.'));
    } finally {
      setLoading(false);
    }
  };

  const saveLog = async () => {
    if (!previewData || !previewData.name || previewData.calories == null) return;
    setLoading(true);
    try {
      const { data } = await api.post('/api/food/log', {
        date,
        food_name: previewData.name,
        calories: previewData.calories,
        protein_g: previewData.protein_g,
        meal_type: 'snack' // default
      });
      onLogAdded({ ...data, analysis: previewData });
      resetLogger();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save log');
    } finally {
      setLoading(false);
    }
  };

  const resetLogger = () => {
    setDescription('');
    setPreviewData(null);
    setActiveItemIndex(0);
    setPhotoPreview(null);
    setPhotoName('');
    setPhotoPayload(null);
    setMode('text');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearPhoto = () => {
    setPhotoPreview(null);
    setPhotoName('');
    setPhotoPayload(null);
    setPreviewData(null);
    setActiveItemIndex(0);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="card">
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="section-title">Log Food</h3>
          <p className="muted mt-1">{formatMode(mode)}</p>
        </div>
        <div className="flex shrink-0 rounded-lg border border-slate-700/60 bg-slate-950/40 p-1">
          <button type="button" aria-label="Analyze food text" title="Text" onClick={() => setMode('text')} className={`icon-button h-9 w-9 ${mode === 'text' ? 'bg-white text-primary-600 shadow-sm dark:bg-[#1b2530] dark:text-primary-300' : ''}`}><Edit3 size={18} /></button>
          <button type="button" aria-label="Analyze food photo" title="Capture" onClick={() => setMode('photo')} className={`icon-button h-9 w-9 ${mode === 'photo' ? 'bg-white text-primary-600 shadow-sm dark:bg-[#1b2530] dark:text-primary-300' : ''}`}><Camera size={18} /></button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-400/30 bg-red-950/35 p-3 text-sm font-medium text-red-200">{error}</div>}

      {!previewData ? (
        <div className="space-y-4">
          {mode === 'text' && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input 
                type="text" 
                placeholder="e.g. 2 paneer parathas with butter" 
                className="input-field flex-1"
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTextAnalyze()}
              />
              <button className="btn-primary" onClick={handleTextAnalyze} disabled={loading}>
                {loading ? '...' : 'Analyze'}
              </button>
            </div>
          )}

          {mode === 'photo' && (
            <div className="rounded-lg border border-dashed border-teal-300/28 bg-[#172033] p-3 transition-colors hover:border-teal-300/70 hover:bg-[#123440]">
              {photoPreview ? (
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-lg border border-slate-700/70 bg-slate-950/40">
                    <img src={photoPreview} alt={photoName || 'Selected food'} className="h-64 w-full object-contain" />
                    {loading && (
                      <div className="food-ai-loading absolute inset-x-0 bottom-0 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-white">
                        <NutriAILogo />
                        <span>Analyzing image...</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="truncate text-sm font-medium text-slate-300">{photoName}</p>
                    <div className="flex flex-wrap gap-2">
                      {error && <button type="button" className="btn-primary h-10" onClick={() => analyzePhoto()} disabled={loading}>Retry</button>}
                      <button type="button" className="btn-secondary h-10" onClick={() => fileInputRef.current?.click()} disabled={loading}>Change</button>
                      <button type="button" className="btn-secondary h-10 text-red-600 hover:text-red-700 dark:text-red-300" onClick={clearPhoto} disabled={loading}>Remove</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button type="button" className="flex min-h-40 w-full flex-col items-center justify-center rounded-lg text-center sm:min-h-48" onClick={() => fileInputRef.current?.click()}>
                  <Camera className="mb-2 text-teal-300" size={32} />
                  <span className="text-sm font-bold text-slate-200">Upload a food photo</span>
                </button>
              )}
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handlePhotoUpload}
              />
            </div>
          )}

          {mode === 'manual' && (
            <div className="space-y-3">
              <input type="text" placeholder="Food Name" className="input-field" onChange={e => setPreviewData(prev => ({...prev, name: e.target.value}))} />
              <div className="grid gap-2 sm:grid-cols-2">
                <input type="number" placeholder="Calories" className="input-field" onChange={e => setPreviewData(prev => ({...prev, calories: e.target.value}))} />
                <input type="number" placeholder="Protein (g)" className="input-field" onChange={e => setPreviewData(prev => ({...prev, protein_g: e.target.value}))} />
              </div>
              <button className="btn-primary w-full" onClick={() => saveLog()}>Save</button>
            </div>
          )}
        </div>
      ) : (
        <div className="food-estimate-panel">
          {photoPreview && (
            <div className="food-estimate-photo">
              <img src={photoPreview} alt={photoName || 'Selected food'} className="h-56 w-full object-contain" />
            </div>
          )}
          <div className="food-estimate-top">
            <div>
              <div className="food-estimate-kicker">
                <Sparkles className="h-4 w-4" />
                Nutrition Estimate
              </div>
              <h4 className="food-estimate-title">{previewData.name || 'Meal estimate'}</h4>
              <p className="food-estimate-subtitle">Review the estimate, adjust anything, then log it.</p>
            </div>
            <button onClick={clearPhoto} className="icon-button h-9 w-9 text-slate-400 hover:text-red-500" aria-label="Clear food estimate"><X size={18} /></button>
          </div>
          
          <div className="food-estimate-edit-grid">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-400">Food</label>
              <input type="text" className="input-field py-2 text-sm" value={previewData.name || ''} onChange={e => setPreviewData({...previewData, name: e.target.value})} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-400">Calories</label>
              <input type="number" className="input-field py-2 text-sm" value={previewData.calories || ''} onChange={e => setPreviewData({...previewData, calories: parseInt(e.target.value) || 0})} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-400">Protein (g)</label>
              <input type="number" className="input-field py-2 text-sm" value={previewData.protein_g || ''} onChange={e => setPreviewData({...previewData, protein_g: parseInt(e.target.value) || 0})} />
            </div>
          </div>

          <MealAnalysis
            analysis={previewData}
            activeItemIndex={activeItemIndex}
            setActiveItemIndex={setActiveItemIndex}
          />
          
          <div className="food-estimate-actions">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Ready to add</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{previewData.calories || 0} kcal · {previewData.protein_g || 0}g protein</p>
            </div>
            <button className="btn-primary min-w-44" onClick={saveLog} disabled={loading}>
              {loading ? 'Saving...' : 'Confirm & Log'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MealAnalysis({ analysis, activeItemIndex, setActiveItemIndex }) {
  const items = Array.isArray(analysis.items) ? analysis.items : [];
  const facts = Array.isArray(analysis.nutrition_facts) ? analysis.nutrition_facts : [];
  const activeItem = items[activeItemIndex] || items[0];
  const macros = getMacroSummary(analysis, activeItem);
  const smartNote = getSmartFoodNote(analysis, facts);

  if (!items.length && !analysis.health_analysis && !facts.length) {
    return (
      <div className="food-macro-grid">
        {macros.map(macro => <MacroTile key={macro.label} {...macro} />)}
      </div>
    );
  }

  return (
    <div className="food-analysis-stack">
      <div className="food-macro-grid">
        {macros.map(macro => <MacroTile key={macro.label} {...macro} />)}
      </div>

      {items.length > 0 && (
        <section className="food-analysis-section">
          <div className="food-section-heading">
            <h5>Detected Items</h5>
            <span>{items.length} found</span>
          </div>
          <div className="food-detected-grid">
            {items.map((item, index) => (
              <button
                type="button"
                key={`${item.name}-${index}`}
                className={`food-item-card ${index === activeItemIndex ? 'food-item-card-active' : ''}`}
                onClick={() => setActiveItemIndex(index)}
              >
                <div>
                  <p className="food-item-name">{item.name}</p>
                  <p className="food-item-qty">{item.quantity || 'estimated portion'}</p>
                </div>
                <span>{Math.round(item.calories || 0)} kcal</span>
              </button>
            ))}
          </div>
          {activeItem && (
            <div className="food-item-focus">
              <div>
                <p className="food-item-focus-name">{activeItem.name}</p>
                <p className="food-item-focus-qty">{activeItem.quantity || 'AI-estimated serving'}</p>
              </div>
              <div className="food-item-focus-macros">
                <span>Protein {Math.round(activeItem.protein_g || 0)}g</span>
                <span>Carbs {Math.round(activeItem.carbs_g || 0)}g</span>
                <span>Fat {Math.round(activeItem.fat_g || 0)}g</span>
              </div>
            </div>
          )}
        </section>
      )}

      {analysis.health_analysis && (
        <section className="food-analysis-section food-health-card">
          <div className="food-section-heading">
            <h5>Health Analysis</h5>
            <Leaf className="h-4 w-4" />
          </div>
          <p>{analysis.health_analysis}</p>
        </section>
      )}

      {smartNote && (
        <div className="food-smart-note">
          <Sparkles className="h-4 w-4" />
          <p>{smartNote}</p>
        </div>
      )}

      {facts.length > 0 && (
        <section className="food-analysis-section food-facts-card">
          <div className="food-section-heading food-facts-toggle">
            <h5><span className="food-section-dot" />Nutrition Facts</h5>
          </div>
          <div className="food-facts-list">
            {facts.map((fact, index) => (
              <div key={`${fact.label}-${index}`} className="food-fact-row">
                <span>{fact.label}</span>
                <strong className={`food-fact-${getFactTone(fact.label)}`}>{fact.value}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MacroTile({ icon: Icon, label, value, tone, percent }) {
  return (
    <div className={`food-macro-tile food-macro-${tone}`}>
      <div className="food-macro-head">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <div className="food-macro-track">
        <span style={{ width: `${Math.max(8, Math.min(percent, 100))}%` }} />
      </div>
    </div>
  );
}

function getMacroSummary(analysis, activeItem) {
  const calories = Number(analysis.calories || 0);
  const protein = Number(analysis.protein_g ?? activeItem?.protein_g ?? 0);
  const carbs = Number(analysis.carbs_g ?? activeItem?.carbs_g ?? 0);
  const fat = Number(analysis.fat_g ?? activeItem?.fat_g ?? 0);
  const totalMacroGrams = Math.max(protein + carbs + fat, 1);

  return [
    { icon: Flame, label: 'Calories', value: `${Math.round(calories)} kcal`, tone: 'calories', percent: Math.min(calories / 700 * 100, 100) },
    { icon: Beef, label: 'Protein', value: `${Math.round(protein)}g`, tone: 'protein', percent: protein / totalMacroGrams * 100 },
    { icon: Wheat, label: 'Carbs', value: `${Math.round(carbs)}g`, tone: 'carbs', percent: carbs / totalMacroGrams * 100 },
    { icon: Leaf, label: 'Fat', value: `${Math.round(fat)}g`, tone: 'fat', percent: fat / totalMacroGrams * 100 }
  ];
}

function getSmartFoodNote(analysis, facts) {
  const text = `${analysis.name || ''} ${analysis.health_analysis || ''}`.toLowerCase();
  const calories = Number(analysis.calories || 0);
  const protein = Number(analysis.protein_g || 0);
  const carbs = Number(analysis.carbs_g || 0);
  const fat = Number(analysis.fat_g || 0);
  const sugar = getFactNumber(facts, 'sugar');
  const sodium = getFactNumber(facts, 'sodium');
  const saturatedFat = getFactNumber(facts, 'saturated');

  const treatSignals = [
    'deep-fried',
    'fried',
    'refined',
    'sugar',
    'sweet',
    'indulgent',
    'treat',
    'snack',
    'low in protein',
    'empty calories',
    'occasional'
  ];

  const looksLikeTreat = treatSignals.some(signal => text.includes(signal));
  const highFatOrSugar = fat >= 14 || sugar >= 10 || saturatedFat >= 4;
  const highSodium = sodium >= 400;
  const calorieDenseLowProtein = calories >= 250 && protein < 8;
  const carbHeavy = carbs >= 35 && protein < 10;

  if (!(looksLikeTreat || highFatOrSugar || highSodium || calorieDenseLowProtein || carbHeavy)) {
    return null;
  }

  if (highSodium && !highFatOrSugar) {
    return 'A sodium-heavy choice today. Balance it with water and potassium-rich foods like banana, curd, dal, or vegetables.';
  }

  if (carbHeavy || calorieDenseLowProtein || looksLikeTreat) {
    return 'Best enjoyed as an occasional treat. Pair it with a protein-rich side like dal, chana, curd, eggs, tofu, or grilled paneer to balance the meal.';
  }

  return 'This is a richer choice, so keep the next meal lighter with vegetables, lean protein, and fewer added fats.';
}

function getFactNumber(facts, needle) {
  const fact = facts.find(item => String(item.label || '').toLowerCase().includes(needle));
  if (!fact) return 0;
  const match = String(fact.value || '').replace(/,/g, '').match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
}

function getFactTone(label) {
  const normalized = String(label || '').toLowerCase();
  if (normalized.includes('fat') || normalized.includes('saturated')) return 'cyan';
  if (normalized.includes('sodium')) return 'violet';
  if (normalized.includes('carb')) return 'amber';
  if (normalized.includes('fiber') || normalized.includes('fibre')) return 'emerald';
  if (normalized.includes('protein')) return 'rose';
  if (normalized.includes('sugar')) return 'blue';
  return 'muted';
}

function formatMode(mode) {
  if (mode === 'photo') return 'Photo estimate';
  if (mode === 'manual') return 'Manual entry';
  return 'Text estimate';
}

async function prepareImageForAnalysis(file) {
  const canUseOriginal = ACCEPTED_ANALYSIS_TYPES.has(file.type) && file.size <= MAX_ANALYSIS_IMAGE_BYTES;

  try {
    return await compressImageForAnalysis(file);
  } catch (error) {
    if (canUseOriginal) {
      const dataUrl = await readFileAsDataUrl(file);
      return dataUrlToPayload(dataUrl, file.type);
    }

    const typeHint = file.type ? ` (${file.type})` : '';
    throw new Error(`This camera image${typeHint} is too large or is not browser-decodable. Please choose a JPEG/PNG image or take a screenshot/photo copy and try again.`, { cause: error });
  }
}

async function compressImageForAnalysis(file) {
  const bitmap = await loadImageBitmap(file);
  const scale = Math.min(1, MAX_ANALYSIS_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the image for upload.');

  ctx.drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === 'function') bitmap.close();

  const blob = await canvasToBlob(canvas, 'image/jpeg', ANALYSIS_IMAGE_QUALITY);
  if (blob.size > MAX_ANALYSIS_IMAGE_BYTES) {
    throw new Error('The compressed image is still too large. Please crop the photo or choose a smaller image.');
  }

  const dataUrl = await readFileAsDataUrl(blob);
  return dataUrlToPayload(dataUrl, 'image/jpeg');
}

async function loadImageBitmap(file) {
  if ('createImageBitmap' in window) {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode this image.'));
      image.src = objectUrl;
    });
    return img;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not compress this image.'));
    }, mimeType, quality);
  });
}

function readFileAsDataUrl(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(fileOrBlob);
  });
}

function dataUrlToPayload(dataUrl, fallbackMimeType) {
  const [header, base64Image] = String(dataUrl).split(',');
  const mimeType = header.match(/^data:(.*?);base64$/)?.[1] || fallbackMimeType;

  if (!base64Image || !mimeType) {
    throw new Error('Failed to prepare image data.');
  }

  return { dataUrl, base64Image, mimeType };
}

function getFriendlyAnalysisError(err, fallback) {
  const message = err.response?.data?.error || err.response?.data?.details || err.message || '';

  if (err.code === 'ECONNABORTED' || message.toLowerCase().includes('timeout')) {
    return 'The photo upload or analysis took too long. The image is still selected, so try again on a stronger connection or choose a smaller/cropped photo.';
  }

  if (err.response?.status === 413 || message.toLowerCase().includes('too large')) {
    return 'That photo is too large to analyze reliably. Please crop it or choose a smaller JPEG photo.';
  }

  if (message.includes('503') || message.toLowerCase().includes('high demand') || message.toLowerCase().includes('service unavailable')) {
    return 'Gemini is busy right now. Your photo is still selected, so try again in a moment or enter the nutrition manually.';
  }

  if (message.includes('429') || message.toLowerCase().includes('quota')) {
    return 'Gemini quota is temporarily unavailable for this project. Your photo is still selected, and you can enter the details manually.';
  }

  if (message.toLowerCase().includes('api key')) {
    return 'Gemini could not authenticate the API key. Check the backend key setup and restart the server.';
  }

  return fallback;
}
