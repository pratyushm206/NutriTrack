/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { endOfWeek, format, startOfWeek, subWeeks } from 'date-fns';
import { ArrowLeft, BarChart3, CalendarDays, Check, Flame, Utensils, X, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

function emptyWeek(weekStart) {
  return {
    profile: null,
    rows: Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return {
        date: format(date, 'yyyy-MM-dd'),
        foodCalories: 0,
        exerciseCalories: 0,
        remaining: 0,
        protein: 0,
        foodEntries: 0,
        exerciseEntries: 0,
        tracked: false,
        withinGoal: false
      };
    }),
    totals: {
      foodCalories: 0,
      exerciseCalories: 0,
      remaining: 0,
      protein: 0,
      foodEntries: 0,
      exerciseEntries: 0,
      trackedDays: 0,
      daysOnTrack: 0
    }
  };
}

export default function WeeklySummary() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [summary, setSummary] = useState(() => emptyWeek(startOfWeek(new Date())));
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState({ current: 0 });
  const [selectedConsistency, setSelectedConsistency] = useState(null);

  useEffect(() => {
    let ignore = false;
    const start = format(weekStart, 'yyyy-MM-dd');
    const end = format(endOfWeek(weekStart), 'yyyy-MM-dd');
    setLoading(true);

    Promise.all([
      api.get(`/api/summary/weekly?start=${start}&end=${end}`),
      api.get(`/api/summary/streak?today=${format(new Date(), 'yyyy-MM-dd')}`)
    ])
      .then(([summaryRes, streakRes]) => {
        if (!ignore) {
          setSummary(summaryRes.data);
          setStreak(streakRes.data);
        }
      })
      .catch(() => {
        if (!ignore) setSummary(emptyWeek(weekStart));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [weekStart]);

  const stats = useMemo(() => {
    const trackedDays = summary.totals.trackedDays || 0;
    return {
      avgCalories: trackedDays ? Math.round(summary.totals.foodCalories / trackedDays) : null,
      avgProtein: trackedDays ? Math.round(summary.totals.protein / trackedDays) : null,
      avgBurned: trackedDays ? Math.round(summary.totals.exerciseCalories / trackedDays) : null
    };
  }, [summary]);

  const weekLabel = `${format(weekStart, 'EEE, MMM d, yyyy')} - ${format(endOfWeek(weekStart), 'EEE, MMM d, yyyy')}`;

  return (
    <div className="weekly-summary-page">
      <header className="weekly-page-head">
        <div className="weekly-title-row">
          <Link to="/" className="weekly-back" aria-label="Back to dashboard"><ArrowLeft /></Link>
          <h1>Weekly Summary</h1>
        </div>
      </header>

      <div className="weekly-tabs">
        <button className={`weekly-tab ${isSameWeek(weekStart, startOfWeek(new Date())) ? 'active' : ''}`} onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</button>
        <button className={`weekly-tab ${isSameWeek(weekStart, subWeeks(startOfWeek(new Date()), 1)) ? 'active' : ''}`} onClick={() => setWeekStart(subWeeks(startOfWeek(new Date()), 1))}>Last week</button>
        <button className={`weekly-tab ${isSameWeek(weekStart, subWeeks(startOfWeek(new Date()), 2)) ? 'active' : ''}`} onClick={() => setWeekStart(subWeeks(startOfWeek(new Date()), 2))}>2 weeks ago</button>
      </div>

      <section className="weekly-hero">
        <div>
          <p className="weekly-hero-date">{weekLabel}</p>
          <div className="weekly-hero-cal">{summary.totals.remaining.toLocaleString()} <span>calories under budget this week</span></div>
          <p className="weekly-hero-sub">{summary.totals.trackedDays} out of 7 days tracked this week</p>
        </div>
        <div className="weekly-tracked-badge"><CalendarDays /> {summary.totals.trackedDays} / 7 days tracked</div>
      </section>

      {loading && <p className="weekly-loading">Updating weekly summary...</p>}

      <section className="weekly-quick-stats">
        <QuickStat value={stats.avgCalories ? stats.avgCalories.toLocaleString() : '-'} label="Avg Calories" tone="green" />
        <QuickStat value={stats.avgProtein ? `${stats.avgProtein}g` : '-'} label="Avg Protein" tone="red" />
        <QuickStat value={stats.avgBurned ? stats.avgBurned.toLocaleString() : '-'} label="Avg Burned" tone="amber" />
        <QuickStat value={summary.profile?.weight_kg ? `${summary.profile.weight_kg}kg` : '-'} label="Avg Weight" tone="plain" />
      </section>

      <SummarySection icon={BarChart3} title="Calories" tone="green">
        <div className="weekly-table weekly-calorie-table">
          <div className="weekly-table-head"><span /><span>Food</span><span>Exercise</span><span>Remaining</span></div>
          {summary.rows.map(row => <CalorieRow key={row.date} row={row} />)}
          <div className="weekly-table-row total">
            <div><strong>Total</strong><small>This week</small></div>
            <span>{formatCell(summary.totals.foodCalories)}</span>
            <span>{formatCell(summary.totals.exerciseCalories)}</span>
            <span>{formatCell(summary.totals.remaining)}</span>
          </div>
        </div>
        <p className="weekly-note">* Based on a daily goal of {summary.profile?.tdee || 0} calories</p>
      </SummarySection>

      <SummarySection icon={Utensils} title="Macronutrients" tone="amber">
        <div className="weekly-table weekly-macro-table">
          <div className="weekly-table-head"><span /><span>Carbs</span><span>Protein</span><span>Fat</span></div>
          {summary.rows.map(row => (
            <div className="weekly-table-row" key={row.date}>
              <DateCell date={row.date} />
              <span className="empty">-</span>
              <span>{row.protein ? `${row.protein}g` : '-'}</span>
              <span className="empty">-</span>
            </div>
          ))}
          <div className="weekly-table-row total"><div><strong>Total</strong></div><span className="empty">-</span><span>{summary.totals.protein || '-'}g</span><span className="empty">-</span></div>
        </div>
        <p className="weekly-note">* Protein comes from saved logs. Carbs and fat need macro storage to be exact for old records.</p>
      </SummarySection>

      <SummarySection icon={Zap} title="Consistency Stats" tone="violet">
        <div className="weekly-streak-row">
          {summary.rows.map(row => <div key={row.date} className={`weekly-streak-day ${row.tracked ? 'tracked' : ''}`}>{format(new Date(`${row.date}T00:00:00`), 'EEE')}</div>)}
        </div>
        <div className="weekly-cons-grid">
          <Consistency label="Food Entries" value={summary.totals.foodEntries} sub="meals logged this week" tone="green" icon={Utensils} onClick={() => setSelectedConsistency({ title: 'Food Entries', body: `${summary.totals.foodEntries} food entries were logged during this selected week.` })} />
          <Consistency label="Exercise Entries" value={summary.totals.exerciseEntries} sub="sessions logged this week" tone="amber" icon={Flame} onClick={() => setSelectedConsistency({ title: 'Exercise Entries', body: `${summary.totals.exerciseEntries} exercise sessions were logged during this selected week.` })} />
          <Consistency label="Days on Track" value={`${summary.totals.daysOnTrack}/7`} sub="within calorie goal" tone="green" icon={Check} onClick={() => setSelectedConsistency({ title: 'Days on Track', body: `${summary.totals.daysOnTrack} days stayed within the calorie goal after exercise was counted.` })} />
          <Consistency label="Current Streak" value={`${streak.current || 0} days`} sub="consecutive days logged" tone="amber" icon={Zap} onClick={() => setSelectedConsistency({ title: 'Current Streak', body: `Your current streak is ${streak.current || 0} consecutive logged days.` })} />
        </div>
      </SummarySection>

      {selectedConsistency && (
        <div className="weekly-cons-modal-backdrop" role="dialog" aria-modal="true">
          <div className="weekly-cons-modal">
            <button className="icon-button" onClick={() => setSelectedConsistency(null)} aria-label="Close"><X /></button>
            <h2>{selectedConsistency.title}</h2>
            <p>{selectedConsistency.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SummarySection({ icon: Icon, title, tone, children }) {
  return (
    <section className="weekly-section">
      <h2><span className={`weekly-section-icon ${tone}`}><Icon /></span>{title}</h2>
      {children}
    </section>
  );
}

function QuickStat({ value, label, tone }) {
  return <article className={`weekly-quick-stat ${tone}`}><strong>{value}</strong><span>{label}</span><small>vs last week</small></article>;
}

function CalorieRow({ row }) {
  return (
    <div className="weekly-table-row">
      <DateCell date={row.date} />
      <span>{formatCell(row.foodCalories)}</span>
      <span>{formatCell(row.exerciseCalories)}</span>
      <span className={row.remaining < 0 ? 'negative' : ''}>{formatCell(row.remaining)}</span>
    </div>
  );
}

function DateCell({ date }) {
  const value = new Date(`${date}T00:00:00`);
  return <div><strong>{format(value, 'EEE')}</strong><small>{format(value, 'MMM d')}</small></div>;
}

function Consistency({ label, value, sub, tone, icon: Icon, onClick }) {
  return (
    <button className="weekly-cons-card" onClick={onClick}>
      <div><span>{label}</span><strong className={tone}>{value}</strong><small>{sub}</small></div>
      <i className={tone}><Icon /></i>
    </button>
  );
}

function formatCell(value) {
  return value ? Number(value).toLocaleString() : '-';
}

function isSameWeek(first, second) {
  return format(first, 'yyyy-MM-dd') === format(second, 'yyyy-MM-dd');
}
