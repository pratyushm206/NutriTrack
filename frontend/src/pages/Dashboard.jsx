/* eslint-disable no-unused-vars, react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfToday, startOfWeek, subDays, subMonths } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell, Flame, Sparkles, Target, Trash2, Utensils, X } from 'lucide-react';
import FoodLogger from '../components/FoodLogger';
import ExerciseLogger from '../components/ExerciseLogger';
import NutriAILogo from '../components/NutriAILogo';
import VantaBirdsBackground from '../components/VantaBirdsBackground';
import { useAuth } from '../contexts/useAuth';
import api from '../utils/api';

const NUTRITION_TIPS = [
  'Pair every main meal with a protein anchor like paneer, eggs, dal, chicken, tofu, curd, or sprouts.',
  'Log snacks before dinner so your remaining calories and protein target stay realistic.',
  'A short walk after meals can help digestion and gives your calorie balance a quiet boost.',
  'If protein is low by evening, choose a simple add-on: Greek yogurt, whey, eggs, tofu, or roasted chana.',
  'Use NutriAI after lunch to plan the rest of the day around your remaining calories.',
  'Keep one high-fibre food in each meal: fruit, vegetables, oats, beans, dal, or whole grains.',
  'When calories feel tight, increase volume with salad, soup, vegetables, or lean protein first.'
];

export default function Dashboard() {
  const { logout } = useAuth();
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [profile, setProfile] = useState(null);
  const [foodLogs, setFoodLogs] = useState([]);
  const [exerciseLogs, setExerciseLogs] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [macroDetail, setMacroDetail] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [historyCalendarOpen, setHistoryCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(startOfToday()));
  const [streak, setStreak] = useState({ current: 0, best: 0, trackedDates: [] });
  const [dailyTip] = useState(() => NUTRITION_TIPS[Math.floor(Math.random() * NUTRITION_TIPS.length)]);

  useEffect(() => {
    const goToday = () => {
      setSelectedDate(startOfToday());
      setSelectedFood(null);
      setSelectedExercise(null);
    };

    window.addEventListener('nutritrack:go-today', goToday);
    return () => window.removeEventListener('nutritrack:go-today', goToday);
  }, []);

  useEffect(() => {
    let ignore = false;
      api.get(`/api/summary/streak?today=${format(startOfToday(), 'yyyy-MM-dd')}`)
      .then(({ data }) => {
        if (!ignore) setStreak({ current: data.current || 0, best: data.best || 0, trackedDates: data.trackedDates || [] });
      })
      .catch(() => {
        if (!ignore) setStreak({ current: 0, best: 0, trackedDates: [] });
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const fetchData = async () => {
      setIsFetching(true);
      try {
        const [profileRes, foodRes, exRes] = await Promise.all([
          api.get('/api/profile'),
          api.get(`/api/food/log?date=${dateStr}`),
          api.get(`/api/exercise/log?date=${dateStr}`)
        ]);

        if (!ignore) {
          setProfile(profileRes.data);
          setFoodLogs(attachStoredAnalyses(foodRes.data));
          setExerciseLogs(attachStoredExerciseAnalyses(exRes.data));
        }
      } catch (err) {
        if (err.response?.status === 401) {
          logout();
          return;
        }
        console.error(err);
      } finally {
        if (!ignore) setIsFetching(false);
      }
    };

    fetchData();

    return () => {
      ignore = true;
    };
  }, [logout, selectedDate]);

  const deleteFood = async (id) => {
    await api.delete(`/api/food/log/${id}`);
    removeStoredAnalysis(id);
    setFoodLogs(foodLogs.filter(log => log.id !== id));
  };

  const deleteExercise = async (id) => {
    await api.delete(`/api/exercise/log/${id}`);
    removeStoredExerciseAnalysis(id);
    setExerciseLogs(exerciseLogs.filter(log => log.id !== id));
  };

  if (!profile) {
    return (
      <>
        <div className="dashboard-vanta-shell dashboard-loading-backdrop fixed inset-0 top-14" aria-hidden="true">
          <VantaBirdsBackground />
        </div>
        <div className="dashboard-loading-page relative z-10">
          <div className="dashboard-loader glass-card mx-auto mt-24 max-w-sm p-6 text-center">
            <div className="dashboard-loader-mark mx-auto mb-5">
              <span />
              <span />
              <span />
            </div>
            <p className="dashboard-loader-title">Loading dashboard...</p>
            <p className="dashboard-loader-copy mt-1">Preparing your calories, protein, and daily records.</p>
            <div className="dashboard-loader-track mt-5">
              <div />
            </div>
          </div>
        </div>
      </>
    );
  }

  const totalCaloriesIn = foodLogs.reduce((acc, log) => acc + log.calories, 0);
  const totalProtein = foodLogs.reduce((acc, log) => acc + log.protein_g, 0);
  const totalCaloriesBurned = exerciseLogs.reduce((acc, log) => acc + log.calories_burned, 0);
  const netCalories = totalCaloriesIn - totalCaloriesBurned;
  const caloriePercent = Math.min((netCalories / profile.tdee) * 100, 100);
  const proteinPercent = Math.min((totalProtein / profile.protein_target) * 100, 100);
  const macroTotals = getMacroTotals(foodLogs);
  const lastSevenDays = Array.from({ length: 7 }, (_, index) => subDays(startOfToday(), 6 - index));
  const loggedDates = new Set(streak.trackedDates || []);

  return (
    <>
      <div className="dashboard-vanta-shell fixed inset-0 top-14" aria-hidden="true">
        <VantaBirdsBackground />
      </div>
      <div className="dashboard-page relative z-10 space-y-4 sm:space-y-6">
        <section className="dashboard-hero-shell">
          <div className="glass-card dashboard-hero-card p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="dashboard-eyebrow">{format(selectedDate, 'EEEE, MMMM d')}</p>
                <h1 className="dashboard-title mt-3">Daily <em>Summary</em></h1>
                <p className="dashboard-copy mt-3">A clean view of calories, protein, food, and exercise for the day.</p>
              </div>
              <span className="dashboard-streak">{getStreakLabel(streak.current)}</span>
            </div>

          </div>

          <div id="date-strip" className="glass-card dashboard-week-card p-4">
            <div className="dashboard-date-label">
              <h2 className="section-title">Choose Date</h2>
            </div>
            <div className="dashboard-date-strip" aria-label="Last 7 days">
              {lastSevenDays.map(day => {
                const selected = isSameDay(day, selectedDate);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      setSelectedDate(day);
                      setHistoryCalendarOpen(false);
                    }}
                    className={`dashboard-date-btn ${selected ? 'dashboard-date-btn-selected' : ''}`}
                    aria-pressed={selected}
                  >
                    <span className="date-dow">{format(day, 'EEE')}</span>
                    <span className="date-num">{format(day, 'd')}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setHistoryCalendarOpen(prev => !prev)} className="dashboard-history-button" aria-label="Browse full history">
              <CalendarDays className="h-4 w-4" />
              <span>Browse history</span>
            </button>
            {historyCalendarOpen && (
              <div className="dashboard-calendar-popover">
                <MonthCalendar
                  month={visibleMonth}
                  selectedDate={selectedDate}
                  loggedDates={loggedDates}
                  onPrevious={() => setVisibleMonth(prev => subMonths(prev, 1))}
                  onNext={() => setVisibleMonth(prev => addMonths(prev, 1))}
                  onSelect={(day) => {
                    setSelectedDate(day);
                    setHistoryCalendarOpen(false);
                  }}
                />
              </div>
            )}
          </div>
        </section>

        <section className="stats-grid relative" aria-label="Nutrition metrics">
          {isFetching && <SummaryLoading />}
          <div className={`contents ${isFetching ? 'opacity-30' : ''}`}>
            <Metric icon={Target} label="Net Calories" value={netCalories} detail={`Target ${profile.tdee}`} percent={Math.max(caloriePercent, 0)} color="blue" />
            <Metric icon={Utensils} label="Eaten" value={totalCaloriesIn} detail="kcal logged" percent={profile.tdee ? Math.min((totalCaloriesIn / profile.tdee) * 100, 100) : 0} color="emerald" />
            <Metric icon={Flame} label="Burned" value={totalCaloriesBurned} detail="kcal active" percent={profile.tdee ? Math.min((totalCaloriesBurned / profile.tdee) * 100, 100) : 0} color="orange" />
            <Metric icon={Dumbbell} label="Protein" value={`${totalProtein}g`} detail={`Target ${profile.protein_target}g`} percent={proteinPercent} color="violet" />
          </div>
        </section>

        <section id="progress" className="relative">
          {isFetching && <ProgressLoading />}
          <div className={`progress-row ${isFetching ? 'opacity-30' : ''}`}>
            <RingProgressCard
              label="Calories remaining"
              value={`${netCalories} / ${profile.tdee} kcal logged today.`}
              remaining={`${Math.max(profile.tdee - netCalories, 0)} kcal left`}
              percent={Math.max(caloriePercent, 0)}
              accent="#22c55e"
              glow="rgba(34,197,94,0.42)"
              onClick={() => setMacroDetail('calories')}
            />
            <RingProgressCard
              label="Protein target"
              value={`${totalProtein} / ${profile.protein_target}g logged today.`}
              remaining={`${Math.max(profile.protein_target - totalProtein, 0)}g left`}
              percent={proteinPercent}
              accent="#ff8a7a"
              glow="rgba(249,112,96,0.38)"
              onClick={() => setMacroDetail('protein')}
            />
          </div>
        </section>

        <section className="macros-row" aria-label="Macro nutrients">
          <MacroCard label="Carbs" value={`${macroTotals.carbs}g`} color="amber" />
          <MacroCard label="Fat" value={`${macroTotals.fat}g`} color="orange" />
          <MacroCard label="Fibre" value={`${macroTotals.fibre}g`} color="emerald" />
          <MacroCard label="Sodium" value={`${macroTotals.sodium}mg`} color="blue" />
        </section>

        <section className="space-y-6">
          <div id="food-log" className="foodlog-card w-full">
            <h3 className="section-title mb-4 flex items-center gap-2"><Utensils className="h-5 w-5 text-primary-500" /> Food Log</h3>
            {foodLogs.length === 0 ? (
              <p className="muted mb-4 italic">No food logged today.</p>
            ) : (
              <div className="mb-4 space-y-3">
                {foodLogs.map(log => (
                  <LogItem key={log.id} name={log.food_name} detail={`${log.calories} kcal / ${log.protein_g}g protein`} onClick={() => setSelectedFood(log)} onDelete={() => deleteFood(log.id)} />
                ))}
              </div>
            )}
            <FoodLogger
              date={format(selectedDate, 'yyyy-MM-dd')}
              onLogAdded={log => {
                saveStoredAnalysis(log.id, log.analysis);
                setFoodLogs([...foodLogs, log]);
                setSelectedFood(log);
              }}
            />
          </div>

          <div id="exercise-log" className="foodlog-card w-full">
            <h3 className="section-title mb-4 flex items-center gap-2"><Dumbbell className="h-5 w-5 text-sky-500" /> Exercise Log</h3>
            {exerciseLogs.length === 0 ? (
              <p className="muted mb-4 italic">No exercise logged today.</p>
            ) : (
              <div className="mb-4 space-y-3">
                {exerciseLogs.map(log => (
                  <LogItem key={log.id} name={log.exercise_name} detail={`${log.duration_mins} mins / ${log.calories_burned} kcal`} onClick={() => setSelectedExercise(log)} onDelete={() => deleteExercise(log.id)} />
                ))}
              </div>
            )}
            <ExerciseLogger
              date={format(selectedDate, 'yyyy-MM-dd')}
              onLogAdded={log => {
                saveStoredExerciseAnalysis(log.id, log.analysis);
                setExerciseLogs([...exerciseLogs, log]);
                if (log.analysis) setSelectedExercise(log);
              }}
            />
          </div>
        </section>

        <aside className="tip-card" aria-label="Nutrition tip">
          <div className="tip-icon">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="tip-text">
            <strong>Tip:</strong> {dailyTip}
          </p>
        </aside>

        <section className="nutriai-dashboard-cta">
          <div>
            <p className="dashboard-eyebrow">NutriAI</p>
            <h3>Need help planning the rest of the day?</h3>
            <p>Open the dedicated NutriAI page for meal ideas, calorie checks, and protein guidance.</p>
          </div>
          <a href="/nutriai" target="nutritrack-nutriai" className="btn-primary">
            <Sparkles className="h-4 w-4" />
            Chat with NutriAI
          </a>
        </section>

        {selectedFood && <MealDetailsModal meal={selectedFood} onClose={() => setSelectedFood(null)} />}
        {selectedExercise && <ExerciseDetailsModal exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />}
        {macroDetail && <MacroDetailsModal type={macroDetail} foodLogs={foodLogs} profile={profile} totals={{ totalCaloriesIn, totalProtein }} onClose={() => setMacroDetail(null)} />}
      </div>
    </>
  );
}

function getStreakLabel(days) {
  if (!days) return 'Start your streak today';
  if (days === 1) return 'Day 1 - streak started';
  return `${days}-day streak`;
}

function MacroCard({ label, value, color }) {
  const colors = {
    amber: 'macro-amber',
    orange: 'macro-orange',
    emerald: 'macro-emerald',
    blue: 'macro-blue'
  };

  return (
    <article className={`macro-card ${colors[color]}`}>
      <div className="macro-val">{value}</div>
      <div className="macro-lbl">{label}</div>
      <div className="macro-bar"><div className="macro-bar-fill" /></div>
    </article>
  );
}

function getMacroTotals(foodLogs) {
  return foodLogs.reduce((totals, log) => {
    const analysis = log.analysis || {};
    return {
      carbs: totals.carbs + Math.round(Number(analysis.carbs_g || 0)),
      fat: totals.fat + Math.round(Number(analysis.fat_g || 0)),
      fibre: totals.fibre + Math.round(Number(analysis.fiber_g || analysis.fibre_g || 0)),
      sodium: totals.sodium + Math.round(Number(analysis.sodium_mg || 0))
    };
  }, { carbs: 0, fat: 0, fibre: 0, sodium: 0 });
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
        if (block.type === 'heading') return <h4 key={index}>{renderInlineMarkdown(block.text)}</h4>;
        if (block.type === 'list') return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}</ul>;
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
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
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
    if (/^\b\d[\d,]*(?:\s*(?:to|-)\s*\d[\d,]*)?\s*(?:calories|kcal|grams|g|minutes?|minute|g protein)\b$/i.test(part) || /^[A-Z][A-Za-z' ]{2,24}:$/.test(part)) return <strong key={`${keyPrefix}-${index}`}>{part}</strong>;
    return part;
  });
}

function MonthCalendar({ month, selectedDate, loggedDates, onPrevious, onNext, onSelect }) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd)
  });

  return (
    <div className="dashboard-month-calendar">
      <div className="dashboard-calendar-selected">
        <span>{format(selectedDate, 'EEEE, d MMMM')}</span>
      </div>
      <div className="dashboard-calendar-head">
        <p>{format(month, 'MMMM, yyyy')}</p>
        <div>
          <button type="button" onClick={onPrevious} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={onNext} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="dashboard-calendar-weekdays">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day}>{day}</span>)}
      </div>
      <div className="dashboard-calendar-grid">
        {calendarDays.map(day => {
          const currentMonth = day >= monthStart && day <= monthEnd;
          const selected = isSameDay(day, selectedDate);
          const logged = loggedDates.has(format(day, 'yyyy-MM-dd'));
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              className={`${selected ? 'selected' : ''} ${logged ? 'logged' : ''} ${currentMonth ? '' : 'outside'}`}
              aria-label={`${format(day, 'MMMM d, yyyy')}${logged ? ', logged' : ''}`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, color, percent = 0 }) {
  const colors = {
    blue: 'metric-blue text-blue-300',
    emerald: 'metric-emerald text-emerald-300',
    orange: 'metric-orange text-orange-300',
    violet: 'metric-violet text-violet-300'
  };
  return (
    <div className={`stat-card dashboard-metric-card bg-gradient-to-br ${colors[color]}`}>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/8"><Icon className="h-5 w-5" /></div>
      <p className="muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-white sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
      <div className="dashboard-metric-bar"><span style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }} /></div>
    </div>
  );
}

function SummaryLoading() {
  return (
    <div className="absolute inset-0 z-10 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="stat-card overflow-hidden">
          <div className="mb-3 h-9 w-9 animate-pulse rounded-lg bg-slate-700/30" />
          <div className="h-3 w-20 animate-pulse rounded-full bg-slate-700/30" />
          <div className="mt-3 h-8 w-24 animate-pulse rounded-full bg-slate-700/30" />
          <div className="mt-3 h-3 w-16 animate-pulse rounded-full bg-slate-700/30" />
        </div>
      ))}
    </div>
  );
}

function ProgressLoading() {
  return (
    <div className="absolute inset-0 z-10 grid gap-4 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="glass-card grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-5 sm:p-5">
          <div className="mx-auto h-[128px] w-[128px] animate-pulse rounded-full border-[10px] border-slate-700/30 bg-slate-950/20 sm:h-[148px] sm:w-[148px] sm:border-[12px]" />
          <div className="space-y-4">
            <div className="h-5 w-36 animate-pulse rounded-full bg-slate-700/30" />
            <div className="h-4 w-28 animate-pulse rounded-full bg-slate-700/30" />
            <div className="h-7 w-40 animate-pulse rounded-full bg-slate-700/30" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RingProgressCard({ label, value, remaining, percent, accent, glow, onClick }) {
  const size = 148;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(percent, 100));
  const offset = circumference - (clampedPercent / 100) * circumference;

  return (
    <button type="button" onClick={onClick} className="glass-card prog-card grid w-full gap-4 p-4 text-left transition-all hover:-translate-y-1 hover:border-teal-300/50 hover:shadow-[0_24px_70px_rgba(20,184,166,0.16)] sm:grid-cols-[auto_1fr] sm:items-center sm:gap-5 sm:p-5">
      <div className="relative mx-auto h-[148px] w-[148px]">
        <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(148,163,184,0.13)" strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={accent} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ filter: `drop-shadow(0 0 10px ${glow})`, transition: 'stroke-dashoffset 900ms ease', '--ring-circumference': circumference }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white">{Math.round(clampedPercent)}%</span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">complete</span>
        </div>
      </div>
      <div>
        <p className="text-lg font-black text-white">{label}</p>
        <p className="mt-2 text-sm font-semibold text-slate-400">{value}</p>
        <p className="neon-text mt-4 text-xl font-black">{remaining}</p>
      </div>
    </button>
  );
}

function LogItem({ name, detail, onClick, onDelete }) {
  const open = () => {
    if (onClick) onClick();
  };
  return (
    <div role="button" tabIndex={0} onClick={open} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') open(); }} className="log-item-card flex w-full cursor-pointer items-center justify-between rounded-lg border border-slate-700/70 bg-[#172033] p-3 text-left shadow-sm transition-all hover:border-teal-300/40 hover:bg-[#123440] hover:shadow-[0_0_24px_rgba(45,212,191,0.12)]">
      <div>
        <div className="font-bold capitalize text-slate-950 dark:text-white">{name}</div>
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">{detail}</div>
      </div>
      <button onClick={(event) => { event.stopPropagation(); onDelete(); }} className="icon-button text-slate-400 hover:text-red-500" aria-label={`Delete ${name}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function MacroDetailsModal({ type, foodLogs, profile, totals, onClose }) {
  const isProtein = type === 'protein';
  const target = isProtein ? profile.protein_target : profile.tdee;
  const total = isProtein ? totals.totalProtein : totals.totalCaloriesIn;
  const unit = isProtein ? 'g' : 'kcal';
  const title = isProtein ? 'Protein by Food' : 'Calories by Food';
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="glass-card max-h-[92vh] w-full overflow-y-auto rounded-t-lg shadow-xl sm:mx-auto sm:max-w-xl sm:rounded-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700/70 bg-slate-950/80 p-4 backdrop-blur-xl">
          <div>
            <h2 className="text-xl font-black text-white">{title}</h2>
            <p className="muted mt-1">{total} / {target} {unit}</p>
          </div>
          <button onClick={onClose} className="icon-button" aria-label="Close details"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 p-4">
          {foodLogs.length === 0 ? (
            <p className="rounded-lg border border-slate-700/70 bg-[#172033] p-4 text-sm text-slate-400">No food logged for this date.</p>
          ) : (
            foodLogs.map(food => {
              const value = isProtein ? food.protein_g : food.calories;
              const percent = target ? Math.min((value / target) * 100, 100) : 0;
              return (
                <div key={food.id} className="rounded-lg border border-slate-800 bg-slate-950/45 p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black capitalize text-white">{food.food_name}</p>
                      <p className="text-xs text-slate-400">{isProtein ? `${food.calories} kcal` : `${food.protein_g}g protein`}</p>
                    </div>
                    <p className="font-black text-teal-300">{value} {unit}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-teal-300" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function ExerciseDetailsModal({ exercise, onClose }) {
  const analysis = exercise.analysis || {};
  const breakdown = Array.isArray(analysis.breakdown) ? analysis.breakdown : [];
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="glass-card max-h-[92vh] w-full overflow-y-auto rounded-t-lg shadow-xl sm:mx-auto sm:max-w-xl sm:rounded-lg">
        <ModalHeader title={exercise.exercise_name} subtitle="Exercise burn details" onClose={onClose} capitalize />
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniFact label="Calories" value={`${exercise.calories_burned} kcal`} />
            <MiniFact label="Duration" value={`${exercise.duration_mins} mins`} />
            <MiniFact label="Fat burn" value={`${Math.round(analysis.fat_burn_g || 0)}g`} />
            <MiniFact label="Carb burn" value={`${Math.round(analysis.carbs_burn_g || 0)}g`} />
          </div>
          {analysis.summary ? <InfoSection title="AI Analysis">{analysis.summary}</InfoSection> : <p className="rounded-lg border border-slate-700/70 bg-[#172033] p-4 text-sm text-slate-400">Detailed AI analysis is not available for this preset log.</p>}
          {breakdown.length > 0 && (
            <section className="rounded-lg border border-slate-700/70 bg-slate-950/28 p-4">
              <h3 className="mb-2 font-black text-white">Breakdown</h3>
              <div className="divide-y divide-slate-800">
                {breakdown.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="font-bold text-slate-100">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export function MealDetailsModal({ meal, onClose }) {
  const analysis = meal.analysis || {};
  const items = Array.isArray(analysis.items) ? analysis.items : [];
  const facts = Array.isArray(analysis.nutrition_facts) ? analysis.nutrition_facts : [];
  const carbs = analysis.carbs_g ?? 0;
  const fat = analysis.fat_g ?? 0;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="glass-card max-h-[92vh] w-full overflow-y-auto rounded-t-lg shadow-xl sm:mx-auto sm:max-w-2xl sm:rounded-lg">
        <ModalHeader title={meal.food_name} subtitle="Meal nutrition details" onClose={onClose} capitalize />
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniFact label="Calories" value={`${meal.calories} kcal`} />
            <MiniFact label="Protein" value={`${meal.protein_g}g`} />
            <MiniFact label="Carbs" value={`${Math.round(carbs)}g`} />
            <MiniFact label="Fat" value={`${Math.round(fat)}g`} />
          </div>
          {items.length > 0 ? (
            <section className="rounded-lg border border-slate-700/70 bg-slate-950/28 p-4">
              <h3 className="mb-3 font-black text-white">Detected Items</h3>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold capitalize text-white">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.quantity}</p>
                      </div>
                      <p className="font-black text-teal-300">{Math.round(item.calories || 0)} kcal</p>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
                      <span>Protein {Math.round(item.protein_g || 0)}g</span>
                      <span>Carbs {Math.round(item.carbs_g || 0)}g</span>
                      <span>Fat {Math.round(item.fat_g || 0)}g</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : <p className="rounded-lg border border-slate-700/70 bg-[#172033] p-4 text-sm text-slate-400">Detailed item analysis is not available for this older log.</p>}
          {analysis.health_analysis && <InfoSection title="Health Analysis">{analysis.health_analysis}</InfoSection>}
          {facts.length > 0 && (
            <section className="rounded-lg border border-slate-700/70 bg-slate-950/28 p-4">
              <h3 className="mb-2 font-black text-white">Nutrition Facts</h3>
              <div className="divide-y divide-slate-800">
                {facts.map((fact, index) => (
                  <div key={`${fact.label}-${index}`} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="text-slate-400">{fact.label}</span>
                    <span className="font-bold text-slate-100">{fact.value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose, capitalize }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700/70 bg-slate-950/80 p-4 backdrop-blur-xl">
      <div>
        <h2 className={`text-xl font-black text-white ${capitalize ? 'capitalize' : ''}`}>{title}</h2>
        <p className="muted mt-1">{subtitle}</p>
      </div>
      <button onClick={onClose} className="icon-button" aria-label="Close details"><X className="h-5 w-5" /></button>
    </div>
  );
}

function InfoSection({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-700/70 bg-slate-950/28 p-4">
      <h3 className="mb-2 font-black text-white">{title}</h3>
      <p className="text-sm leading-6 text-slate-300">{children}</p>
    </section>
  );
}

function MiniFact({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/45 p-3">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="neon-text mt-1 font-black">{value}</p>
    </div>
  );
}

function getStoredAnalyses() {
  try {
    return JSON.parse(localStorage.getItem('nutritrack-food-analyses') || '{}');
  } catch {
    return {};
  }
}

export function attachStoredAnalyses(logs) {
  const analyses = getStoredAnalyses();
  return logs.map(log => ({ ...log, analysis: analyses[log.id] }));
}

function saveStoredAnalysis(id, analysis) {
  if (!id || !analysis) return;
  const analyses = getStoredAnalyses();
  analyses[id] = analysis;
  localStorage.setItem('nutritrack-food-analyses', JSON.stringify(analyses));
}

function removeStoredAnalysis(id) {
  const analyses = getStoredAnalyses();
  delete analyses[id];
  localStorage.setItem('nutritrack-food-analyses', JSON.stringify(analyses));
}

function getStoredExerciseAnalyses() {
  try {
    return JSON.parse(localStorage.getItem('nutritrack-exercise-analyses') || '{}');
  } catch {
    return {};
  }
}

export function attachStoredExerciseAnalyses(logs) {
  const analyses = getStoredExerciseAnalyses();
  return logs.map(log => ({ ...log, analysis: analyses[log.id] }));
}

function saveStoredExerciseAnalysis(id, analysis) {
  if (!id || !analysis) return;
  const analyses = getStoredExerciseAnalyses();
  analyses[id] = analysis;
  localStorage.setItem('nutritrack-exercise-analyses', JSON.stringify(analyses));
}

function removeStoredExerciseAnalysis(id) {
  const analyses = getStoredExerciseAnalyses();
  delete analyses[id];
  localStorage.setItem('nutritrack-exercise-analyses', JSON.stringify(analyses));
}
