/** Encode decoded microphone audio as mono 16-bit PCM WAV. */
export async function toWav(blob: Blob, minimum = 5): Promise<File> {
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    if (audio.duration < minimum)
      throw new Error(`Record at least ${minimum} seconds before continuing.`);
    const frames = Math.min(audio.length, Math.floor(audio.sampleRate * 30));
    const output = new OfflineAudioContext(
      1,
      Math.ceil((frames / audio.sampleRate) * 24000),
      24000,
    );
    const source = output.createBufferSource();
    source.buffer = audio;
    source.connect(output.destination);
    source.start();
    const mono = (await output.startRendering()).getChannelData(0);
    let energy = 0;
    for (const sample of mono) energy += sample * sample;
    if (Math.sqrt(energy / mono.length) < 0.002)
      throw new Error(
        "The recording is too quiet. Check your microphone and try again.",
      );
    const bytes = new ArrayBuffer(44 + mono.length * 2);
    const view = new DataView(bytes);
    const label = (offset: number, value: string) =>
      [...value].forEach((char, i) =>
        view.setUint8(offset + i, char.charCodeAt(0)),
      );
    label(0, "RIFF");
    view.setUint32(4, bytes.byteLength - 8, true);
    label(8, "WAVE");
    label(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 24000, true);
    view.setUint32(28, 48000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    label(36, "data");
    view.setUint32(40, mono.length * 2, true);
    mono.forEach((sample, i) => {
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(44 + i * 2, value * (value < 0 ? 32768 : 32767), true);
    });
    return new File([bytes], "my-voice.wav", { type: "audio/wav" });
  } finally {
    await context.close();
  }
}
