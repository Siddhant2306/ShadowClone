import { useEffect, useState } from "react";
import VoiceRecorder from "./VoiceRecorder";
export default function Voice() {
  const [recording, setRecording] = useState<File | null>(null);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [mode, setMode] = useState("record");
  const [status, setStatus] = useState("Loading"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState("");
  async function refresh() {
    const r = await fetch("/api/voice");
    if (r.ok) {
      const d = await r.json();
      setStatus(d.status + (d.configured ? "" : " · backend API key required"));
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function call(path: string, method: string, body?: FormData) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/voice" + path, { method, body });
      if (!r.ok) {
        const d = await r.json();
        throw Error(
          typeof d.detail === "string"
            ? d.detail
            : "Check your audio and consent",
        );
      }
      if (path === "/test") setUrl(URL.createObjectURL(await r.blob()));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Your voice identity.</h1>
      <p>Status: {status}</p>
      <p>
        Record your voice below or upload 5–30 seconds of mono 16-bit PCM WAV
        audio (maximum 5 MB). Reference audio is processed temporarily; only the
        returned voice embedding is saved.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (recordingBusy) return;
          const body = new FormData(e.currentTarget);
          if (mode === "record") {
            if (!recording) {
              setError("Record your voice before enrolling.");
              return;
            }
            body.set("file", recording);
          }
          call("/enrol", "POST", body);
        }}
      >
        <label>
          Audio source
          <select
            value={mode}
            disabled={busy || recordingBusy}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="record">Record with microphone</option>
            <option value="upload">Upload a WAV file</option>
          </select>
        </label>
        {mode === "record" ? (
          <VoiceRecorder
            onRecorded={setRecording}
            onBusy={setRecordingBusy}
            disabled={busy}
          />
        ) : (
          <label>
            Your reference recording
            <input
              type="file"
              name="file"
              accept=".wav"
              required
              disabled={busy}
            />
          </label>
        )}
        <label>
          <input
            style={{ width: "auto" }}
            type="checkbox"
            name="consent"
            value="true"
            required
          />{" "}
          This is my voice. I consent to creating and using its AI
          representation.
        </label>
        <button
          disabled={busy || recordingBusy || (mode === "record" && !recording)}
        >
          {busy ? "Processing…" : "Enrol voice"}
        </button>
      </form>
      <button
        disabled={busy || recordingBusy}
        onClick={() => call("/test", "POST")}
      >
        Test cloned voice
      </button>{" "}
      <button
        disabled={busy || recordingBusy}
        onClick={() => call("", "DELETE")}
      >
        Revoke & delete local voice
      </button>
      {url && (
        <p>
          <audio controls src={url} />
        </p>
      )}
      <p>
        Revocation deletes the saved embedding and prevents further synthesis in
        this app. Provider-side retention is governed by Gnani.
      </p>
    </>
  );
}
