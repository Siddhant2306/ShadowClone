type OverviewPageProps = {
  displayName: string;
  memoryCount: number;
  onNavigate: (page: string) => void;
};

export default function OverviewPage({
  displayName,
  memoryCount,
  onNavigate,
}: OverviewPageProps) {
  return (
    <>
      <p className="eyebrow">YOUR SHADOW, AT A GLANCE</p>
      <h1>Hello{displayName ? `, ${displayName}` : ""}.</h1>
      <p>Build the knowledge and boundaries behind your voice.</p>
      <div className="dashboard-grid">
        <article className="dashboard-card">
          <small>SHADOW PROFILE</small>
          <h2>{displayName ? "Taking shape" : "Start with you"}</h2>
          <p>Define how your representative communicates.</p>
          <button
            className="text-link"
            onClick={() => onNavigate("Shadow profile")}
          >
            Edit profile <span aria-hidden="true">↗</span>
          </button>
        </article>
        <article className="dashboard-card">
          <small>CONFIRMED MEMORIES</small>
          <h2>{memoryCount} memories</h2>
          <p>Facts and preferences you explicitly provide.</p>
          <button
            className="text-link"
            onClick={() => onNavigate("Memories")}
          >
            Manage knowledge <span aria-hidden="true">↗</span>
          </button>
        </article>
        <article className="dashboard-card dashboard-card-wide">
          <small>YOUR NEXT STEP</small>
          <h2>Build your voice and try a text conversation</h2>
          <p>
            Voice enrolment requires your consent. Conversations are
            simulations, and every proposed response requires your approval.
          </p>
          <div className="card-actions">
            <button
              className="button button-outline"
              onClick={() => onNavigate("Voice identity")}
            >
              Voice identity
            </button>
            <button
              className="button button-primary"
              onClick={() => onNavigate("Conversations")}
            >
              Conversations
            </button>
          </div>
        </article>
      </div>
    </>
  );
}
