type LoginPageProps = {
  register: boolean;
  busy: boolean;
  onToggleMode: () => void;
  onSubmit: (fields: Record<string, FormDataEntryValue>) => void;
};

export default function LoginPage({
  register,
  busy,
  onToggleMode,
  onSubmit,
}: LoginPageProps) {
  return (
    <section className="hero">
      <p className="eyebrow">MEET YOUR OTHER VOICE</p>
      <h1>
        Be represented.
        <br />
        <em>Stay in control.</em>
      </h1>
      <p>
        An AI voice representative shaped by your knowledge,
        <br />
        communication style and explicit permissions.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(Object.fromEntries(new FormData(event.currentTarget)));
        }}
      >
        <h2>{register ? "Create your account" : "Welcome back"}</h2>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={12}
            required
            placeholder="At least 12 characters"
          />
        </label>
        <button disabled={busy}>
          {busy
            ? "Please wait…"
            : register
              ? "Create account →"
              : "Sign in →"}
        </button>
        <button
          type="button"
          className="quiet"
          onClick={onToggleMode}
        >
          {register
            ? "Already have an account? Sign in"
            : "Create an account"}
        </button>
      </form>
    </section>
  );
}
