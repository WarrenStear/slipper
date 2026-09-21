import { type FormEvent, useState } from "react";
import { clearJourneySessionToken, requestMagicLink } from "../../lib/cloudJourneyClient";
import { useJourneyStore } from "../../stores/useJourneyStore";

function cloudStatusLabel(status: ReturnType<typeof useJourneyStore.getState>["cloudStatus"]) {
  if (status === "loading") return "Restoring";
  if (status === "saving") return "Saving";
  if (status === "synced") return "Synced";
  if (status === "error") return "Cloud issue";
  if (status === "signed-out") return "Local only";
  return "Local";
}

function maskSubject(subject: string | null) {
  if (!subject) return "Not connected";
  const [name, domain] = subject.split("@");
  if (!name || !domain) return subject;
  return `${name.slice(0, 2)}•••@${domain}`;
}

export function MagicLinkSignIn() {
  const [email, setEmail] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const cloudStatus = useJourneyStore((state) => state.cloudStatus);
  const cloudMessage = useJourneyStore((state) => state.cloudMessage);
  const cloudSubject = useJourneyStore((state) => state.cloudSubject);
  const cloudSavedAt = useJourneyStore((state) => state.cloudSavedAt);
  const setCloudState = useJourneyStore((state) => state.setCloudState);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSending(true);
    setMessage(null);

    try {
      const payload = await requestMagicLink(email);
      setMessage(payload.devMagicLink ? `Dev magic link: ${payload.devMagicLink}` : "Check your email for the restore link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not request a magic link.");
    } finally {
      setIsSending(false);
    }
  };

  const disconnect = () => {
    clearJourneySessionToken();
    setCloudState({ cloudStatus: "signed-out", cloudSubject: null, cloudMessage: "Cloud save disconnected on this device." });
    setMessage("This device is now local-only. Your cloud save remains in KV.");
  };

  return (
    <section className={`cloud-journey-card cloud-journey-card-${cloudStatus}`} aria-label="Cloud journey persistence">
      <button type="button" className="cloud-journey-summary" onClick={() => setIsOpen((value) => !value)} aria-expanded={isOpen}>
        <span>{cloudStatusLabel(cloudStatus)}</span>
        <strong>{maskSubject(cloudSubject)}</strong>
      </button>

      {isOpen ? (
        <div className="cloud-journey-panel">
          <p>{cloudMessage ?? "Use a magic link to restore and save this journey across devices."}</p>
          {cloudSavedAt ? <small>Last cloud save: {new Date(cloudSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small> : null}

          {!cloudSubject ? (
            <form onSubmit={submit}>
              <label>
                Restore with email
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
              </label>
              <button type="submit" disabled={isSending}>{isSending ? "Sending…" : "Send magic link"}</button>
            </form>
          ) : (
            <button type="button" className="cloud-journey-disconnect" onClick={disconnect}>Disconnect this device</button>
          )}

          {message ? <p className="cloud-journey-message">{message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
