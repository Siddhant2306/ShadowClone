import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
// @ts-ignore Vite handles CSS imports at runtime.
import "./style.css";
import Voice from "./Voice";
import Conversations from "./Conversations";
import MeetingAssistant from "./MeetingAssistant";
//import { init3DModel } from "./3dModel";
import ConnectionsPage from "./components/ConnectionsPage";
import LoginPage from "./components/LoginPage";
import MemoriesPage from "./components/MemoriesPage";
import OverviewPage from "./components/OverviewPage";
import ShadowProfilePage from "./components/ShadowProfilePage";
import Sidebar from "./components/Sidebar";
import WorkspaceHeader from "./components/WorkspaceHeader";

async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch("/api" + path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    throw Error(
      typeof data.detail === "string" ? data.detail : "Please check your input",
    );
  }
  return data;
}

const emptyProfile = {
  display_name: "",
  communication_style: "",
  preferred_languages: "",
  knowledge: "",
  restricted_topics: "",
};

function App() {
  const [user, setUser] = useState<any>(null);
  const [page, setPage] = useState("Overview");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [register, setRegister] = useState(true);
  const [profile, setProfile] = useState(emptyProfile);
  const [memories, setMemories] = useState<any[]>([]);

  //useEffect(() => init3DModel(), []);

  useEffect(() => {
    api("/me")
      .then(setUser)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      api("/profile")
        .then((value) => value && setProfile(value))
        .catch((reason) => setError(reason.message));
      api("/memories")
        .then(setMemories)
        .catch((reason) => setError(reason.message));
    }
  }, [user]);

  async function run(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function renderPage() {
    if (page === "Overview") {
      return (
        <OverviewPage
          displayName={profile.display_name}
          memoryCount={memories.length}
          onNavigate={setPage}
        />
      );
    }
    if (page === "Conversations") return <Conversations />;
    if (page === "Live meeting") return <MeetingAssistant />;
    if (page === "Voice identity") return <Voice />;
    if (page === "Connections") return <ConnectionsPage />;
    if (page === "Shadow profile") {
      return (
        <ShadowProfilePage
          profile={profile}
          busy={busy}
          onChange={(key, value) =>
            setProfile((current) => ({ ...current, [key]: value }))
          }
          onSave={() =>
            run(async () => {
              await api("/profile", "PUT", profile);
              setPage("Overview");
            })
          }
        />
      );
    }
    return (
      <MemoriesPage
        memories={memories}
        busy={busy}
        onCreate={(fields, form) =>
          run(async () => {
            await api("/memories", "POST", fields);
            setMemories(await api("/memories"));
            form.reset();
          })
        }
        onDelete={(id) =>
          run(async () => {
            await api(`/memories/${id}`, "DELETE");
            setMemories(await api("/memories"));
          })
        }
      />
    );
  }

  return (
    <div className="shell">
      <Sidebar hasUser={Boolean(user)} page={page} onNavigate={setPage} />
      <main>
        <WorkspaceHeader
          hasUser={Boolean(user)}
          onSignOut={() =>
            run(async () => {
              await api("/logout", "POST");
              setUser(null);
            })
          }
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!user ? (
          <LoginPage
            register={register}
            busy={busy}
            onToggleMode={() => setRegister(!register)}
            onSubmit={(fields) =>
              run(async () =>
                setUser(
                  await api(
                    "/auth/" + (register ? "register" : "login"),
                    "POST",
                    fields,
                  ),
                ),
              )
            }
          />
        ) : (
          renderPage()
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
