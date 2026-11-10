type ShadowProfilePageProps = {
  profile: Record<string, string>;
  busy: boolean;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
};

export default function ShadowProfilePage({
  profile,
  busy,
  onChange,
  onSave,
}: ShadowProfilePageProps) {
  return (
    <>
      <p className="eyebrow">A PERSONAL BLUEPRINT</p>
      <h1>Make it yours.</h1>
      <p>Only share information you want your Shadow to know.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        {Object.entries(profile).map(([key, value]) => (
          <label key={key}>
            {key.replaceAll("_", " ")}
            <textarea
              required={key === "display_name"}
              value={value}
              onChange={(event) => onChange(key, event.target.value)}
            />
          </label>
        ))}
        <button className="button button-primary" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>
    </>
  );
}
