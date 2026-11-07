import { useEffect, useRef, useState } from "react";
import { toWav } from "./utils/audio";

export default function VoiceRecorder({
  onRecorded,
  onBusy,
  disabled,
  minimum = 5,
}: {
  onRecorded: (file: File | null) => void;
  onBusy: (busy: boolean) => void;
  disabled: boolean;
  minimum?: number;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const mounted = useRef(true);
  const [phase, setPhase] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  useEffect(
    () => () => {
      mounted.current = false;
      clearInterval(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function stop() {
    clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }
  async function start() {
    setError("");
    setPhase("requesting");
    onBusy(true);
    onRecorded(null);
    setPreview("");
    setSeconds(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Recording requires a supported browser on localhost or HTTPS.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true },
        video: false,
      });
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const capture = new MediaRecorder(media);
      recorder.current = capture;
      const chunks: Blob[] = [];
      capture.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      capture.onstop = async () => {
        clearInterval(timer.current);
        media.getTracks().forEach((track) => track.stop());
        if (!mounted.current) return;
        setPhase("processing");
        try {
          const file = await toWav(
            new Blob(chunks, { type: capture.mimeType }),
            minimum,
          );
          if (!mounted.current) return;
          setPreview(URL.createObjectURL(file));
          onRecorded(file);
          setPhase("ready");
        } catch (e) {
          if (mounted.current) {
            setError((e as Error).message);
            setPhase("idle");
          }
        } finally {
          if (mounted.current) onBusy(false);
        }
      };
      capture.onerror = () => {
        setError("Microphone recording failed. Please try again.");
        stop();
      };
      capture.start();
      setPhase("recording");
      const started = Date.now();
      timer.current = setInterval(() => {
        const elapsed = (Date.now() - started) / 1000;
        setSeconds(Math.min(30, Math.floor(elapsed)));
        if (elapsed >= 30) stop();
      }, 200);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (mounted.current) {
        setError(
          (e as Error).name === "NotAllowedError"
            ? "Microphone permission was denied. Allow microphone access in your browser and try again."
            : (e as Error).message,
        );
        setPhase("idle");
        onBusy(false);
      }
    }
  }
  const active = ["recording", "requesting", "processing"].includes(phase);
  return (
    <section className="voice-recorder" aria-label="Record your voice">
      <h2>Record your voice here</h2>
      <p>
        Speak naturally for 5–30 seconds in a quiet place. Recording stops
        automatically at 30 seconds.
      </p>
      <p className="recording-status" role="status">
        {phase === "recording"
          ? "🔴 Recording"
          : phase === "processing"
            ? "Preparing your recording…"
            : phase === "requesting"
              ? "Waiting for microphone permission…"
              : phase === "ready"
                ? "Recording ready"
                : "Microphone ready"}{" "}
        · {seconds}s / 30s
      </p>
      {phase === "recording" ? (
        <button type="button" onClick={stop}>
          Stop recording
        </button>
      ) : (
        <button type="button" disabled={disabled || active} onClick={start}>
          {preview ? "Re-record" : "Start recording"}
        </button>
      )}
      {preview && (
        <p>
          <audio controls src={preview} aria-label="Preview your recording" />
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
