/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfToday,
  startOfWeek,
  subMonths,
  subWeeks
} from 'date-fns';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import { ThemeProvider } from './contexts/ThemeContext';
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
  Loader2,
  LogOut,
  MessageSquareText,
  Send,
  Settings,
  Sparkles,
  User,
  Weight,
  X
} from 'lucide-react';

import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import About from './pages/About';
import NutriAIPage from './pages/NutriAI';
import WeeklySummary from './pages/WeeklySummary';
import ProfilePage from './pages/Profile';
import SettingsPage from './pages/Settings';
import NutriTrackLogo from './components/NutriTrackLogo';
import NutriAILogo from './components/NutriAILogo';
import {
  ExerciseDetailsModal,
  MealDetailsModal,
  attachStoredAnalyses,
  attachStoredExerciseAnalyses
} from './pages/Dashboard';
import api, {
  BACKEND_KEEP_ALIVE_INTERVAL_MS,
  BACKEND_WAKE_RETRY_MS,
  wakeBackend
} from './utils/api';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

let nutriAITab = null;

const Navbar = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [askAiOpen, setAskAiOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileDraft, setProfileDraft] = useState(null);
  const [profileStatus, setProfileStatus] = useState('');
  const [navLoading, setNavLoading] = useState('');
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const showLandingNav = !user && (location.pathname === '/' || location.pathname === '/about');
  const isNutriAIPage = location.pathname === '/nutriai';
  const isDashboardPage = location.pathname === '/' || location.pathname === '/dashboard';

  const showNavSwitch = (label, action) => {
    setProfileOpen(false);
    setSettingsOpen(false);
    setNavLoading(label);
    window.setTimeout(() => {
      action();
      window.setTimeout(() => setNavLoading(''), 360);
    }, 420);
  };

  const goToRoute = (path, label) => {
    if (location.pathname === path) {
      setNavLoading('');
      return;
    }
    showNavSwitch(label, () => navigate(path));
  };

  const openRouteInNewTab = (path, tabName = '_blank') => {
    const targetUrl = new URL(path, window.location.origin).toString();
    const tab = window.open(targetUrl, tabName);
    tab?.focus();
    return tab;
  };

  const openNutriAI = () => {
    setProfileOpen(false);
    setSettingsOpen(false);
    nutriAITab = openRouteInNewTab('/nutriai', 'nutritrack-nutriai') || nutriAITab;
  };

  const openWeeklySummary = () => {
    setProfileOpen(false);
    setSettingsOpen(false);
    openRouteInNewTab('/weekly-summary');
  };

  const goToDashboardSection = (sectionId, label) => {
    showNavSwitch(label, () => {
      if (location.pathname !== '/') {
        navigate('/');
        window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180);
        return;
      }
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const goToToday = () => {
    setSettingsOpen(false);
    setProfileOpen(false);
    showNavSwitch('Dashboard', () => {
      navigate('/');
      window.dispatchEvent(new Event('nutritrack:go-today'));
    });
  };

  const openSettings = (section = '') => {
    setSettingsInitialSection(section);
    setSettingsOpen(true);
    setProfileOpen(false);
    setAskAiOpen(false);
  };

  useEffect(() => {
    let ignore = false;

    const loadProfile = async () => {
      if (!profileOpen || !user) return;
      setProfileStatus('');

      try {
        const { data } = await api.get('/api/profile');
        if (!ignore) {
          setProfile(data);
          setProfileDraft(createProfileDraft(data, user));
        }
      } catch (error) {
        if (!ignore) setProfileStatus('Could not load profile details.');
      }
    };

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [profileOpen, user]);

  useEffect(() => {
    if (!profileOpen) return;

    const closeProfileOnOutsideClick = (event) => {
      if (
        event.target.closest('.profile-menu') ||
        event.target.closest('[data-profile-toggle]')
      ) {
        return;
      }

      setProfileOpen(false);
      setProfileExpanded(false);
      setProfileEditing(false);
    };

    document.addEventListener('pointerdown', closeProfileOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeProfileOnOutsideClick);
  }, [profileOpen]);

  const updateProfileDraft = (key, value) => {
    setProfileDraft(prev => ({ ...(prev || createProfileDraft(profile, user)), [key]: value }));
  };

  const saveProfile = async () => {
    if (!profileDraft) return;
    setProfileStatus('Saving profile...');

    try {
      const { data } = await api.post('/api/profile', {
        age: profileDraft.age,
        gender: profileDraft.gender,
        weight_kg: profileDraft.weight_kg,
        height_cm: profileDraft.height_cm,
        activity_level: profileDraft.activity_level,
        goal: profileDraft.goal
      });
      localStorage.setItem('nutritrack-contact-info', profileDraft.contact || '');
      localStorage.setItem('nutritrack-target-weight', profileDraft.target_weight || '');
      setProfile(data);
      setProfileDraft(createProfileDraft(data, user));
      setProfileStatus('Profile updated.');
    } catch (error) {
      setProfileStatus(error.response?.data?.error || 'Could not save profile.');
    }
  };

  return (
    <>
      <nav className={`glass sticky top-0 z-50 ${showLandingNav ? 'landing-app-nav' : ''} ${isNutriAIPage ? 'nutriai-top-nav' : ''}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={goToToday}
            className="flex items-center gap-3 rounded-lg text-left transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-teal-300/40"
            aria-label="Go to today's dashboard"
          >
            <div className="brand-mark">
              <NutriTrackLogo className="brand-icon h-full w-full" />
            </div>
            <div>
              <div className="brand-title text-lg font-extrabold leading-tight">NutriTrack</div>
              <div className="brand-subtitle hidden text-xs font-medium sm:block">Daily nutrition dashboard</div>
            </div>
          </button>

          {showLandingNav && (
            <>
              <div className="landing-top-links">
                <a href="#features">Features</a>
                <a href="#how">How it works</a>
                <a href="#about">About</a>
                <a href="#faq">FAQ</a>
              </div>
              <div className="landing-top-actions">
                <Link to="/login" className="landing-nav-login">Log in</Link>
                <Link to="/signup" className="landing-nav-start">Start free</Link>
              </div>
            </>
          )}

          {user && (
            <div className="dashboard-top-links" aria-label="Dashboard sections">
              <button type="button" onClick={() => goToRoute('/', 'Dashboard')} className={isDashboardPage ? 'active' : ''}>Dashboard</button>
              <button type="button" onClick={() => goToDashboardSection('food-log', 'Food & Exercise Log')}>Food & Exercise Log</button>
              <button type="button" onClick={openWeeklySummary} className={location.pathname === '/weekly-summary' ? 'active' : ''}>Weekly Summary</button>
            </div>
          )}

          {user && (
            <div className="relative flex items-center gap-1.5 sm:gap-2">
              {isNutriAIPage ? (
                <>
                  <button onClick={openNutriAI} className="nutriai-status-pill" aria-label="Open NutriAI">
                    <span />
                    NutriAI
                  </button>
                  <button data-profile-toggle onClick={() => goToRoute('/profile', 'Profile')} className="nutriai-profile-dot" aria-label="Open profile">
                    {getInitials(user?.name)}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={openNutriAI} className="btn-secondary hidden h-10 px-3 sm:inline-flex" aria-label="Open NutriAI">
                    <Sparkles className="h-4 w-4 text-teal-300" />
                    NutriAI
                  </button>
                  <button onClick={openNutriAI} className="icon-button sm:hidden" aria-label="Open NutriAI">
                    <Sparkles className="h-5 w-5" />
                  </button>
                  <button onClick={() => goToRoute('/settings', 'Settings')} className="icon-button" aria-label="Open settings">
                    <Settings className="h-5 w-5" />
                  </button>
                  <button data-profile-toggle onClick={() => goToRoute('/profile', 'Profile')} className="navbar-initials-button" aria-label="Open profile">
                    {getInitials(user?.name)}
                  </button>
                </>
              )}

              {profileOpen && <div className="profile-blur-overlay fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" onClick={() => { setProfileOpen(false); setProfileEditing(false); }} />}
              {profileOpen && (
                <div className="profile-menu fixed left-3 right-3 top-20 z-50 max-h-[calc(100svh-5.5rem)] overflow-y-auto p-4 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[min(92vw,26rem)]" onClick={event => event.stopPropagation()}>
                  <button
                    type="button"
                        onClick={() => setProfileExpanded(prev => !prev)}
                    className="mb-4 flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-teal-300/10"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary-400 to-teal-300 font-black text-slate-950">
                      {getInitials(user?.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-black text-white">{user?.name || 'Profile'}</p>
                      <p className="truncate text-sm text-slate-400">{user?.email}</p>
                    </div>
                  </button>

                  {profileExpanded && (
                    <div className="mb-3 max-h-[68vh] overflow-y-auto pr-1">
                      <ProfileDashboard profile={profile} draft={profileDraft} />
                      <button
                        type="button"
                        onClick={() => setProfileEditing(true)}
                        className="btn-secondary mt-3 w-full justify-start"
                      >
                        <User className="h-4 w-4" />
                        Edit user database
                      </button>
                      {profileEditing && (
                        <div className="mt-3">
                          <ProfileEditor
                            draft={profileDraft}
                            user={user}
                            status={profileStatus}
                            onChange={updateProfileDraft}
                            onSave={saveProfile}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {!profileExpanded && (
                    <button
                      onClick={() => { setProfileExpanded(true); setProfileEditing(true); }}
                      className="btn-secondary mb-2 w-full justify-start"
                    >
                      <User className="h-4 w-4" />
                      Edit user database
                    </button>
                  )}

                  <button
                    onClick={logout}
                    className="btn-secondary mb-2 w-full justify-start text-red-300"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>

                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {navLoading && (
        <div className="dashboard-nav-transition" role="status" aria-live="polite">
          <div className="dashboard-nav-transition-card">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Opening {navLoading}</span>
          </div>
        </div>
      )}

      {settingsOpen && <SettingsDrawer initialSection={settingsInitialSection} onClose={() => setSettingsOpen(false)} />}
      {askAiOpen && <AskAIPanel onClose={() => setAskAiOpen(false)} />}
    </>
  );
};

function AskAIPanel({ onClose }) {
  const promptSuggestions = [
    'Review my calories & protein today',
    'What should I eat next for more protein?',
    'Suggest a light dinner',
    'Balance food & exercise today'
  ];
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi, I am NutriAI. Ask me about your meals, protein, calories, routine, or what you can eat next.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (messageText = input) => {
    const text = messageText.trim();
    if (!text || loading) return;
    const userMessage = { role: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/api/ai/chat', { message: userMessage.text });
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: getNutriAIError(error)
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div className="chat-wrap askai-panel ml-auto flex h-full w-full max-w-md flex-col" onClick={event => event.stopPropagation()}>
        <div className="ch">
          <div className="ch-left">
            <div className="ch-avatar">
              <NutriAILogo />
            </div>
            <div>
              <h2 className="ch-title">Chat with NutriAI</h2>
              <p className="ch-sub">Quick nutrition guidance from your daily logs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/nutriai" target="nutritrack-nutriai" className="ch-open" onClick={onClose}>
              <ExternalLink className="h-4 w-4" />
              Open full page
            </a>
            <button className="chat-close" onClick={onClose} aria-label="Close NutriAI">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="chips">
          {promptSuggestions.map(prompt => (
            <button key={prompt} type="button" className="chip" onClick={() => sendMessage(prompt)} disabled={loading}>
              <Sparkles className="h-3.5 w-3.5" />
              {prompt}
            </button>
          ))}
        </div>

        <div className="msgs flex-1">
          {messages.map((message, index) => (
            message.role === 'user' ? (
              <div key={`${message.role}-${index}`} className="sent-row">
                <div className="sent-bubble">
                  <FormattedAIText text={message.text} />
                </div>
              </div>
            ) : (
              index === 0 ? (
                <div key={`${message.role}-${index}`} className="sys-msg">
                  <FormattedAIText text={message.text} />
                </div>
              ) : (
                <div key={`${message.role}-${index}`} className="recv-row">
                  <div className="recv-av"><NutriAILogo /></div>
                  <div className="recv-content">
                    <div className="recv-name">NutriAI</div>
                    <div className="recv-bubble">
                      <FormattedAIText text={message.text} />
                    </div>
                  </div>
                </div>
              )
            )
          ))}
          {loading && <NutriAILoading />}
        </div>

        <div className="inp-area">
          <textarea
            className="inp-box"
            rows="1"
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask NutriAI what to eat, how to improve protein, or how your day looks..."
          />
          <button className="send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()} aria-label="Send message">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NutriAILoading() {
  return (
    <div className="typing-row">
      <div className="recv-av nutriai-loading-avatar"><NutriAILogo /></div>
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
    .replace(/(\n)?([-*]\s+)/g, '\n* ')
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

function getNutriAIError(error) {
  if (error.code === 'ECONNABORTED') {
    return 'NutriAI took too long to respond. Please try again with a shorter question.';
  }

  return error.response?.data?.error || 'NutriAI could not answer right now. Try again in a moment.';
}

function SettingsDrawer({ initialSection = '', onClose }) {
  const { user } = useAuth();
  const [openSection, setOpenSection] = useState(initialSection);
  const [feedback, setFeedback] = useState('');
  const [feedbackImage, setFeedbackImage] = useState(null);
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [weight, setWeight] = useState(() => localStorage.getItem('nutritrack-current-weight') || '');
  const [targetWeight, setTargetWeight] = useState(() => localStorage.getItem('nutritrack-target-weight') || '');
  const [profile, setProfile] = useState(null);
  const [profileDraft, setProfileDraft] = useState(null);
  const [profileStatus, setProfileStatus] = useState('');
  const [todayRecords, setTodayRecords] = useState({ foodLogs: [], exerciseLogs: [], loading: true });
  const [weeklyRecords, setWeeklyRecords] = useState(() => ({
    ...getCachedWeeklyRecords(),
    loading: true
  }));
  const [weekStart, setWeekStart] = useState(startOfWeek(startOfToday()));
  const [weekCalendarOpen, setWeekCalendarOpen] = useState(false);
  const [weekCalendarMonth, setWeekCalendarMonth] = useState(startOfMonth(startOfToday()));
  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);

  useEffect(() => {
    setOpenSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadSettingsData = async () => {
      setTodayRecords(prev => ({ ...prev, loading: true }));
      setWeeklyRecords(prev => ({ ...prev, loading: true }));

      try {
        const profileRes = await api.get('/api/profile');
        const currentProfile = profileRes.data;
        const today = format(startOfToday(), 'yyyy-MM-dd');
        const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart) });

        const [foodTodayRes, exerciseTodayRes, ...weeklyResponses] = await Promise.all([
          api.get(`/api/food/log?date=${today}`),
          api.get(`/api/exercise/log?date=${today}`),
          ...days.flatMap(day => {
            const date = format(day, 'yyyy-MM-dd');
            return [
              api.get(`/api/food/log?date=${date}`),
              api.get(`/api/exercise/log?date=${date}`)
            ];
          })
        ]);

        const rows = days.map((day, index) => {
          const foodLogs = weeklyResponses[index * 2].data;
          const exerciseLogs = weeklyResponses[index * 2 + 1].data;
          const foodCalories = foodLogs.reduce((sum, item) => sum + Number(item.calories || 0), 0);
          const exerciseCalories = exerciseLogs.reduce((sum, item) => sum + Number(item.calories_burned || 0), 0);
          const remaining = Number(currentProfile?.tdee || 0) - foodCalories + exerciseCalories;

          return {
            date: format(day, 'MMM d'),
            day: format(day, 'EEE'),
            foodCalories,
            exerciseCalories,
            remaining
          };
        });

        if (!ignore) {
          setProfile(currentProfile);
          setProfileDraft(createProfileDraft(currentProfile, user));
          setWeight(currentProfile?.weight_kg ? String(currentProfile.weight_kg) : '');
          setTodayRecords({
            foodLogs: attachStoredAnalyses(foodTodayRes.data),
            exerciseLogs: attachStoredExerciseAnalyses(exerciseTodayRes.data),
            loading: false
          });
          const nextWeeklyRecords = { rows, loading: false, tdee: Number(currentProfile?.tdee || 0) };
          setWeeklyRecords(nextWeeklyRecords);
          localStorage.setItem('nutritrack-weekly-cache', JSON.stringify({
            rows: nextWeeklyRecords.rows,
            tdee: nextWeeklyRecords.tdee
          }));
        }
      } catch (error) {
        if (!ignore) {
          setTodayRecords({ foodLogs: [], exerciseLogs: [], loading: false });
          setWeeklyRecords({ rows: [], loading: false, tdee: 0 });
          setProfileStatus(error.response?.status === 401 ? 'Please log in again to edit profile.' : 'Could not load settings details.');
        }
      }
    };

    loadSettingsData();

    return () => {
      ignore = true;
    };
  }, [user, weekStart]);

  const saveWeight = () => {
    localStorage.setItem('nutritrack-current-weight', weight);
    localStorage.setItem('nutritrack-target-weight', targetWeight);
  };

  const updateProfileDraft = (key, value) => {
    setProfileDraft(prev => ({ ...(prev || createProfileDraft(profile, user)), [key]: value }));
  };

  const saveProfile = async () => {
    if (!profileDraft) return;
    setProfileStatus('Saving profile...');

    try {
      const payload = {
        age: profileDraft.age,
        gender: profileDraft.gender,
        weight_kg: profileDraft.weight_kg,
        height_cm: profileDraft.height_cm,
        activity_level: profileDraft.activity_level,
        goal: profileDraft.goal
      };
      const { data } = await api.post('/api/profile', payload);
      localStorage.setItem('nutritrack-contact-info', profileDraft.contact || '');
      localStorage.setItem('nutritrack-target-weight', profileDraft.target_weight || '');
      setProfile(data);
      setWeight(data?.weight_kg ? String(data.weight_kg) : '');
      setTargetWeight(profileDraft.target_weight || '');
      setProfileStatus('Profile updated.');
    } catch (error) {
      setProfileStatus(error.response?.data?.error || 'Could not save profile.');
    }
  };

  const attachFeedbackImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFeedbackImage({
        name: file.name,
        type: file.type,
        dataUrl: reader.result
      });
    };
    reader.readAsDataURL(file);
  };

  const saveFeedback = () => {
    if (!feedback.trim() && !feedbackImage) return;
    const entries = JSON.parse(localStorage.getItem('nutritrack-feedback') || '[]');
    entries.unshift({
      text: feedback,
      image: feedbackImage,
      createdAt: new Date().toISOString(),
      user: user?.email || user?.name || 'Unknown user'
    });
    localStorage.setItem('nutritrack-feedback', JSON.stringify(entries.slice(0, 20)));
    setFeedback('');
    setFeedbackImage(null);
    setFeedbackStatus('Feedback saved in this platform.');
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] overflow-hidden bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
        <div className="settings-drawer ml-auto flex h-full w-full max-w-md flex-col border-l border-slate-700/70 bg-slate-950/88 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700/70 p-4">
          <div>
            <h2 className="text-xl font-black text-white">Settings</h2>
            <p className="text-sm text-slate-400">Dashboard tools and preferences</p>
          </div>
          <button onClick={onClose} className="icon-button" aria-label="Close settings">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          <SettingsSection id="history" icon={History} title="History" openSection={openSection} setOpenSection={setOpenSection}>
            <HistoryPanel
              records={todayRecords}
              onFoodSelect={setSelectedFood}
              onExerciseSelect={setSelectedExercise}
            />
          </SettingsSection>

          <SettingsSection id="weight" icon={Weight} title="Weight Tracker" openSection={openSection} setOpenSection={setOpenSection}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="rounded-lg border border-slate-800 bg-slate-950/45 p-3">
                  <span className="text-xs font-bold text-slate-400">Current Weight</span>
                  <input className="input-field mt-2" value={weight} onChange={e => setWeight(e.target.value)} placeholder="kg" />
                </label>
                <label className="rounded-lg border border-slate-800 bg-slate-950/45 p-3">
                  <span className="text-xs font-bold text-slate-400">Target Weight</span>
                  <input className="input-field mt-2" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder="kg" />
                </label>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
                <div className="mb-3 flex items-end justify-between">
                  <span className="text-3xl font-black text-white">{weight || '-'} kg</span>
                  <span className="text-sm text-slate-400">Target {targetWeight || '-'}</span>
                </div>
                <div className="h-36 rounded-lg border border-slate-800 bg-gradient-to-b from-teal-300/10 to-transparent p-3">
                  <div className="h-full border-l border-b border-slate-700">
                    <div className="ml-8 mt-8 h-3 w-3 rounded-full bg-teal-300 shadow-[0_0_18px_rgba(45,212,191,0.65)]" />
                  </div>
                </div>
              </div>
              <button className="btn-primary w-full" onClick={saveWeight}>Save weight</button>
            </div>
          </SettingsSection>

          <SettingsSection id="feedback" icon={MessageSquareText} title="Feedback" openSection={openSection} setOpenSection={setOpenSection}>
            <textarea
              className="input-field min-h-28 py-3"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Tell us what should improve..."
            />
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/45 p-3">
              {feedbackImage ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <img src={feedbackImage.dataUrl} alt={feedbackImage.name} className="h-12 w-12 rounded-lg object-cover" />
                    <p className="truncate text-sm font-bold text-white">{feedbackImage.name}</p>
                  </div>
                  <button className="icon-button h-8 w-8" onClick={() => setFeedbackImage(null)} aria-label="Remove feedback image">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-700 p-3 text-sm font-bold text-slate-400 hover:border-teal-300 hover:text-teal-300">
                  Attach picture
                  <input type="file" accept="image/*" className="hidden" onChange={attachFeedbackImage} />
                </label>
              )}
            </div>
            {feedbackStatus && <p className="mt-2 text-sm font-semibold text-teal-300">{feedbackStatus}</p>}
            <button className="btn-primary mt-3 w-full" onClick={saveFeedback} disabled={!feedback.trim() && !feedbackImage}>Send feedback</button>
          </SettingsSection>
        </div>
        </div>
      </div>
      {selectedFood && <MealDetailsModal meal={selectedFood} onClose={() => setSelectedFood(null)} />}
      {selectedExercise && <ExerciseDetailsModal exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />}
    </>
  );
}

function SettingsSection({ id, icon: Icon, title, openSection, setOpenSection, children }) {
  const open = openSection === id;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/35">
      <button
        className="flex w-full items-center justify-between gap-3 p-3 text-left"
        onClick={() => setOpenSection(open ? '' : id)}
      >
        <span className="flex items-center gap-3 font-black text-white">
          <Icon className="h-4 w-4 text-teal-300" />
          {title}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-slate-800 p-3">{children}</div>}
    </section>
  );
}

function HistoryPanel({ records, onFoodSelect, onExerciseSelect }) {
  const [openGroup, setOpenGroup] = useState('food');
  const hasFood = records.foodLogs.length > 0;
  const hasExercise = records.exerciseLogs.length > 0;

  if (records.loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map(item => (
          <div key={item} className="h-16 animate-pulse rounded-lg bg-slate-950/45" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <HistoryGroup
        title="Today's Foods"
        count={records.foodLogs.length}
        open={openGroup === 'food'}
        onToggle={() => setOpenGroup(openGroup === 'food' ? '' : 'food')}
      >
        {hasFood ? records.foodLogs.map(food => (
          <button key={food.id} className="w-full rounded-lg border border-slate-800 bg-slate-950/45 p-3 text-left transition-colors hover:border-teal-300/50" onClick={() => onFoodSelect(food)}>
            <p className="font-black capitalize text-white">{food.food_name}</p>
            <p className="text-sm text-slate-400">{food.calories} kcal / {food.protein_g}g protein</p>
          </button>
        )) : <p className="text-sm text-slate-400">No food logged today.</p>}
      </HistoryGroup>

      <HistoryGroup
        title="Today's Exercise"
        count={records.exerciseLogs.length}
        open={openGroup === 'exercise'}
        onToggle={() => setOpenGroup(openGroup === 'exercise' ? '' : 'exercise')}
      >
        {hasExercise ? records.exerciseLogs.map(exercise => (
          <button key={exercise.id} className="w-full rounded-lg border border-slate-800 bg-slate-950/45 p-3 text-left transition-colors hover:border-teal-300/50" onClick={() => onExerciseSelect(exercise)}>
            <p className="font-black capitalize text-white">{exercise.exercise_name}</p>
            <p className="text-sm text-slate-400">{exercise.duration_mins} mins / {exercise.calories_burned} kcal burned</p>
          </button>
        )) : <p className="text-sm text-slate-400">No exercise logged today.</p>}
      </HistoryGroup>
    </div>
  );
}

function HistoryGroup({ title, count, open, onToggle, children }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/35">
      <button className="flex w-full items-center justify-between p-3 text-left" onClick={onToggle}>
        <span>
          <span className="block font-black text-white">{title}</span>
          <span className="text-xs text-slate-400">{count} records</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-2 border-t border-slate-800 p-3">{children}</div>}
    </div>
  );
}

function WeeklyDetails({
  records,
  weekStart,
  calendarOpen,
  calendarMonth,
  onPreviousWeek,
  onToggleCalendar,
  onPreviousMonth,
  onNextMonth,
  onSelectWeek
}) {
  const [expandedDay, setExpandedDay] = useState(null);

  if (records.loading && records.rows.length === 0) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/45 p-3">
          <div className="h-3 w-20 animate-pulse rounded-full bg-slate-700/30" />
          <div className="mt-3 h-6 w-32 animate-pulse rounded-full bg-slate-700/30" />
        </div>
        {[0, 1, 2, 3, 4, 5, 6].map(item => (
          <div key={item} className="grid grid-cols-4 gap-2 rounded-lg border border-slate-800 bg-slate-950/45 p-3">
            <div className="h-3 animate-pulse rounded-full bg-slate-700/30" />
            <div className="h-3 animate-pulse rounded-full bg-slate-700/30" />
            <div className="h-3 animate-pulse rounded-full bg-slate-700/30" />
            <div className="h-3 animate-pulse rounded-full bg-slate-700/30" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/45 p-2">
        <button className="icon-button h-8 w-8" onClick={onPreviousWeek} aria-label="Previous week">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button className="flex-1 rounded-lg px-2 py-2 text-center text-sm font-black text-white hover:bg-teal-300/10" onClick={onToggleCalendar}>
          {format(weekStart, 'MMM d')} - {format(endOfWeek(weekStart), 'MMM d, yyyy')}
        </button>
      </div>
      {calendarOpen && (
        <WeekCalendar
          month={calendarMonth}
          selectedWeekStart={weekStart}
          onPreviousMonth={onPreviousMonth}
          onNextMonth={onNextMonth}
          onSelectWeek={onSelectWeek}
        />
      )}
      {records.loading && (
        <div className="rounded-lg border border-teal-300/20 bg-teal-300/10 p-2 text-xs font-bold text-teal-300">
          Updating weekly details...
        </div>
      )}
      <div className="weekly-target-card rounded-lg border p-3">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Daily target</p>
        <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-300">{records.tdee || 0} kcal</p>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Remaining includes exercise calories burned.</p>
      </div>
      <div className="space-y-2">
        {records.rows.map(row => {
          const key = `${row.day}-${row.date}`;
          const expanded = expandedDay === key;
          const eatenPercent = records.tdee ? Math.min((row.foodCalories / records.tdee) * 100, 100) : 0;
          const burnedPercent = records.tdee ? Math.min((row.exerciseCalories / records.tdee) * 100, 100) : 0;
          const overBudget = row.remaining < 0;

          return (
            <div key={key} className={`weekly-row-card rounded-lg border transition-all ${expanded ? 'weekly-row-card-active' : ''}`}>
              <button
                type="button"
                className="w-full p-3 text-left"
                onClick={() => setExpandedDay(expanded ? null : key)}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900 dark:text-white">{row.day}</p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{row.date}</p>
                  </div>
                  <div className={`rounded-lg px-3 py-1 text-sm font-black ${overBudget ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'}`}>
                    {row.remaining} kcal
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/70 p-2 dark:bg-slate-950/35">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600 dark:text-slate-400">Food</span>
                      <span className="text-cyan-700 dark:text-cyan-300">{row.foodCalories} kcal</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400" style={{ width: `${eatenPercent}%` }} />
                    </div>
                  </div>

                  <div className="rounded-lg bg-white/70 p-2 dark:bg-slate-950/35">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600 dark:text-slate-400">Exercise</span>
                      <span className="text-amber-700 dark:text-amber-300">{row.exerciseCalories} kcal</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400" style={{ width: `${burnedPercent}%` }} />
                    </div>
                  </div>
                </div>
              </button>

              {expanded && (
                <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm dark:border-slate-800">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-cyan-50 p-2 dark:bg-cyan-400/10">
                      <p className="text-xs font-bold text-cyan-700 dark:text-cyan-300">Eaten</p>
                      <p className="font-black text-slate-950 dark:text-white">{row.foodCalories} kcal</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-400/10">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Burned</p>
                      <p className="font-black text-slate-950 dark:text-white">{row.exerciseCalories} kcal</p>
                    </div>
                    <div className={`rounded-lg p-2 ${overBudget ? 'bg-red-50 dark:bg-red-400/10' : 'bg-emerald-50 dark:bg-emerald-400/10'}`}>
                      <p className={`text-xs font-bold ${overBudget ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>Balance</p>
                      <p className="font-black text-slate-950 dark:text-white">{overBudget ? 'Over' : 'Left'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekCalendar({ month, selectedWeekStart, onPreviousMonth, onNextMonth, onSelectWeek }) {
  const monthDays = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const leadingBlanks = Array.from({ length: monthDays[0].getDay() });

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/45 p-3">
      <div className="mb-3 flex items-center justify-between">
        <button className="icon-button h-8 w-8" onClick={onPreviousMonth} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-black text-white">{format(month, 'MMMM yyyy')}</p>
        <button className="icon-button h-8 w-8" onClick={onNextMonth} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase text-slate-400">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {leadingBlanks.map((_, index) => <div key={`blank-${index}`} />)}
        {monthDays.map(day => {
          const selected = startOfWeek(day).getTime() === selectedWeekStart.getTime();
          return (
            <button
              key={day.toISOString()}
              className={`aspect-square rounded-lg border text-sm font-bold ${
                selected
                  ? 'border-teal-300 bg-teal-300 text-slate-950'
                  : 'border-slate-800 bg-slate-950/30 text-slate-300 hover:border-teal-300/60'
              }`}
              onClick={() => onSelectWeek(day)}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfileEditor({ draft, user, status, onChange, onSave }) {
  if (!draft) {
    return <div className="h-28 animate-pulse rounded-lg bg-slate-950/45" />;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-800 bg-slate-950/45 p-3">
        <p className="font-black text-white">{user?.name || 'User'}</p>
        <p className="text-sm text-slate-400">{user?.email}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-400">Age</span>
          <input className="input-field" type="number" value={draft.age} onChange={event => onChange('age', event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-400">Gender</span>
          <select className="input-field" value={draft.gender} onChange={event => onChange('gender', event.target.value)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-400">Weight kg</span>
          <input className="input-field" type="number" value={draft.weight_kg} onChange={event => onChange('weight_kg', event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-400">Target kg</span>
          <input className="input-field" type="number" value={draft.target_weight} onChange={event => onChange('target_weight', event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-400">Height cm</span>
          <input className="input-field" type="number" value={draft.height_cm} onChange={event => onChange('height_cm', event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-400">Activity</span>
          <select className="input-field" value={draft.activity_level} onChange={event => onChange('activity_level', event.target.value)}>
            <option value="sedentary">Sedentary</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="active">Active</option>
            <option value="very_active">Very active</option>
          </select>
        </label>
      </div>

      <label className="space-y-1">
        <span className="text-xs font-bold text-slate-400">Goal</span>
        <select className="input-field" value={draft.goal} onChange={event => onChange('goal', event.target.value)}>
          <option value="lose">Lose weight</option>
          <option value="maintain">Maintain weight</option>
          <option value="gain">Gain weight</option>
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-xs font-bold text-slate-400">Contact information</span>
        <input className="input-field" value={draft.contact} onChange={event => onChange('contact', event.target.value)} placeholder="Phone or alternate email" />
      </label>

      {status && <p className="text-sm font-semibold text-teal-300">{status}</p>}
      <button className="btn-primary w-full" onClick={onSave}>Save profile</button>
    </div>
  );
}

function ProfileDashboard({ profile, draft }) {
  const values = [
    { label: 'Daily target', value: profile?.tdee ? `${profile.tdee} kcal` : '-' },
    { label: 'Protein', value: profile?.protein_target ? `${profile.protein_target}g` : '-' },
    { label: 'Weight', value: draft?.weight_kg ? `${draft.weight_kg} kg` : '-' },
    { label: 'Height', value: draft?.height_cm ? `${draft.height_cm} cm` : '-' }
  ];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/45 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-slate-400">Profile dashboard</p>
          <p className="font-black text-white">Nutrition profile</p>
        </div>
        <span className="rounded-lg bg-teal-300/10 px-2 py-1 text-xs font-black text-teal-300">
          {draft?.goal || 'maintain'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {values.map(item => (
          <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-950/45 p-2">
            <p className="text-[11px] font-bold text-slate-400">{item.label}</p>
            <p className="mt-1 font-black text-white">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function createProfileDraft(profile, user) {
  return {
    age: profile?.age ?? '',
    gender: profile?.gender || 'male',
    weight_kg: profile?.weight_kg ?? '',
    target_weight: localStorage.getItem('nutritrack-target-weight') || '',
    height_cm: profile?.height_cm ?? '',
    activity_level: profile?.activity_level || 'sedentary',
    goal: profile?.goal || 'maintain',
    email: user?.email || '',
    contact: localStorage.getItem('nutritrack-contact-info') || ''
  };
}

function BackendWakeMonitor() {
  const { user } = useAuth();
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;
    let keepAliveTimer = null;

    const clearTimers = () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      if (keepAliveTimer) window.clearInterval(keepAliveTimer);
    };

    const ping = async ({ retryOnFailure } = { retryOnFailure: false }) => {
      try {
        await wakeBackend();
        if (cancelled) return;
        if (retryTimer) {
          window.clearTimeout(retryTimer);
          retryTimer = null;
        }
        setStatus('ready');

        if (!keepAliveTimer) {
          keepAliveTimer = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
              wakeBackend().catch(() => setStatus('waking'));
            }
          }, BACKEND_KEEP_ALIVE_INTERVAL_MS);
        }
      } catch {
        if (cancelled) return;
        setStatus('waking');
        if (retryOnFailure) {
          retryTimer = window.setTimeout(() => ping({ retryOnFailure: true }), BACKEND_WAKE_RETRY_MS);
        }
      }
    };

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        ping({ retryOnFailure: true });
      }
    };

    ping({ retryOnFailure: true });
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      cancelled = true;
      clearTimers();
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, []);

  if (!user || status === 'ready' || status === 'checking') return null;

  return (
    <div className="backend-wake-banner" role="status" aria-live="polite">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Waking NutriTrack server...</span>
    </div>
  );
}

function getCachedWeeklyRecords() {
  try {
    const cached = JSON.parse(localStorage.getItem('nutritrack-weekly-cache') || '{}');
    return {
      rows: Array.isArray(cached.rows) ? cached.rows : [],
      tdee: Number(cached.tdee || 0)
    };
  } catch {
    return { rows: [], tdee: 0 };
  }
}

function getInitials(name) {
  const parts = String(name || 'User').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function AppContent() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <BackendWakeMonitor />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/nutriai" element={<ProtectedRoute><NutriAIPage /></ProtectedRoute>} />
          <Route path="/weekly-summary" element={<ProtectedRoute><WeeklySummary /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? <Dashboard /> : <About />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
