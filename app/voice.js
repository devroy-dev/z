// voice.js — one recorder for the whole app (chat composer, room composer, journal).
//
// The single home of the recording format. On Android, RecordingPresets.HIGH_QUALITY
// produces .m4a (audio/mp4, AAC) — which the engine's transcribeAudio maps to 'mp4'
// and Sarvam accepts. If a device ever disagrees, this hook is the ONLY place to change
// the preset/MIME; nothing else in the app knows the format.
//
// Usage:
//   const rec = useVoiceNote();
//   rec.toggle()      → start if idle, stop+return {uri, mime} if recording
//   rec.recording     → boolean, for the pulsing mic UI
//   rec.busy          → true while preparing/stopping (block double-taps)

import { useState, useRef, useCallback } from 'react';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';

export function useVoiceNote() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const start = useCallback(async () => {
    if (busyRef.current || recording) return false;
    busyRef.current = true; setBusy(true);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { busyRef.current = false; setBusy(false); return false; }
      // route audio for recording (Android needs this to actually capture from the mic)
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      return true;
    } catch (e) {
      return false;
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }, [recorder, recording]);

  // stop → returns { uri, mime } or null. mime is m4a/mp4 on device, webm on web.
  const stop = useCallback(async () => {
    if (busyRef.current || !recording) return null;
    busyRef.current = true; setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      setRecording(false);
      if (!uri) return null;
      const mime = /\.webm$/i.test(uri) ? 'audio/webm' : /\.wav$/i.test(uri) ? 'audio/wav' : 'audio/mp4';
      return { uri, mime };
    } catch (e) {
      setRecording(false);
      return null;
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }, [recorder, recording]);

  const toggle = useCallback(async () => {
    if (recording) return await stop();
    await start();
    return null;
  }, [recording, start, stop]);

  return { recording, busy, start, stop, toggle };
}
