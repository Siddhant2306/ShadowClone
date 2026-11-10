export default function ConnectionsPage() {
  return (
    <section className="connections-page">
      <header className="workspace-page-intro">
        <p className="eyebrow">SERVICE CONFIGURATION</p>
        <h1>Your connections.</h1>
        <p>
          A clear view of what is connected—and what remains under your control.
        </p>
      </header>
      <div className="connections-list">
        <article className="connection-item">
          <span className="connection-index">01</span>
          <div className="connection-copy">
            <small>VOICE PROVIDER</small>
            <h2>Speech synthesis</h2>
            <p>
              Voice generation uses the provider configured by your backend.
              Enroll, test, or revoke your local voice identity from its
              dedicated controls.
            </p>
          </div>
          <span className="connection-state">MANAGED IN SETTINGS</span>
        </article>
        <article className="connection-item">
          <span className="connection-index">02</span>
          <div className="connection-copy">
            <small>MEETING PLATFORMS</small>
            <h2>No platform connection</h2>
            <p>
              Shadow Clone does not connect to or join phone calls or meeting
              platforms. Live meeting assistance requires you to share a tab
              yourself and disclose the assistant to participants.
            </p>
          </div>
          <span className="connection-state is-neutral">NOT CONNECTED</span>
        </article>
      </div>
      <p className="connections-footnote">
        Provider credentials and service configuration are controlled by the
        application operator.
      </p>
    </section>
  );
}
