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
    <div className="workspace-overview">
      <header className="overview-hero">
        <div className="overview-hero-copy">
          <p className="eyebrow">YOUR SHADOW, AT A GLANCE</p>
          <h1>
            Good to have
            <br />
            you back{displayName ? `, ${displayName}` : ""}.
          </h1>
          <p className="overview-lead">
            Shape a considered digital presence, one detail at a time.
          </p>
        </div>
        <div className="overview-signal" aria-hidden="true">
          <span className="overview-signal-label">
            VOICE / CONTEXT / CONSENT
          </span>
          <div className="overview-signal-orbit overview-signal-orbit-outer" />
          <div className="overview-signal-orbit overview-signal-orbit-inner" />
          <svg viewBox="0 0 180 72">
            <path
              d="M3 36h25l9-15 13 32 15-49 17 61 14-42 12 25 12-17 13 5 10-10 14 10h10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="overview-signal-index">SC—01</span>
        </div>
      </header>

      <section className="overview-section" aria-label="The foundation">
        <div className="overview-section-heading">
          <p className="eyebrow">THE FOUNDATION</p>
          <span>01 — 02</span>
        </div>
        <div className="overview-foundation-grid">
          <article className="overview-foundation-item">
            <span className="overview-item-number">01</span>
            <div className="overview-item-content">
              <small>SHADOW PROFILE</small>
              <h2>
                {displayName ? "A presence taking shape." : "Start with you."}
              </h2>
              <p>
                {displayName
                  ? "Your profile has a name. Add your communication style and boundaries when you are ready."
                  : "Set a name, communication style, and boundaries for the way your Shadow represents you."}
              </p>
              <button
                className="workspace-text-link"
                onClick={() => onNavigate("Shadow profile")}
              >
                {displayName ? "Refine your profile" : "Build your profile"}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
            <span
              className={`overview-completion${displayName ? " is-started" : ""}`}
              aria-hidden="true"
            >
              <i aria-hidden="true" />
            </span>
          </article>
          <article className="overview-foundation-item">
            <span className="overview-item-number">02</span>
            <div className="overview-item-content">
              <small>CONFIRMED MEMORIES</small>
              <h2>
                {memoryCount} {memoryCount === 1 ? "memory" : "memories"}.
              </h2>
              <p>
                A private, editable archive of the facts and preferences you
                choose to share.
              </p>
              <button
                className="workspace-text-link"
                onClick={() => onNavigate("Memories")}
              >
                Manage your context <span aria-hidden="true">↗</span>
              </button>
            </div>
            <span className="overview-count" aria-hidden="true">
              {String(memoryCount).padStart(2, "0")}
            </span>
          </article>
        </div>
      </section>

      <section
        className="overview-section overview-next"
        aria-labelledby="overview-next-title"
      >
        <div className="overview-section-heading">
          <p className="eyebrow">A THOUGHTFUL PLACE TO BEGIN</p>
          <span>YOUR NEXT STEPS</span>
        </div>
        <div className="overview-next-heading">
          <h2 id="overview-next-title">Build the voice behind the presence.</h2>
          <p>
            Move at your own pace. Your voice settings and profile stay under
            your control.
          </p>
        </div>
        <div className="overview-step-list">
          <button
            className="overview-step"
            onClick={() => onNavigate("Voice identity")}
          >
            <span className="overview-step-index">01</span>
            <span className="overview-step-copy">
              <strong>Shape your voice</strong>
              <span>Enroll and manage your voice identity.</span>
            </span>
            <span className="overview-step-arrow" aria-hidden="true">
              ↗
            </span>
          </button>
          <button
            className="overview-step"
            onClick={() => onNavigate("Conversations")}
          >
            <span className="overview-step-index">02</span>
            <span className="overview-step-copy">
              <strong>Explore a conversation</strong>
              <span>Try an approval-led simulation in your workspace.</span>
            </span>
            <span className="overview-step-arrow" aria-hidden="true">
              ↗
            </span>
          </button>
          <button
            className="overview-step"
            onClick={() => onNavigate("Connections")}
          >
            <span className="overview-step-index">03</span>
            <span className="overview-step-copy">
              <strong>Review your connections</strong>
              <span>See which providers and platforms are available.</span>
            </span>
            <span className="overview-step-arrow" aria-hidden="true">
              ↗
            </span>
          </button>
        </div>
      </section>
      <footer className="overview-footer">
        <span>SHADOW CLONE / PERSONAL VOICE WORKSPACE</span>
        <span>Presence, with permission.</span>
      </footer>
    </div>
  );
}
