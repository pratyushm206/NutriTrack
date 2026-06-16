import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Award, CalendarDays, Dumbbell, Edit3, Flame, LogOut, Medal, Target, Trophy, Utensils, Weight, X, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import api from '../utils/api';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [profileDraft, setProfileDraft] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState('');
  const [deleteStatus, setDeleteStatus] = useState('');
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [showBmiDetails, setShowBmiDetails] = useState(false);
  const [stats, setStats] = useState({
    currentStreak: 0,
    daysLogged: 0,
    daysInMonth: 31,
    avgCalories: 0,
    avgProtein: 0,
    achievements: {}
  });

  useEffect(() => {
    Promise.all([
      api.get('/api/profile'),
      api.get('/api/summary/profile-stats')
    ])
      .then(([profileRes, statsRes]) => {
        setProfile(profileRes.data);
        setProfileDraft(createProfileDraft(profileRes.data));
        setStats(statsRes.data);
      })
      .catch(() => {});
  }, []);

  const bmi = useMemo(() => {
    if (!profile?.weight_kg || !profile?.height_cm) return null;
    return profile.weight_kg / ((profile.height_cm / 100) ** 2);
  }, [profile]);

  const bmiPercent = Math.min(Math.max(((bmi || 0) / 40) * 100, 4), 96);
  const memberSince = stats.memberSince ? new Date(stats.memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'May 2026';
  const achievements = stats.achievements || {};

  const updateProfileDraft = (key, value) => {
    setProfileDraft(prev => ({ ...(prev || createProfileDraft(profile)), [key]: value }));
  };

  const saveProfile = async () => {
    if (!profileDraft) return;
    setProfileStatus('Saving profile...');
    try {
      const { data } = await api.post('/api/profile', profileDraft);
      setProfile(data);
      setProfileDraft(createProfileDraft(data));
      setProfileStatus('Profile updated.');
      setEditingProfile(false);
    } catch (error) {
      setProfileStatus(error.response?.data?.error || 'Could not save profile.');
    }
  };

  const deleteAccount = async () => {
    const confirmed = window.confirm('Delete your account and all related data? This permanently removes your profile, food logs, exercise logs, and login.');
    if (!confirmed) return;

    setDeleteStatus('Deleting account and related data...');
    try {
      await api.delete('/api/auth/me');
      localStorage.removeItem('nutritrack-food-analyses');
      localStorage.removeItem('nutritrack-exercise-analyses');
      localStorage.removeItem('nutritrack-weekly-cache');
      localStorage.removeItem('nutritrack-current-weight');
      localStorage.removeItem('nutritrack-target-weight');
      localStorage.removeItem('nutritrack-contact-info');
      logout();
      navigate('/signup');
    } catch (error) {
      setDeleteStatus(error.response?.data?.error || 'Could not delete account.');
    }
  };

  const achievementItems = getAchievementItems(achievements, stats);

  return (
    <div className="nt-profile-page">
      <section className="nt-profile-hero">
        <div className="nt-avatar-ring">{initials(user?.name)}</div>
        <div className="nt-profile-main">
          <h1>{user?.name || 'Profile'}</h1>
          <p>{user?.email}</p>
          <div className="nt-profile-tags">
            <span><Flame /> {goalLabel(profile?.goal)} Goal</span>
            <span className="amber"><Dumbbell /> {activityLabel(profile?.activity_level)}</span>
            <span className="violet"><Award /> Member since {memberSince}</span>
          </div>
        </div>
        <div className="nt-profile-actions">
          <button className="nt-btn primary" onClick={() => setEditingProfile(prev => !prev)}><Edit3 /> Edit Profile</button>
          <Link to="/weekly-summary" target="_blank" rel="noreferrer" className="nt-btn outline"><CalendarDays /> Weekly Summary</Link>
          <button className="nt-btn outline" onClick={logout}><LogOut /> Log Out</button>
        </div>
      </section>

      {editingProfile && (
        <section className="nt-panel nt-edit-profile-card">
          <h2><span><Edit3 /></span>Edit Profile</h2>
          <ProfileEditPanel
            draft={profileDraft}
            status={profileStatus}
            onChange={updateProfileDraft}
            onSave={saveProfile}
          />
        </section>
      )}

      <section className="nt-profile-grid">
        <article className="nt-panel">
          <h2><span><Utensils /></span>Nutrition Profile</h2>
          <div className="nt-four">
            <Fact label="Daily Target" value={profile?.tdee || '-'} unit="kcal" tone="green" />
            <Fact label="Protein Goal" value={profile?.protein_target || '-'} unit="g" tone="red" />
            <Fact label="Weight" value={profile?.weight_kg || '-'} unit="kg" tone="violet" />
            <Fact label="Height" value={profile?.height_cm || '-'} unit="cm" tone="cyan" />
          </div>
          <Stat label="Goal Type" value={goalLabel(profile?.goal)} tone="green" />
          <Stat label="Activity Level" value={activityLabel(profile?.activity_level)} />
          <Stat label="Age" value={profile?.age ? `${profile.age} years` : '-'} />
          <Stat label="Biological Sex" value={profile?.gender || '-'} />
        </article>

        <div className="nt-profile-side">
          <button className="nt-panel nt-bmi-tile" onClick={() => setShowBmiDetails(true)}>
            <h2><span className="amber"><Target /></span>BMI Index</h2>
            <div className="nt-bmi-line"><strong>{bmi ? bmi.toFixed(1) : '-'}</strong><em>{bmiLabel(bmi)}</em></div>
            <div className="nt-bmi-bar"><i style={{ left: `${bmiPercent}%` }} /></div>
            <div className="nt-bmi-labels"><span>Under</span><span>Normal</span><span>Over</span><span>Obese</span></div>
          </button>

          <article className="nt-panel">
            <h2><span className="violet"><Zap /></span>Macro Split Target</h2>
            <div className="nt-donut-wrap">
              <div className="nt-donut" />
              <div className="nt-donut-list">
                <p><i className="amber" /> Carbs <strong>50%</strong></p>
                <p><i className="red" /> Protein <strong>25%</strong></p>
                <p><i className="violet" /> Fat <strong>25%</strong></p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="nt-achievements">
        <h2><span><Trophy /></span>Achievements</h2>
        <div className="nt-ach-grid">
          {achievementItems.map(item => (
            <Achievement key={item.title} item={item} onSelect={() => item.active && setSelectedAchievement(item)} />
          ))}
        </div>
      </section>

      <section className="nt-panel nt-danger">
        <h2><span><AlertTriangle /></span>Danger Zone</h2>
        <button className="nt-btn danger" onClick={deleteAccount}>Delete my account and related data</button>
        <button className="nt-btn outline" onClick={logout}><LogOut /> Log Out of All Devices</button>
        {deleteStatus && <p className="nt-danger-status">{deleteStatus}</p>}
      </section>

      {showBmiDetails && (
        <InfoModal title="How BMI is calculated" onClose={() => setShowBmiDetails(false)}>
          <p>BMI = weight in kg divided by height in meters squared.</p>
          <p>Your calculation: {profile?.weight_kg || '-'} kg / ({profile?.height_cm || '-'} cm / 100)^2 = {bmi ? bmi.toFixed(1) : '-'}</p>
        </InfoModal>
      )}

      {selectedAchievement && (
        <InfoModal title={selectedAchievement.title} onClose={() => setSelectedAchievement(null)} glow>
          <p>{selectedAchievement.detail}</p>
          <p>{selectedAchievement.progress}</p>
          <strong>Completed</strong>
        </InfoModal>
      )}
    </div>
  );
}

