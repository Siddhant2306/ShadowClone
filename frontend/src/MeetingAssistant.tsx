import { useEffect, useRef, useState } from "react";

type CaptureSession = {
  id?: string;
  stream?: MediaStream;
  context?: AudioContext;
  source?: MediaStreamAudioSourceNode;
  processor?: ScriptProcessorNode;
  socket?: WebSocket;
};

type DeviceOption = {
  deviceId: string;
  label: string;
};

type RoutableAudioElement = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

function wavFromFloat(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const outputRate = 16000;
  const ratio = sampleRate / outputRate;
  const sampleCount = Math.floor(samples.length / ratio);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outputRate, true);
  view.setUint32(28, outputRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * 2, true);

  for (let i = 0; i < sampleCount; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
    let total = 0;
    for (let j = start; j < Math.min(end, samples.length); j += 1) {
      total += samples[j];
    }
    const average = total / Math.max(1, Math.min(end, samples.length) - start);
    const value = Math.max(-1, Math.min(1, average));
    view.setInt16(44 + i * 2, value < 0 ? value * 32768 : value * 32767, true);
  }
  return buffer;
}

async function responseError(response: Response, fallback: string) {
  let detail = fallback;
  try {
    const body = await response.json();
    if (typeof body.detail === "string") detail = body.detail;
  } catch {
    // Keep the caller's fallback when the response is not JSON.
  }
  return new Error(detail);
}

