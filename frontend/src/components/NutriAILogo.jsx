import NutriTrackLogo from './NutriTrackLogo';

export default function NutriAILogo({ className = '', full = false }) {
  if (full) {
    return (
      <div className={`nutriai-logo-full ${className}`}>
        <div className="nutriai-logo-mark">
          <NutriTrackLogo className="h-full w-full" />
          <span className="nutriai-logo-orb" />
          <span className="nutriai-logo-spark" />
        </div>
        <strong>NutriTrack</strong>
        <span>AI</span>
      </div>
    );
  }

  return (
    <div className={`nutriai-logo-mark ${className}`}>
      <NutriTrackLogo className="h-full w-full" />
      <span className="nutriai-logo-orb" />
      <span className="nutriai-logo-spark" />
    </div>
  );
}
