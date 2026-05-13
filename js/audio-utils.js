/* ============================================
   Audio conversion utilities — WebM → MP3
   ============================================ */

async function convertBlobToMp3(webmBlob) {
  if (typeof lamejs === 'undefined') {
    return webmBlob;
  }

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const samples = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128);
    const mp3buf = encoder.encodeBuffer(samples);
    const mp3end = encoder.flush();

    const combined = new Uint8Array(mp3buf.length + mp3end.length);
    combined.set(mp3buf, 0);
    combined.set(mp3end, mp3buf.length);

    return new Blob([combined], { type: 'audio/mpeg' });
  } finally {
    audioCtx.close();
  }
}
