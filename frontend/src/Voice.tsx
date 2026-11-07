import { useEffect, useState } from "react";
export default function Voice() {
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
        Upload 5–30 seconds of clean, mono 16-bit PCM WAV audio (maximum 3 MB).
        Reference audio is processed temporarily; only the returned voice
        embedding is saved.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          call("/enrol", "POST", new FormData(e.currentTarget));
        }}
      >
        <label>
          Your reference recording
          <input type="file" name="file" accept=".wav" required />
        </label>
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
        <button disabled={busy}>{busy ? "Processing…" : "Enrol voice"}</button>
      </form>
      <button disabled={busy} onClick={() => call("/test", "POST")}>
        Test cloned voice
      </button>{" "}
      <button disabled={busy} onClick={() => call("", "DELETE")}>
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
