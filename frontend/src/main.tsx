import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
// @ts-ignore Vite handles CSS imports at runtime.
import "./style.css";
import Voice from "./Voice";
import Conversations from "./Conversations";
import MeetingAssistant from "./MeetingAssistant";
import { init3DModel } from "./3dModel";

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
    return init3DModel();
  }, []);

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
              "Live meeting",
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
                Hello{profile.display_name ? `, ${profile.display_name}` : ""}.
              </h1>
              <p>Build the knowledge and boundaries behind your voice.</p>
              <div className="dashboard-grid">
                <article className="dashboard-card">
                  <small>SHADOW PROFILE</small>
                  <h2>
                    {profile.display_name ? "Taking shape" : "Start with you"}
                  </h2>
                  <p>Define how your representative communicates.</p>
                  <button
                    className="text-link"
                    onClick={() => setPage("Shadow profile")}
                  >
                    Edit profile <span aria-hidden="true">↗</span>
                  </button>
                </article>
                <article className="dashboard-card">
                  <small>CONFIRMED MEMORIES</small>
                  <h2>{memories.length} memories</h2>
                  <p>Facts and preferences you explicitly provide.</p>
                  <button
                    className="text-link"
                    onClick={() => setPage("Memories")}
                  >
                    Manage knowledge <span aria-hidden="true">↗</span>
                  </button>
                </article>
                <article className="dashboard-card dashboard-card-wide">
                  <small>YOUR NEXT STEP</small>
                  <h2>Build your voice and try a text conversation</h2>
                  <p>
                    Voice enrolment requires your consent. Conversations are
                    simulations, and every proposed response requires your
                    approval.
                  </p>
                  <div className="card-actions">
                    <button
                      className="button button-outline"
                      onClick={() => setPage("Voice identity")}
                    >
                      Voice identity
                    </button>
                    <button
                      className="button button-primary"
                      onClick={() => setPage("Conversations")}
                    >
                      Conversations
                    </button>
                  </div>
                </article>
              </div>
            </>
          ) : page === "Conversations" ? (
            <Conversations />
          ) : page === "Live meeting" ? (
            <MeetingAssistant />
          ) : page === "Voice identity" ? (
            <Voice />
          ) : page === "Connections" ? (
            <>
              <p className="eyebrow">SERVICE CONFIGURATION</p>
              <h1>Your connections.</h1>
              <article className="dashboard-card">
                <h2>Voice synthesis</h2>
                <p>
                  Configure the backend voice provider, then enrol and test
                  your voice in Voice identity.
                </p>
              </article>
              <article className="dashboard-card">
                <h2>Calls and meetings</h2>
                <p>
                  No telephony or meeting platform is connected. Conversation
                  sessions are simulations.
                </p>
              </article>
            </>
          ) : page === "Shadow profile" ? (
            <>
              <p className="eyebrow">A PERSONAL BLUEPRINT</p>
              <h1>Make it yours.</h1>
              <p>Only share information you want your Shadow to know.</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
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
                      onChange={(event) =>
                        setProfile({ ...profile, [key]: event.target.value })
                      }
                    />
                  </label>
                ))}
                <button className="button button-primary" disabled={busy}>
                  {busy ? "Saving…" : "Save profile"}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="eyebrow">A PRIVATE, EDITABLE ARCHIVE</p>
              <h1>Your knowledge.</h1>
              <p>
                Keep confirmed facts and preferences. Add or remove them
                whenever you choose.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const formElement = event.currentTarget;
                  const form = new FormData(formElement);
                  run(async () => {
                    await api("/memories", "POST", Object.fromEntries(form));
                    setMemories(await api("/memories"));
                    formElement.reset();
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
                    {[
                      "personal_fact",
                      "preference",
                      "knowledge",
                      "decision",
                    ].map((category) => (
                      <option key={category} value={category}>
                        {category.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button button-primary" disabled={busy}>
                  {busy ? "Saving…" : "Save memory"}
                </button>
              </form>
              {memories.map((memory) => (
                <article className="dashboard-card memory-card" key={memory.id}>
                  <small>{memory.category.replaceAll("_", " ")} · CONFIRMED</small>
                  <p>{memory.content}</p>
                  <button
                    className="text-link danger-link"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api(`/memories/${memory.id}`, "DELETE");
                        setMemories(await api("/memories"));
                      })
                    }
                  >
                    Delete memory
                  </button>
                </article>
              ))}
            </>
          )}
        </main>
      </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
