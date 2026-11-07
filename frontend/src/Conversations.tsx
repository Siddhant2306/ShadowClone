import { useEffect, useState } from "react";
export default function Conversations() {
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
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Conversation workspace.</h1>
      <p>
        Text simulation · Every response needs your approval · No real phone or
        meeting connection
      </p>
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
                act(() =>
                  request("/" + r.id + "/resolve", "POST", {
                    approve: true,
                    text,
                  }),
                );
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
              <button disabled={busy}>Approve response</button>{" "}
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
