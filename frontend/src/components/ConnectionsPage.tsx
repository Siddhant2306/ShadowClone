export default function ConnectionsPage() {
  return (
    <>
      <p className="eyebrow">SERVICE CONFIGURATION</p>
      <h1>Your connections.</h1>
      <article className="dashboard-card">
        <h2>Voice synthesis</h2>
        <p>
          Configure the backend voice provider, then enrol and test your voice
          in Voice identity.
        </p>
      </article>
      <article className="dashboard-card">
        <h2>Calls and meetings</h2>
        <p>
          No telephony or meeting platform is connected. Conversation sessions
          are simulations.
        </p>
      </article>
    </>
  );
}
