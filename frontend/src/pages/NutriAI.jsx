import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Camera, CalendarDays, Lightbulb, Search, Send, Sparkles, Trash2, X, Zap } from 'lucide-react';
import NutriTrackLogo from '../components/NutriTrackLogo';
import api from '../utils/api';

const CHAT_IMAGE_QUALITIES = [0.82, 0.74, 0.66];
const CHAT_IMAGE_DIMENSIONS = [1280, 1100, 960];
const TARGET_CHAT_IMAGE_BYTES = 1 * 1024 * 1024;
const MAX_CHAT_IMAGE_BYTES = 1.5 * 1024 * 1024;
const ACCEPTED_CHAT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const GENERIC_CHAT_IMAGE_ERROR = 'Unable to process this image. Please choose another photo.';

const promptSuggestions = [
  'Review my calories & protein today',
  'What should I eat next for more protein?',
  'Suggest a light dinner',
  'Balance food & exercise today'
];

const initialNutriAIMessages = [
  {
    role: 'assistant',
    text: 'Hi, I am NutriAI. Tell me what you ate, what you plan to eat, or what fitness goal you want to work on today.'
  }
];

let sessionNutriAIMessages = initialNutriAIMessages;

export default function NutriAIPage() {
  const [messages, setMessages] = useState(() => sessionNutriAIMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState({ profile: null, foods: [], exercises: [] });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageError, setImageError] = useState('');
  const imageInputRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      api.get('/api/profile'),
      api.get(`/api/food/log?date=${today}`),
      api.get(`/api/exercise/log?date=${today}`)
    ]).then(([profileRes, foodRes, exerciseRes]) => {
      if (!ignore) setContext({ profile: profileRes.data, foods: foodRes.data, exercises: exerciseRes.data });
    }).catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    sessionNutriAIMessages = messages;
  }, [messages]);

  const totals = useMemo(() => {
    const eaten = context.foods.reduce((sum, item) => sum + Number(item.calories || 0), 0);
    const protein = context.foods.reduce((sum, item) => sum + Number(item.protein_g || 0), 0);
    const burned = context.exercises.reduce((sum, item) => sum + Number(item.calories_burned || 0), 0);
    const target = Number(context.profile?.tdee || 0);
    const remaining = Math.max(target - eaten + burned, 0);
    const progress = target ? Math.min(Math.round((eaten / target) * 100), 100) : 0;
    return { eaten, protein, burned, target, remaining, progress };
  }, [context]);
  const sendMessage = async (messageText = input) => {
    const text = messageText.trim();
    const image = selectedImage;
    if ((!text && !image) || loading) return;

    const outgoingText = text || 'Please analyze this food image and tell me what it likely contains.';

    setMessages(prev => [...prev, { role: 'user', text: outgoingText, imagePreview: image?.dataUrl, imageName: image?.name }]);
    setInput('');
    setSelectedImage(null);
    setImageError('');
    if (imageInputRef.current) imageInputRef.current.value = '';
    setLoading(true);

    try {
      const { data } = await api.post('/api/ai/chat', {
        message: outgoingText,
        image: image ? {
          base64Image: image.base64Image,
          mimeType: image.mimeType
        } : null
      });
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: error.response?.data?.error || 'NutriAI could not answer right now. Try again in a moment.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageAttach = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageError('');

    try {
      const payload = await prepareChatImage(file);
      setSelectedImage({ ...payload, name: file.name });
    } catch (error) {
      setSelectedImage(null);
      setImageError(error.message || GENERIC_CHAT_IMAGE_ERROR);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImageError('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  return (
    <div className="nutriai-page nutritrack-chat-page">
      <aside className="nutriai-reference-sidebar">
        <div className="nutriai-side-hero">
          <span><NutriTrackLogo /></span>
        </div>

        <p className="nutriai-side-label">Today's Context</p>
        <div className="nutriai-context-card">
          <div className="nutriai-context-progress">
            <div className="nutriai-progress-ring" style={{ '--progress': `${totals.progress}%` }}>
              <strong>{totals.progress}%</strong>
            </div>
            <div>
              <span>Daily progress</span>
              <strong className="green">{totals.eaten} / {totals.target || 0} kcal</strong>
              <small>{totals.remaining} kcal remaining</small>
            </div>
          </div>
          <ContextRow label="Calories eaten" value={`${totals.eaten} kcal`} tone="green" />
          <ContextRow label="Remaining" value={`${totals.remaining} kcal`} tone="green" />
          <ContextRow label="Protein" value={`${totals.protein}g / ${context.profile?.protein_target || 0}g`} tone="amber" />
          <ContextRow label="Burned" value={`${totals.burned} kcal`} />
          <ContextRow label="Goal" value={context.profile?.goal || 'Weight loss'} tone="red" />
          <ContextRow label="TDEE" value={`${totals.target} kcal`} />
        </div>

        <p className="nutriai-side-label">Quick questions</p>
        <div className="nutriai-sidebar-chips">
          {[
            { text: 'What should I eat next?', icon: Lightbulb },
            { text: "How's my protein today?", icon: Activity },
            { text: 'Plan my remaining meals', icon: CalendarDays },
            { text: 'Suggest a high-protein dinner', icon: Sparkles },
            { text: 'Am I on track for today?', icon: Zap }
          ].map(({ text, icon: Icon }) => (
            <button key={text} onClick={() => sendMessage(text)} disabled={loading}><Icon />{text}</button>
          ))}
        </div>
      </aside>

      <section className="nutriai-chat-shell">
        <header className="nutriai-chat-header">
          <div>
            <span><NutriTrackLogo /></span>
            <div><strong>NutriAI</strong><small>Online - Tracking your goals</small></div>
          </div>
          <nav>
            <button title="Search chat"><Search /></button>
            <button title="Clear chat" onClick={() => setMessages(initialNutriAIMessages)}><Trash2 /></button>
          </nav>
        </header>

        <div className="nutriai-chat-messages">
          <div className="nutriai-date-divider"><span>Today - {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
          {messages.map((message, index) => (
            message.role === 'user' ? (
              <div key={`${message.role}-${index}`} className="nutriai-user-message">
                <div>
                  {message.imagePreview && (
                    <img className="nutriai-message-image" src={message.imagePreview} alt={message.imageName || 'Attached food'} />
                  )}
                  <FormattedAIText text={message.text} />
                </div>
              </div>
            ) : (
              <div key={`${message.role}-${index}`} className="nutriai-ai-message">
                <div className="nutriai-ai-avatar"><NutriTrackLogo /></div>
          <div className="nutriai-ai-content">
                  <strong>NutriAI</strong>
                  <div>
                    <FormattedAIText text={index === 0 ? getWelcomeMessage(totals, context.profile) : enrichNutriAIText(message.text)} />
                  </div>
                </div>
              </div>
            )
          ))}
          {loading && <NutriAILoading />}
        </div>

        <div className="nutriai-prompt-strip">
          {promptSuggestions.map(prompt => (
            <button key={prompt} type="button" onClick={() => sendMessage(prompt)} disabled={loading}>
              <Sparkles />
              {prompt}
            </button>
          ))}
        </div>

        <div className="nutriai-input-area">
          <button className="nutriai-input-action" type="button" title="Attach image" onClick={() => imageInputRef.current?.click()} disabled={loading}>
            <Camera />
          </button>
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageAttach} />
          <div className="nutriai-composer-stack">
            {selectedImage && (
              <div className="nutriai-attachment-preview">
                <img src={selectedImage.dataUrl} alt={selectedImage.name || 'Selected food'} />
                <span>{selectedImage.name || 'Attached image'}</span>
                <button type="button" onClick={clearSelectedImage} aria-label="Remove attached image"><X /></button>
              </div>
            )}
            {imageError && <p className="nutriai-attachment-error">{imageError}</p>}
          <textarea
            rows="1"
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask NutriAI what to eat next, how to improve protein, or how your day looks..."
          />
          </div>
          <span>{input.length}</span>
          <button className="nutriai-main-send" onClick={() => sendMessage()} disabled={loading || (!input.trim() && !selectedImage)} aria-label="Send message">
            <Send />
          </button>
        </div>
      </section>
    </div>
  );
}

async function prepareChatImage(file) {
  if (!ACCEPTED_CHAT_IMAGE_TYPES.has(file.type)) {
    throw new Error(GENERIC_CHAT_IMAGE_ERROR);
  }

  try {
    return await compressChatImage(file);
  } catch (error) {
    if (error?.code === 'IMAGE_TOO_LARGE') {
      throw new Error('This photo is too large to analyze reliably. Please choose another photo.', { cause: error });
    }

    throw new Error(GENERIC_CHAT_IMAGE_ERROR, { cause: error });
  }
}

async function compressChatImage(file) {
  const bitmap = await loadImageBitmap(file);
  let bestBlob = null;

  try {
    for (const maxDimension of CHAT_IMAGE_DIMENSIONS) {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not prepare the image for upload.');

      ctx.drawImage(bitmap, 0, 0, width, height);

      for (const quality of CHAT_IMAGE_QUALITIES) {
        const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
        }
        if (blob.size <= TARGET_CHAT_IMAGE_BYTES) {
          const dataUrl = await readFileAsDataUrl(blob);
          return dataUrlToPayload(dataUrl, 'image/jpeg');
        }
      }
    }
  } finally {
    if (typeof bitmap.close === 'function') bitmap.close();
  }

  if (!bestBlob || bestBlob.size > MAX_CHAT_IMAGE_BYTES) {
    const error = new Error('Compressed image exceeds upload limit.');
    error.code = 'IMAGE_TOO_LARGE';
    throw error;
  }

  const dataUrl = await readFileAsDataUrl(bestBlob);
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

function ContextRow({ label, value, tone }) {
  return <div><span>{label}</span><strong className={tone || ''}>{value}</strong></div>;
}

function getWelcomeMessage(totals, profile) {
  const proteinLeft = Math.max(Number(profile?.protein_target || 0) - totals.protein, 0);
  return `Hi, I am NutriAI, your personal nutrition coach. I have full context of your day — what you have eaten, your calories burned, and your goals.

So far today you have had **${totals.eaten} kcal** and you have **${proteinLeft}g of protein left** to hit your daily target. You have **${totals.remaining} kcal remaining** for the day.

What would you like to work on? Ask me anything — meal ideas, calorie estimates, or how to close out the day strong.`;
}

function enrichNutriAIText(text) {
  const value = String(text || '').trim();
  if (!value) return value;
  if (/^#{1,4}\s/m.test(value) || /^[-*]\s/m.test(value)) return value;

  return value
    .replace(/(^|\n)(Calories|Protein Target|Protein|Breakfast|Lunch|Snack|Dinner|Plan|Summary|Recommendation|Next steps|Note):/gi, '$1## $2')
    .replace(/(\.\s+)(Breakfast|Lunch|Snack|Dinner)\s*\(/gi, '$1\n## $2 (')
    .replace(/(\.\s+)(Since|Based on|You can|Try to|Aim for)/gi, '$1\n$2');
}

function NutriAILoading() {
  return (
    <div className="typing-row">
      <div className="recv-av nutriai-loading-avatar"><NutriTrackLogo /></div>
      <div>
        <div className="recv-name">NutriAI is preparing your answer</div>
        <div className="typing-bubble">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

function FormattedAIText({ text }) {
  const blocks = parseAIText(text);

  return (
    <div className="ai-rich-text">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return <h4 key={index}>{renderInlineMarkdown(block.text)}</h4>;
        }

        if (block.type === 'list') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }

        return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
      })}
    </div>
  );
}

function parseAIText(text) {
  const normalized = normalizeAIText(text);
  const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean);
  const blocks = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: 'list', items: listItems });
      listItems = [];
    }
  };

  lines.forEach(line => {
    if (/^#{1,4}\s+/.test(line)) {
      flushList();
      blocks.push({ type: 'heading', text: line.replace(/^#{1,4}\s+/, '') });
      return;
    }

    if (/^[A-Z][A-Za-z &'-]{2,48}:$/.test(line)) {
      flushList();
      blocks.push({ type: 'heading', text: line.replace(/:$/, '') });
      return;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushList();
      blocks.push({ type: 'heading', text: line });
      return;
    }

    if (/^[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^[-*]\s+/, ''));
      return;
    }

    flushList();
    blocks.push({ type: 'paragraph', text: line });
  });

  flushList();
  return blocks.length ? blocks : [{ type: 'paragraph', text: String(text || '') }];
}

function renderInlineMarkdown(text) {
  const cleaned = cleanAIText(text);
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return highlightImportantText(part, index);
  });
}

