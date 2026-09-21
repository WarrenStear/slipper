type WebkitAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let gestureActivatedContext: AudioContext | null = null;

export const NARRATIVE_AUDIO_ACTIVATION_EVENT =
  "sidtw:narrative-audio-activation";

function announceAudioActivation(context: AudioContext) {
  window.dispatchEvent(
    new CustomEvent(NARRATIVE_AUDIO_ACTIVATION_EVENT, {
      detail: {
        state: context.state,
        userActivationActive: navigator.userActivation?.isActive ?? false,
      },
    }),
  );
}

function audioContextConstructor() {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext ?? null;
}

/**
 * Create and resume the shared narrative context synchronously inside the
 * visitor's Begin gesture. The 3D audio director adopts this exact context
 * when it mounts, so first playback does not depend on a later React effect
 * retaining transient browser activation.
 */
export function activateNarrativeAudioFromGesture(enabled: boolean) {
  if (!enabled) return null;
  const AudioContextConstructor = audioContextConstructor();
  if (!AudioContextConstructor) return null;

  try {
    gestureActivatedContext ??= new AudioContextConstructor();
    if (gestureActivatedContext.state !== "running") {
      void gestureActivatedContext.resume()
        .then(() => announceAudioActivation(gestureActivatedContext as AudioContext))
        .catch(() => announceAudioActivation(gestureActivatedContext as AudioContext));
    }
    announceAudioActivation(gestureActivatedContext);
    return gestureActivatedContext;
  } catch {
    return null;
  }
}

export function getGestureActivatedNarrativeAudioContext() {
  return gestureActivatedContext;
}