function ProfileEditPanel({ draft, status, onChange, onSave }) {
  if (!draft) return <p>Loading profile...</p>;

  return (
    <div className="nt-edit-profile-panel">
      <div className="nt-edit-profile-grid">
        <label>Age<input type="number" value={draft.age} onChange={event => onChange('age', event.target.value)} /></label>
        <label>Weight kg<input type="number" value={draft.weight_kg} onChange={event => onChange('weight_kg', event.target.value)} /></label>
        <label>Height cm<input type="number" value={draft.height_cm} onChange={event => onChange('height_cm', event.target.value)} /></label>
        <label>Gender<select value={draft.gender} onChange={event => onChange('gender', event.target.value)}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
        <label>Activity<select value={draft.activity_level} onChange={event => onChange('activity_level', event.target.value)}><option value="sedentary">Sedentary</option><option value="light">Lightly Active</option><option value="moderate">Moderately Active</option><option value="active">Active</option><option value="very_active">Very Active</option></select></label>
        <label>Goal<select value={draft.goal} onChange={event => onChange('goal', event.target.value)}><option value="lose">Weight Loss</option><option value="maintain">Maintenance</option><option value="gain">Muscle Gain</option></select></label>
      </div>
      {status && <p className="nt-edit-profile-status">{status}</p>}
      <button className="nt-btn primary" onClick={onSave}>Save Profile</button>
    </div>
  );
}

