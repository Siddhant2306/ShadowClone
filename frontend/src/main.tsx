import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import Voice from "./Voice";
import Conversations from "./Conversations";
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api" + path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok)
    throw Error(
      typeof d.detail === "string" ? d.detail : "Please check your input",
    );
  return d;
}
const empty = {
  display_name: "",
  communication_style: "",
  preferred_languages: "",
  knowledge: "",
  restricted_topics: "",
};
function App() {
  const [user, setUser] = useState<any>(null),
    [page, setPage] = useState("Overview"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [register, setRegister] = useState(true),
    [profile, setProfile] = useState(empty),
    [memories, setMemories] = useState<any[]>([]);
  useEffect(() => {
    api("/me")
      .then(setUser)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (user) {
      api("/profile")
        .then((p) => p && setProfile(p))
        .catch((e) => setError(e.message));
      api("/memories")
        .then(setMemories)
        .catch((e) => setError(e.message));
    }
  }, [user]);
  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shell">
      <aside>
        <h2>◈ Shadow Clone</h2>
        <small>YOUR VOICE. YOUR BOUNDARIES.</small>
        {user && (
          <nav>
            {[
              "Overview",
              "Shadow profile",
              "Memories",
              "Voice identity",
              "Conversations",
              "Connections",
            ].map((x) => (
              <button
                className={page === x ? "selected" : ""}
                onClick={() => setPage(x)}
                key={x}
              >
                {x}
              </button>
            ))}
          </nav>
        )}
        <footer>
          Personal representation,
          <br />
          with you in control.
        </footer>
      </aside>
      <main>
        <header>
          <span>PERSONAL VOICE WORKSPACE</span>
          {user && (
            <button
              onClick={() =>
                run(async () => {
                  await api("/logout", "POST");
                  setUser(null);
                })
              }
            >
              Sign out
            </button>
          )}
        </header>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!user ? (
          <section className="hero">
            <div className="orb">◈</div>
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
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(async () =>
                  setUser(
                    await api(
                      "/auth/" + (register ? "register" : "login"),
                      "POST",
                      Object.fromEntries(f),
                    ),
                  ),
                );
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
                onClick={() => setRegister(!register)}
              >
                {register
                  ? "Already have an account? Sign in"
                  : "Create an account"}
              </button>
            </form>
          </section>
        ) : page === "Overview" ? (
          <>
            <p className="eyebrow">YOUR SHADOW, AT A GLANCE</p>
            <h1>
              Hello{profile.display_name ? ", " + profile.display_name : ""}.
            </h1>
            <p>Build the knowledge and boundaries behind your voice.</p>
            <div className="cards">
              <article>
                <small>SHADOW PROFILE</small>
                <h2>
                  {profile.display_name ? "Taking shape" : "Start with you"}
                </h2>
                <p>Define how your representative communicates.</p>
                <button onClick={() => setPage("Shadow profile")}>
                  Edit profile →
                </button>
              </article>
              <article>
                <small>CONFIRMED MEMORIES</small>
                <h2>{memories.length} memories</h2>
                <p>Facts and preferences you explicitly provide.</p>
                <button onClick={() => setPage("Memories")}>
                  Manage knowledge →
                </button>
              </article>
            </div>
            <article>
              <h2>Build your voice and try a text conversation</h2>
              <p>
                Enrol your voice in Voice identity. The Conversations workspace
                supports text simulations with owner approval. Live microphone
                conversations are not yet available.
              </p>
            </article>
          </>
        ) : page === "Conversations" ? (
          <Conversations />
        ) : page === "Voice identity" ? (
          <Voice />
        ) : page === "Shadow profile" ? (
          <>
            <h1>Make it yours.</h1>
            <p>Only share information you want your Shadow to know.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api("/profile", "PUT", profile);
                  setPage("Overview");
                });
              }}
            >
              {Object.entries(profile).map(([key, value]) => (
                <label key={key}>
                  {key.replaceAll("_", " ")}
                  <textarea
                    required={key === "display_name"}
                    value={value}
                    onChange={(e) =>
                      setProfile({ ...profile, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <button disabled={busy}>Save profile</button>
            </form>
          </>
        ) : page === "Memories" ? (
          <>
            <h1>A little more context.</h1>
            <p>
              Your confirmed knowledge, always editable through deletion and
              replacement.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(async () => {
                  await api("/memories", "POST", Object.fromEntries(f));
                  setMemories(await api("/memories"));
                });
              }}
            >
              <label>
                Memory
                <textarea name="content" required maxLength={4000} />
              </label>
              <label>
                Category
                <select name="category">
                  {["personal_fact", "preference", "knowledge", "decision"].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </label>
              <button disabled={busy}>Save memory</button>
            </form>
            {memories.map((m) => (
              <article key={m.id}>
                <small>{m.category} · confirmed by you</small>
                <p>{m.content}</p>
                <button
                  onClick={() =>
                    run(async () => {
                      await api("/memories/" + m.id, "DELETE");
                      setMemories(await api("/memories"));
                    })
                  }
                >
                  Delete
                </button>
              </article>
            ))}
          </>
        ) : (
          <>
            <h1>Connections.</h1>
            <article>
              <h2>Gnani voice · Configuration required</h2>
              <p>
                Configure the backend API key, then enrol and test your voice in
                Voice identity.
              </p>
            </article>
            <article>
              <h2>Calls & meetings · Not connected</h2>
              <p>No telephony or meeting platform is connected.</p>
            </article>
          </>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
