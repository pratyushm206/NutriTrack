import { useEffect, useState } from 'react';
import { Info, Lock, Shield, User, Utensils, CalendarDays } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import api from '../utils/api';

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileDraft, setProfileDraft] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState('');
  const [passwordDraft, setPasswordDraft] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordStatus, setPasswordStatus] = useState('');
  const [dataRetention, setDataRetention] = useState('forever');
  const [savedDataRetention, setSavedDataRetention] = useState('forever');
  const [retentionStatus, setRetentionStatus] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/profile'),
      api.get('/api/profile/retention')
    ])
      .then(([profileRes, retentionRes]) => {
        setProfile(profileRes.data);
        setProfileDraft(createProfileDraft(profileRes.data));
        const retention = retentionRes.data?.dataRetention || 'forever';
        setDataRetention(retention);
        setSavedDataRetention(retention);
      })
      .catch(() => {});
  }, []);

  const carbsTarget = profile?.tdee ? Math.round((profile.tdee * 0.5) / 4) : 0;
  const fatTarget = profile?.tdee ? Math.round((profile.tdee * 0.25) / 9) : 0;

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

  const savePassword = async () => {
    setPasswordStatus('Updating password...');
    try {
      await api.post('/api/auth/change-password', passwordDraft);
      setPasswordDraft({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordStatus('Password changed.');
    } catch (error) {
      setPasswordStatus(error.response?.data?.error || 'Could not change password.');
    }
  };

  const saveRetention = async () => {
    setRetentionStatus('Saving retention setting...');
    try {
      const { data } = await api.put('/api/profile/retention', { dataRetention });
      setSavedDataRetention(data.dataRetention);
      const deleted = Number(data.deletedFoodLogs || 0) + Number(data.deletedExerciseLogs || 0);
      setRetentionStatus(deleted ? `Saved. Removed ${deleted} old records.` : 'Saved.');
    } catch (error) {
      setRetentionStatus(error.response?.data?.error || 'Could not save retention setting.');
    }
  };

  return (
    <div className="nt-settings-page">
      <main className="nt-settings-content">
        <header>
          <h1>Settings</h1>
          <p>Dashboard tools and preferences</p>
        </header>

        <SettingsCard id="account" icon={User} title="Account" sub="Manage your profile and credentials" tone="green">
          <SettingRow label="Name" sub="Your display name across the app"><span>{user?.name}</span><button className="nt-mini-btn" onClick={() => setEditingProfile(prev => !prev)}>Edit Profile</button></SettingRow>
          <SettingRow label="Email" sub="Used for login and notifications"><span>{user?.email}</span></SettingRow>
          <SettingRow label="Password" sub="Verify your old password before setting a new one"><span className="nt-readonly-value">Protected</span></SettingRow>
          <PasswordPanel
            draft={passwordDraft}
            status={passwordStatus}
            onChange={(key, value) => setPasswordDraft(prev => ({ ...prev, [key]: value }))}
            onSave={savePassword}
          />
          {editingProfile && (
            <ProfileEditPanel
              draft={profileDraft}
              status={profileStatus}
              onChange={updateProfileDraft}
              onSave={saveProfile}
            />
          )}
        </SettingsCard>

        <SettingsCard id="goals" icon={Utensils} title="Nutrition Goals" sub="Customize your daily calorie and macro targets" tone="amber">
          <SettingRow label="Daily Calorie Goal" sub="TDEE-based target for weight management"><ReadOnlyValue value={profile?.tdee || '-'} unit="kcal" /></SettingRow>
          <SettingRow label="Protein Target" sub="Recommended: 1.8g x body weight"><ReadOnlyValue value={profile?.protein_target || '-'} unit="g" /></SettingRow>
          <SettingRow label="Carbohydrates" sub="50% of daily calories"><ReadOnlyValue value={carbsTarget || '-'} unit="g" /></SettingRow>
          <SettingRow label="Fat Target" sub="25% of daily calories"><ReadOnlyValue value={fatTarget || '-'} unit="g" /></SettingRow>
          <SettingRow label="Goal Type" sub="Affects your TDEE calculation"><span className="nt-readonly-value">{goalLabel(profile?.goal)}</span></SettingRow>
          <SettingRow label="Activity Level" sub="Used to calculate calorie burn estimates"><span className="nt-readonly-value">{activityLabel(profile?.activity_level)}</span></SettingRow>
        </SettingsCard>

        <SettingsCard id="privacy" icon={Shield} title="Privacy & Data" sub="Control how your data is used" tone="green">
          <SettingRow label="Analytics & Usage Data" sub="Locked until privacy controls are available"><LockedControl /></SettingRow>
          <SettingRow label="AI Personalisation" sub="Locked until privacy controls are available"><LockedControl /></SettingRow>
          <SettingRow label="Units" sub="Weight and measurement system"><select><option>Metric (kg, cm)</option><option>Imperial (lbs, ft)</option></select></SettingRow>
        </SettingsCard>

        <SettingsCard id="history" icon={CalendarDays} title="History & Weight Tracker" sub="Configure how past data is stored and displayed" tone="violet">
          <SettingRow label="Browse Full History" sub="View all past food and exercise logs"><a href="/">Open History</a></SettingRow>
          <SettingRow label="Weight Tracker" sub="Log and visualise your weight over time"><a href="/profile">Open Tracker</a></SettingRow>
          <SettingRow label="Data Retention" sub="Saving 1 year or 1 month deletes older food and exercise logs">
            <select value={dataRetention} onChange={event => setDataRetention(event.target.value)}>
              <option value="forever">Forever</option>
              <option value="1_year">1 year</option>
              <option value="1_month">1 month</option>
            </select>
            <button className="nt-mini-btn" onClick={saveRetention} disabled={dataRetention === savedDataRetention}>Save</button>
          </SettingRow>
          {retentionStatus && <p className="nt-settings-status">{retentionStatus}</p>}
        </SettingsCard>

        <SettingsCard id="about" icon={Info} title="About NutriTrack" sub="Version and support information" tone="green">
          <SettingRow label="Version"><span>v1.0.0 - May 2026</span></SettingRow>
          <SettingRow label="Built by"><span className="green">Pratyush Mishra</span></SettingRow>
        </SettingsCard>
      </main>
    </div>
  );
}

function ProfileEditPanel({ draft, status, onChange, onSave }) {
  if (!draft) return <div className="nt-edit-profile-panel">Loading profile...</div>;

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

function SettingsCard({ id, icon: Icon, title, sub, tone, locked, children }) {
  return <section id={id} className={`nt-settings-card ${locked ? 'nt-settings-locked' : ''}`}><h2><span className={tone}><Icon /></span><b>{title}</b><small>{sub}</small></h2>{children}</section>;
}

function SettingRow({ label, sub, children }) {
  return <div className="nt-setting-row"><div><strong>{label}</strong>{sub && <small>{sub}</small>}</div><div>{children}</div></div>;
}

function ReadOnlyValue({ value, unit }) {
  return <span className="nt-readonly-value"><b>{value}</b>{unit && <small>{unit}</small>}</span>;
}

function LockedControl() {
  return <span className="nt-locked-control"><Lock /> Locked</span>;
}

function PasswordPanel({ draft, status, onChange, onSave }) {
  return (
    <div className="nt-password-panel">
      <div className="nt-edit-profile-grid">
        <label>Old password<input type="password" value={draft.oldPassword} onChange={event => onChange('oldPassword', event.target.value)} /></label>
        <label>New password<input type="password" value={draft.newPassword} onChange={event => onChange('newPassword', event.target.value)} /></label>
        <label>Confirm new password<input type="password" value={draft.confirmPassword} onChange={event => onChange('confirmPassword', event.target.value)} /></label>
      </div>
      {status && <p className="nt-edit-profile-status">{status}</p>}
      <button className="nt-btn primary" onClick={onSave}>Change Password</button>
    </div>
  );
}

function goalLabel(goal) {
  return ({ lose: 'Weight Loss', maintain: 'Maintenance', gain: 'Muscle Gain' })[goal] || 'Weight Loss';
}

function activityLabel(activity) {
  return ({ sedentary: 'Sedentary', light: 'Lightly Active', moderate: 'Moderately Active', active: 'Active', very_active: 'Very Active' })[activity] || 'Moderately Active';
}