function createProfileDraft(profile) {
  return {
    age: profile?.age ?? '',
    gender: profile?.gender || 'male',
    weight_kg: profile?.weight_kg ?? '',
    height_cm: profile?.height_cm ?? '',
    activity_level: profile?.activity_level || 'sedentary',
    goal: profile?.goal || 'maintain'
  };
}

function Fact({ label, value, unit, tone }) {
  return <div className="nt-fact"><span>{label}</span><strong className={tone}>{value}<small> {unit}</small></strong></div>;
}

function Stat({ label, value, tone }) {
  return <div className="nt-stat-row"><span>{label}</span><strong className={tone || ''}>{value}</strong></div>;
}

function Achievement({ item, onSelect }) {
  const Icon = item.icon;
  return (
    <button className={`nt-ach ${item.active ? 'completed' : 'locked'}`} onClick={onSelect} disabled={!item.active}>
      <span><Icon /></span>
      <strong>{item.title}</strong>
      <small>{item.sub}</small>
    </button>
  );
}

function InfoModal({ title, children, onClose, glow }) {
  return (
    <div className="nt-info-modal-backdrop" role="dialog" aria-modal="true">
      <div className={`nt-info-modal ${glow ? 'glow' : ''}`}>
        <button className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        <h2>{title}</h2>
        <div>{children}</div>
      </div>
    </div>
  );
}

function getAchievementItems(achievements, stats) {
  return [
    { icon: Zap, title: 'First Log', sub: 'Logged first meal', active: achievements.firstLog, detail: 'Awarded when you log your first food or exercise entry.', progress: `${stats.totalFoodLogs + stats.totalExerciseLogs} total logs.` },
    { icon: Award, title: '7-Day Streak', sub: 'Log 7 days in a row', active: achievements.sevenDayStreak, detail: 'Awarded for tracking nutrition or exercise seven consecutive days.', progress: `${stats.currentStreak || 0} current streak days.` },
    { icon: Dumbbell, title: 'Protein Pro', sub: 'Hit protein 5 days', active: achievements.proteinPro, detail: 'Awarded after reaching your protein target on five days.', progress: `${stats.proteinDays || 0}/5 protein target days.` },
    { icon: Flame, title: 'Consistent', sub: '30-day streak', active: achievements.consistent, detail: 'Awarded for a 30-day logging streak.', progress: `${stats.currentStreak || 0}/30 streak days.` },
    { icon: Weight, title: 'Muscle Builder', sub: 'Log exercise 10x', active: achievements.muscleBuilder, detail: 'Awarded after logging ten exercise sessions.', progress: `${stats.totalExerciseLogs || 0}/10 exercise logs.` },
    { icon: Target, title: 'Goal Crusher', sub: 'Hit calorie goal 7x', active: achievements.goalCrusher, detail: 'Awarded after staying within your calorie goal on seven days.', progress: `${stats.calorieGoalDays || 0}/7 days on track.` },
    { icon: Medal, title: 'Early Bird', sub: 'Log breakfast 7x', active: achievements.earlyBird, detail: 'Awarded after logging breakfast seven times.', progress: `${stats.breakfastLogs || 0}/7 breakfast logs.` },
    { icon: Utensils, title: "Chef's Pick", sub: 'Log 50 unique meals', active: achievements.chefsPick, detail: 'Awarded after logging 50 unique meal names.', progress: `${stats.uniqueMeals || 0}/50 unique meals.` }
  ];
}

function initials(name) {
  return (name || 'User').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function goalLabel(goal) {
  return ({ lose: 'Weight Loss', maintain: 'Maintenance', gain: 'Muscle Gain' })[goal] || 'Weight Loss';
}

function activityLabel(activity) {
  return ({ sedentary: 'Sedentary', light: 'Lightly Active', moderate: 'Moderately Active', active: 'Active', very_active: 'Very Active' })[activity] || 'Moderately Active';
}

function bmiLabel(bmi) {
  if (!bmi) return '-';
  if (bmi < 18.5) return 'Under';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Over';
  return 'Obese';
}
