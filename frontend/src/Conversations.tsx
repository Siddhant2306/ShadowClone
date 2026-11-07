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
    <>
      <h1>Conversation workspace.</h1>
      <p>
        Browser voice conversation · Every response needs your approval · No
        real phone or meeting connection
      </p>
      <p role="status">{stage}</p>
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
      <button
        disabled={busy}
        onClick={() =>
          act(() => request("", "POST", { channel: "simulated_call" }))
        }
      >
        Simulate call
      </button>{" "}
      <button
        disabled={busy}
        onClick={() =>
          act(() => request("", "POST", { channel: "simulated_meeting" }))
        }
      >
        Simulate meeting
      </button>
      {rows.map((r) => (
        <article key={r.id} style={{ marginTop: 24 }}>
          <small>
            {r.channel} · {r.status}
          </small>
          {r.transcript.map((m: any, i: number) => (
            <p key={i}>
              <strong>{m.role}: </strong>
              {m.content}
            </p>
          ))}
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
              <button disabled={busy || recordingBusy}>Approve & speak</button>{" "}
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
    </>
  );
}