export default function MeetingAssistant() {
  const [consented, setConsented] = useState(false);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [outputDevice, setOutputDevice] = useState("");
  const [status, setStatus] = useState("Waiting for participant consent.");
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [meetingContext, setMeetingContext] = useState("");
  const [savedMeetingContext, setSavedMeetingContext] = useState("");
  const [introUrl, setIntroUrl] = useState("");
  const [introPending, setIntroPending] = useState(false);
  const [active, setActive] = useState(false);
  const [showAudioControls, setShowAudioControls] = useState(false);
  const [starting, setStarting] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ role: "participant" | "assistant"; text: string }>
  >([]);
  const session = useRef<CaptureSession>({});
  const conversationIdRef = useRef("");
  const introPlayer = useRef<HTMLAudioElement>(null);
  const replyPlayer = useRef<HTMLAudioElement>(null);
  const replyQueue = useRef<string[]>([]);
  const playingReply = useRef("");
  const pendingAudio = useRef<ArrayBuffer[]>([]);
  const turnInProgress = useRef(false);
  const expectingAudio = useRef(false);
  const stopRequested = useRef(false);
  const outputDeviceRef = useRef("");

  useEffect(() => {
    outputDeviceRef.current = outputDevice;
  }, [outputDevice]);

  async function refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setError("Audio output selection is not supported in this browser.");
      return;
    }
    const found = await navigator.mediaDevices.enumerateDevices();
    setDevices(
      found
        .filter((device) => device.kind === "audiooutput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Audio output ${index + 1}`,
        })),
    );
  }

  useEffect(() => {
    refreshDevices().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "Could not list audio outputs."),
    );
    return () => {
      const current = session.current;
      if (current.socket?.readyState === WebSocket.OPEN) {
        current.socket.send(JSON.stringify({ type: "stop" }));
      }
      current.socket?.close();
      current.stream?.getTracks().forEach((track) => track.stop());
      current.processor?.disconnect();
      current.source?.disconnect();
      if (current.context && current.context.state !== "closed") {
        void current.context.close();
      }
      introPlayer.current?.pause();
      replyPlayer.current?.pause();
      const introSource = introPlayer.current?.src;
      if (introSource?.startsWith("blob:")) URL.revokeObjectURL(introSource);
      if (playingReply.current) URL.revokeObjectURL(playingReply.current);
      for (const url of replyQueue.current) URL.revokeObjectURL(url);
      const id = current.id || conversationIdRef.current;
      if (id) {
        void fetch(`/api/conversations/${id}/end`, { method: "POST" });
      }
    };
  }, []);

  function releaseCapture() {
    const current = session.current;
    current.socket?.close();
    current.stream?.getTracks().forEach((track) => track.stop());
    current.processor?.disconnect();
    current.source?.disconnect();
    if (current.context && current.context.state !== "closed") {
      void current.context.close();
    }
    session.current = {};
  }

  async function cancelConversation() {
    const id = session.current.id || conversationIdRef.current;
    stopRequested.current = true;
    introPlayer.current?.pause();
    replyPlayer.current?.pause();
    if (introUrl) URL.revokeObjectURL(introUrl);
    if (playingReply.current) URL.revokeObjectURL(playingReply.current);
    for (const url of replyQueue.current) URL.revokeObjectURL(url);
    setIntroUrl("");
    setShowAudioControls(false);
    replyQueue.current = [];
    playingReply.current = "";
    const socket = session.current.socket;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "stop" }));
    }
    releaseCapture();
    let ended = !id;
    if (id) {
      try {
        const response = await fetch(`/api/conversations/${id}/end`, {
          method: "POST",
        });
        if (!response.ok) {
          throw await responseError(response, "Could not end the meeting session.");
        }
        ended = true;
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Could not end the meeting session.",
        );
      }
    }
    setActive(false);
    setIntroPending(false);
    if (ended) {
      conversationIdRef.current = "";
      setConversationId("");
      setStatus("Meeting assistant stopped.");
    } else {
      setStatus("Audio stopped locally, but the meeting session could not be ended.");
    }
    pendingAudio.current = [];
    turnInProgress.current = false;
  }

  async function startLiveCapture() {
    const current = session.current;
    if (!current.id || !current.stream || stopRequested.current) return;
    const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(
      `${scheme}//${window.location.host}/api/conversations/${current.id}/live`,
    );
    socket.binaryType = "arraybuffer";
    current.socket = socket;

    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener(
        "error",
        () => reject(new Error("Could not connect to the live meeting service.")),
        { once: true },
      );
      socket.addEventListener(
        "close",
        () => reject(new Error("The live meeting connection closed before starting.")),
        { once: true },
      );
    });
    if (stopRequested.current) {
      socket.send(JSON.stringify({ type: "stop" }));
      socket.close();
      return;
    }

    const context = new AudioContext();
    await context.resume();
    const source = context.createMediaStreamSource(current.stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const preRoll: Float32Array[] = [];
    let utterance: Float32Array[] = [];
    let started = false;
    let quietFrames = 0;
    let sampleCount = 0;

    const sendUtterance = () => {
      const totalSamples = utterance.reduce((total, frame) => total + frame.length, 0);
      if (totalSamples >= context.sampleRate * 0.5 && socket.readyState === WebSocket.OPEN) {
        const samples = new Float32Array(totalSamples);
        let offset = 0;
        for (const frame of utterance) {
          samples.set(frame, offset);
          offset += frame.length;
        }
        if (pendingAudio.current.length < 3) {
          pendingAudio.current.push(wavFromFloat(samples, context.sampleRate));
          sendNextUtterance();
        } else {
          setStatus("Assistant is busy. Pause briefly before speaking again.");
        }
      }
      utterance = [];
      started = false;
      quietFrames = 0;
      sampleCount = 0;
    };

    processor.onaudioprocess = (event) => {
      const output = event.outputBuffer.getChannelData(0);
      output.fill(0);
      if (stopRequested.current) return;
      const input = event.inputBuffer.getChannelData(0);
      const frame = input.slice();
      let energy = 0;
      for (const value of frame) energy += value * value;
      const voiceDetected = Math.sqrt(energy / frame.length) > 0.012;

      if (started) {
        utterance.push(frame);
        sampleCount += frame.length;
        quietFrames = voiceDetected ? 0 : quietFrames + 1;
        if (quietFrames >= 9 || sampleCount >= context.sampleRate * 14) {
          sendUtterance();
        }
      } else if (voiceDetected) {
        utterance = [...preRoll, frame];
        sampleCount = utterance.reduce((total, item) => total + item.length, 0);
        started = true;
        quietFrames = 0;
      } else {
        preRoll.push(frame);
        if (preRoll.length > 3) preRoll.shift();
      }
    };

    current.context = context;
    current.source = source;
    current.processor = processor;
    source.connect(processor);
    processor.connect(context.destination);
    socket.addEventListener("message", handleSocketMessage);
    socket.addEventListener("close", () => {
      if (!stopRequested.current) {
        releaseCapture();
        setActive(false);
        setStatus("The live connection closed.");
      }
    });
    setActive(true);
    setStatus("Listening to the shared meeting tab. AI assistant is active.");
  }

  function sendNextUtterance() {
    const socket = session.current.socket;
    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      turnInProgress.current ||
      pendingAudio.current.length === 0
    ) {
      return;
    }
    turnInProgress.current = true;
    socket.send(pendingAudio.current.shift()!);
  }

  function handleSocketMessage(event: MessageEvent) {
    if (typeof event.data !== "string") {
      if (expectingAudio.current && event.data instanceof ArrayBuffer) {
        expectingAudio.current = false;
        replyQueue.current.push(URL.createObjectURL(new Blob([event.data], { type: "audio/wav" })));
        void playNextReply();
      }
      return;
    }
    let message: {
      type?: string;
      status?: string;
      text?: string;
      transcript?: string;
      message?: string;
    };
    try {
      message = JSON.parse(event.data);
    } catch {
      setError("The live service returned an invalid response.");
      return;
    }
    if (message.type === "status" && message.status) {
      setStatus(
        message.status === "transcribing"
          ? "Transcribing the participant's speech…"
          : message.status === "thinking"
            ? "Preparing a concise answer…"
            : "Generating the disclosed AI voice reply…",
      );
    } else if (message.type === "transcript" && message.text) {
      setMessages((items) => [...items, { role: "participant", text: message.text! }]);
    } else if (message.type === "reply" && message.text) {
      setMessages((items) => [...items, { role: "assistant", text: message.text! }]);
    } else if (message.type === "audio") {
      expectingAudio.current = true;
    } else if (message.type === "error" && message.message) {
      setError(message.message);
    } else if (message.type === "turn_complete" || message.type === "ignored") {
      if (message.type === "turn_complete") {
        turnInProgress.current = false;
        setStatus("Listening to the shared meeting tab.");
        sendNextUtterance();
      }
    }
  }

  async function playNextReply() {
    const player = replyPlayer.current as RoutableAudioElement | null;
    if (!player || playingReply.current || replyQueue.current.length === 0) return;
    playingReply.current = replyQueue.current.shift()!;
    player.src = playingReply.current;
    try {
      if (!outputDeviceRef.current) {
        throw new Error("Select the virtual audio cable output before starting.");
      }
      if (!player.setSinkId) {
        throw new Error("This browser cannot route audio to the selected virtual device.");
      }
      await player.setSinkId(outputDeviceRef.current);
      setShowAudioControls(true);
      await player.play();
      setStatus("Speaking the AI-disclosed reply through the selected output.");
    } catch (reason) {
      if (reason instanceof Error) setError(reason.message);
      setStatus("Audio needs attention. Use the player controls or stop the session.");
      setShowAudioControls(true);
    }
  }

  function onReplyEnded() {
    if (playingReply.current) URL.revokeObjectURL(playingReply.current);
    playingReply.current = "";
    if (replyPlayer.current) replyPlayer.current.src = "";
    void playNextReply();
  }

  async function startMeeting() {
    setError("");
    setMessages([]);
    stopRequested.current = false;
    if (!consented) {
      setError("Confirm that every meeting participant was informed and consented.");
      return;
    }
    if (!outputDevice) {
      setError("Select the virtual audio cable output used by your meeting microphone.");
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Tab audio sharing requires a supported browser such as Chrome.");
      return;
    }

    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
      });
      session.current.stream = stream;
      stream.getTracks().forEach((track) => {
        track.addEventListener(
          "ended",
          () => {
            if (!stopRequested.current) void cancelConversation();
          },
          { once: true },
        );
      });
      if (!stream.getAudioTracks().length) {
        throw new Error("No tab audio was shared. Select the meeting tab and enable Share tab audio.");
      }
      if (stream.getVideoTracks()[0]?.getSettings().displaySurface !== "browser") {
        throw new Error("Share the Google Meet browser tab, not a window or your full screen.");
      }
      const created = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "google_meet_live",
          participants_consented: true,
          meeting_context: meetingContext,
        }),
      });
      if (!created.ok) throw await responseError(created, "Could not create the meeting session.");
      const {
        id,
        introduction,
      } = (await created.json()) as { id: string; introduction: string };
      session.current.id = id;
      conversationIdRef.current = id;
      setConversationId(id);
      setSavedMeetingContext(meetingContext.trim());
      setMessages([
        {
          role: "assistant",
          text: introduction,
        },
      ]);

      const speech = await fetch(`/api/conversations/${id}/speech`, { method: "POST" });
      if (!speech.ok) throw await responseError(speech, "Could not generate the AI disclosure.");
      const url = URL.createObjectURL(await speech.blob());
      setIntroUrl(url);
      setIntroPending(true);
      setStatus("Play the AI disclosure into the meeting before the assistant starts listening.");
      await refreshDevices();
    } catch (reason) {
      if (reason instanceof Error) setError(reason.message);
      const id = session.current.id;
      releaseCapture();
      if (id) {
        await fetch(`/api/conversations/${id}/end`, { method: "POST" }).catch(() => {});
      }
      conversationIdRef.current = "";
      setConversationId("");
      setIntroPending(false);
      setStatus("Meeting assistant is stopped.");
    } finally {
      setStarting(false);
    }
  }

  async function saveMeetingContext() {
    const socket = session.current.socket;
    if (active && socket?.readyState !== WebSocket.OPEN) {
      setError("The live connection is not ready to refresh meeting context.");
      return;
    }
    try {
      const response = await fetch(`/api/conversations/${conversationId}/context`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: meetingContext }),
      });
      if (!response.ok) {
        throw await responseError(response, "Could not save meeting context.");
      }
      setSavedMeetingContext(meetingContext.trim());
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "refresh_context" }));
      }
      setStatus(
        socket?.readyState === WebSocket.OPEN
          ? "Meeting context saved and refreshed."
          : "Meeting context saved for this session.",
      );
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save meeting context.");
    }
  }

  async function playDisclosure() {
    const player = introPlayer.current as RoutableAudioElement | null;
    if (!player || !outputDevice) return;
    try {
      if (!player.setSinkId) {
        throw new Error("This browser cannot route audio to the selected virtual device.");
      }
      await player.setSinkId(outputDevice);
      await player.play();
      setStatus("Playing the AI disclosure. Listening starts after it finishes.");
    } catch (reason) {
      if (reason instanceof Error) setError(reason.message);
    }
  }

  return (
    <section className="meeting-assistant">
      <p className="eyebrow">GOOGLE MEET · DISCLOSED AI ASSISTANT</p>
      <h1>Live meeting assistant.</h1>
      <p>
        Share the meeting tab and route replies through a virtual audio cable.
        This app does not join a meeting or change Meet settings for you.
      </p>

      <article className="meeting-notice">
        <strong>Disclosure and consent are required.</strong>
        <p>
          Before capture starts, every participant must know an AI assistant
          may listen and respond in the enrolled voice. The assistant speaks an
          AI disclosure once at the beginning. Stop sharing
          or use the stop button at any time. Shared speech is sent to the
          configured transcription provider; recognized text and replies are
          saved in this account's conversation history. Reasoning and voice
          synthesis use the providers configured by the account owner.
        </p>
      </article>

      <label>
        Meeting context (optional)
        <textarea
          value={meetingContext}
          maxLength={8000}
          placeholder="Share the purpose, previous discussion, expected topics, your position, and anything to avoid."
          onChange={(event) => setMeetingContext(event.target.value)}
        />
      </label>
      <p className="meeting-setup">
        This note is saved with the meeting and loaded once when the live
        connection starts. It is passed directly as context; no separate
        extraction model request is made.
      </p>
      {conversationId && meetingContext.trim() !== savedMeetingContext && (
        <button
          type="button"
          className="button button-outline"
          onClick={() => void saveMeetingContext()}
        >
          Save and refresh context
        </button>
      )}

      <label className="meeting-consent">
        <input
          type="checkbox"
          checked={consented}
          disabled={active || introPending}
          onChange={(event) => setConsented(event.target.checked)}
        />
        I have informed all meeting participants, and they have consented to
        this disclosed AI assistant listening and responding.
      </label>

      <label>
        Browser audio output
        <select
          value={outputDevice}
          disabled={active || introPending}
          onChange={(event) => setOutputDevice(event.target.value)}
        >
          <option value="">Choose the virtual cable playback device</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="button button-outline"
        disabled={active || introPending}
        onClick={() =>
          refreshDevices().catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : "Could not list audio outputs."),
          )
        }
      >
        Refresh audio outputs
      </button>
      <p className="meeting-setup">
        With a virtual cable such as VB-CABLE, choose <b>CABLE Input</b> here
        and <b>CABLE Output</b> as the microphone in Google Meet. The browser
        must be allowed to select that output.
      </p>

      {!active && !introPending && !conversationId && (
        <button
          type="button"
          className="button button-primary"
          disabled={starting}
          onClick={() => void startMeeting()}
        >
          {starting ? "Preparing meeting…" : "Share meeting tab &amp; start"}
        </button>
      )}
      {introPending && (
        <div className="meeting-disclosure">
          <p>
            The assistant will not listen until this disclosure has played
            through the selected output.
          </p>
          <audio
            ref={introPlayer}
            controls
            src={introUrl}
            onEnded={() => {
              setIntroPending(false);
              if (introUrl) URL.revokeObjectURL(introUrl);
              setIntroUrl("");
              void startLiveCapture().catch((reason: unknown) => {
                setError(
                  reason instanceof Error ? reason.message : "Could not start live audio capture.",
                );
                void cancelConversation();
              });
            }}
          />
          <button type="button" className="button button-outline" onClick={() => void playDisclosure()}>
            Play disclosure
          </button>
          <button type="button" className="button button-danger" onClick={() => void cancelConversation()}>
            Cancel
          </button>
        </div>
      )}
      {conversationId && !introPending && (
        <button
          type="button"
          className="button button-danger"
          onClick={() => void cancelConversation()}
        >
          Stop assistant and end session
        </button>
      )}

      <p className="meeting-status" role="status" aria-live="polite">
        {status}
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {conversationId && (
        <p className="meeting-session-id">
          Session <code>{conversationId}</code>
        </p>
      )}
      <audio
        ref={replyPlayer}
        controls={showAudioControls}
        hidden={!showAudioControls}
        onPlay={() => setStatus("Speaking the AI-disclosed reply.")}
        onEnded={onReplyEnded}
        onError={() => setError("The generated reply audio could not be played by the selected output device.")}
      />
      <div className="meeting-transcript" aria-live="polite">
        {messages.map((message, index) => (
          <article key={`${index}-${message.role}`}>
            <small>{message.role === "assistant" ? "DISCLOSED AI REPLY" : "PARTICIPANT"}</small>
            <p>{message.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
