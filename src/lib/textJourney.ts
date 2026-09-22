export const TEXT_JOURNEY_REQUEST_EVENT = "sidtw:request-text-journey";

/** Keep the same route and journey while choosing the non-3D experience. */
export function textJourneyUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("accessible", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function requestTextJourney() {
  window.dispatchEvent(new Event(TEXT_JOURNEY_REQUEST_EVENT));
}
