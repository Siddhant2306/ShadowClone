import { useEffect, useRef, useState } from "react";
import VoiceRecorder from "./VoiceRecorder";
export default function Conversations() {
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [speechUrl, setSpeechUrl] = useState("");
  const [stage, setStage] = useState("");
  const player = useRef<HTMLAudioElement>(null);
  useEffect(
    () => () => {
      if (speechUrl) URL.revokeObjectURL(speechUrl);
    },
    [speechUrl],
  );
  async function speak(id: string) {
    setStage("Generating cloned speech…");
    const response = await fetch(`/api/conversations/${id}/speech`, {
      method: "POST",
    });
    if (!response.ok) {
      const data = await response.json();
      throw Error(data.detail || "Speech generation failed");
    }
    setSpeechUrl(URL.createObjectURL(await response.blob()));
    setStage("Reply ready. Press play if your browser blocks autoplay.");
  }
  async function sendAudio(id: string, file: File) {
    player.current?.pause();
    setSpeechUrl("");
    setStage("Transcribing and thinking…");
    const body = new FormData();
    body.set("file", file);
    const response = await fetch(`/api/conversations/${id}/audio-turn`, {
      method: "POST",
      body,
    });
    if (!response.ok) {
      const data = await response.json();
      throw Error(data.detail || "Voice request failed");
    }
    setStage(
      "Review your proposed reply, then approve it to hear your cloned voice.",
    );
  }
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function request(path: string, method = "GET", body?: any) {
    const r = await fetch("/api/conversations" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json();
    if (!r.ok)
      throw Error(typeof d.detail === "string" ? d.detail : "Request failed");
    return d;
  }
  async function refresh() {
    setRows(await request(""));
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  async function act(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      setStage("");
    } finally {
      await refresh().catch(() => {});
      setBusy(false);
    }
  }
  return (
    <section className="conversations-page">
      <header className="workspace-page-intro">
        <p className="eyebrow">PRIVATE, APPROVAL-LED SIMULATIONS</p>
        <h1>Conversation workspace.</h1>
        <p>
          Explore how your Shadow responds in a controlled simulation. Every
          proposed reply is yours to review; no real call or meeting is
          connected.
        </p>
      </header>
      <div className="conversations-toolbar">
        <div>
          <small>START A SIMULATION</small>
          <span>Choose a scenario to begin.</span>
        </div>
        <div className="conversation-create-actions">
          <button
            className="button button-outline"
            disabled={busy}
            onClick={() =>
              act(() => request("", "POST", { channel: "simulated_call" }))
            }
          >
            Simulate call <span aria-hidden="true">↗</span>
          </button>
          <button
            className="button button-outline"
            disabled={busy}
            onClick={() =>
              act(() => request("", "POST", { channel: "simulated_meeting" }))
            }
          >
            Simulate meeting <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
      {stage && (
        <p className="conversation-stage" role="status" aria-live="polite">
          <i aria-hidden="true" />
          {stage}
        </p>
      )}
      {speechUrl && (
        <audio
          ref={player}
          controls
          autoPlay
          src={speechUrl}
          onPlay={() => setStage("Speaking…")}
          onEnded={() => setStage("Ready for your next question.")}
        />
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="conversation-session-list">
        {rows.map((r) => (
          <article className="conversation-session" key={r.id}>
            <header className="conversation-session-heading">
              <div>
                <small>
                  SIMULATED {r.channel.replaceAll("_", " ").toUpperCase()}
                </small>
                <span>{r.status.replaceAll("_", " ")}</span>
              </div>
              <span className="conversation-session-id">
                SESSION / {String(r.id).slice(0, 8)}
              </span>
            </header>
            <div className="conversation-transcript">
              {r.transcript.map((m: any, i: number) => (
                <p className={`transcript-line transcript-${m.role}`} key={i}>
                  <strong>
                    {m.role === "assistant" ? "YOUR SHADOW" : "PARTICIPANT"}
                  </strong>
                  <span>{m.content}</span>
                </p>
              ))}
            </div>
            {r.status === "listening" && (
              <VoiceRecorder
                minimum={0.5}
                disabled={busy || recordingBusy}
                onBusy={(value) => {
                  setRecordingBusy(value);
                  if (value) player.current?.pause();
                }}
                onRecorded={(file) => {
                  if (file) act(() => sendAudio(r.id, file));
                }}
              />
            )}
            {r.status === "listening" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = new FormData(e.currentTarget).get("text");
                  act(() => request("/" + r.id + "/turn", "POST", { text }));
                }}
              >
                <label>
                  Participant message
                  <input name="text" required maxLength={4000} />
                </label>
                <button disabled={busy}>Generate proposed response</button>
              </form>
            )}
            {r.status === "waiting_for_approval" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = new FormData(e.currentTarget).get("text");
                  act(async () => {
                    await request("/" + r.id + "/resolve", "POST", {
                      approve: true,
                      text,
                    });
                    await speak(r.id);
                  });
                }}
              >
                <label>
                  Review and edit
                  <textarea
                    name="text"
                    required
                    defaultValue={r.transcript.at(-1).content}
                  />
                </label>
                <button disabled={busy || recordingBusy}>
                  Approve & speak
                </button>{" "}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act(() =>
                      request("/" + r.id + "/resolve", "POST", {
                        approve: false,
                        text: "",
                      }),
                    )
                  }
                >
                  Reject
                </button>
              </form>
            )}
            {r.status === "listening" &&
              r.transcript.at(-1)?.role === "assistant" && (
                <button
                  disabled={busy || recordingBusy}
                  onClick={() => act(() => speak(r.id))}
                >
                  Speak latest reply
                </button>
              )}
            {r.status !== "completed" && (
              <button
                disabled={busy}
                onClick={() => act(() => request("/" + r.id + "/end", "POST"))}
              >
                End conversation
              </button>
            )}{" "}
            <button
              disabled={busy}
              onClick={() => act(() => request("/" + r.id, "DELETE"))}
            >
              Delete transcript
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
