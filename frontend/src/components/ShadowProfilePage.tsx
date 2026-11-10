type ShadowProfilePageProps = {
  profile: Record<string, string>;
  busy: boolean;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
};

const fieldLabels: Record<string, string> = {
  display_name: "What should your Shadow call you?",
  communication_style: "How do you like to communicate?",
  preferred_languages: "Which languages do you use?",
  knowledge: "What should your Shadow know?",
  restricted_topics: "What should your Shadow avoid?",
};

export default function ShadowProfilePage({
  profile,
  busy,
  onChange,
  onSave,
}: ShadowProfilePageProps) {
  return (
    <section className="shadow-profile-page">
      <header className="workspace-page-intro">
        <p className="eyebrow">A PERSONAL BLUEPRINT</p>
        <h1>Make it yours.</h1>
        <p>
          Give your Shadow the context to represent you thoughtfully. Only share
          what you want it to know.
        </p>
      </header>
      <form
        className="profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        {Object.entries(profile).map(([key, value]) => (
          <label key={key}>
            <span className="profile-field-label">
              {fieldLabels[key] ?? key}
            </span>
            <small className="profile-field-key">
              {key.replaceAll("_", " ").toUpperCase()}
            </small>
            <textarea
              aria-label={fieldLabels[key] ?? key}
              required={key === "display_name"}
              rows={key === "display_name" ? 1 : 3}
              value={value}
              onChange={(event) => onChange(key, event.target.value)}
            />
          </label>
        ))}
        <button className="button button-primary" disabled={busy}>
          {busy ? "Saving…" : "Save profile"} <span aria-hidden="true">↗</span>
        </button>
      </form>
    </section>
  );
}