function normalizeAIText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\*\*([^*\n]+):\*/g, '**$1:**')
    .replace(/\*\*([^*\n]+)\*/g, '**$1**')
    .replace(/\*([^*\n]+)\*\*/g, '**$1**')
    .replace(/\*\*([^*\n]+)$/gm, '**$1**')
    .replace(/([^\n])(\d+\.\s+[A-Z])/g, '$1\n$2')
    .replace(/(#{1,4}\s)/g, '\n$1')
    .replace(/(^|\n)\s*([-*]\s+)/g, '\n* ')
    .replace(/\n{2,}/g, '\n');
}

function cleanAIText(text) {
  return String(text || '')
    .replace(/\*\*([^*]+)$/g, '$1')
    .replace(/(^|[^*])\*([^*\s][^*]*?)(?=\s|$)/g, '$1$2')
    .replace(/\*/g, '')
    .trim();
}

function highlightImportantText(text, keyPrefix) {
  const parts = String(text).split(/(\b\d[\d,]*(?:\s*(?:to|-)\s*\d[\d,]*)?\s*(?:calories|kcal|grams|g|minutes?|minute|g protein)\b|[A-Z][A-Za-z' ]{2,24}:)/gi);

  return parts.map((part, index) => {
    if (!part) return null;
    if (/^\b\d[\d,]*(?:\s*(?:to|-)\s*\d[\d,]*)?\s*(?:calories|kcal|grams|g|minutes?|minute|g protein)\b$/i.test(part) || /^[A-Z][A-Za-z' ]{2,24}:$/.test(part)) {
      return <strong key={`${keyPrefix}-${index}`}>{part}</strong>;
    }

    return part;
  });
}
