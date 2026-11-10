import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

type LoginPageProps = {
  register: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onToggleMode: () => void;
  onSubmit: (fields: Record<string, FormDataEntryValue>) => void;
};

export default function LoginPage({
  register,
  busy,
  error,
  onClose,
  onToggleMode,
  onSubmit,
}: LoginPageProps) {
  const emailInput = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    emailInput.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function containFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="auth-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="auth-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onKeyDown={containFocus}
      >
        <button
          className="auth-close"
          type="button"
          onClick={onClose}
          aria-label="Close sign in"
        >
          ×
        </button>
        <p className="section-kicker">YOUR VOICE, YOUR TERMS</p>
        <h2 id="auth-title">
          {register ? "Make room for your Shadow." : "Welcome back."}
        </h2>
        <p className="auth-intro">
          {register
            ? "Start by creating a private account. Your voice is yours to shape and control."
            : "Sign in to continue to your voice workspace."}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(Object.fromEntries(new FormData(event.currentTarget)));
          }}
        >
          <label htmlFor="auth-email">Email address</label>
          <input
            ref={emailInput}
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={12}
            required
            placeholder="At least 12 characters"
          />
          <button
            className="button button-light button-large auth-submit"
            disabled={busy}
          >
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
            {!busy && <span aria-hidden="true">↗</span>}
          </button>
          <button type="button" className="auth-switch" onClick={onToggleMode}>
            {register
              ? "Already have an account? Sign in"
              : "New to Shadow Clone? Create an account"}
          </button>
        </form>
        <p className="auth-footnote">
          Continuing means you’re choosing to create a voice representation on
          your own terms.
        </p>
      </section>
    </div>
  );
}
