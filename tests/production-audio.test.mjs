import test from "node:test";
import assert from "node:assert/strict";
import { NARRATIVE_AUDIO_STEM_IDS } from "../src/components/three/audio/narrativeAudioProfiles.ts";
import { PRODUCTION_AUDIO_REGISTRY, reviewedProductionAudio, MAX_PRODUCTION_AUDIO_BYTES } from "../src/components/three/audio/productionAudioRegistry.ts";
import { createProductionAudioLoader, prepareProductionAudioLoop, PRODUCTION_AUDIO_NETWORK_TIMEOUT_MS } from "../src/components/three/audio/productionAudioLoader.ts";
import { createNarrativeStemVoice, replaceNarrativeStemBuffer, pauseNarrativeAudioNodes, disposeNarrativeAudioNodes, observeNarrativeAudioContext, createNarrativePlaybackGate, PRODUCTION_STEM_CROSSFADE_SECONDS } from "../src/components/three/audio/narrativeAudioRuntime.ts";

// Metadata describes test-only responses; no recording or URL is enabled in production.
const reviewed = overrides => ({ status: "reviewed-production", url: "/audio/test-room.mp3", format: "mp3",
  loop: {}, nominalLevelDb: -6, provenance: "Test response, not production content", reviewedBy: "Test fixture", reviewedAt: "2026-09-25", ...overrides });
const registry = changes => ({ ...PRODUCTION_AUDIO_REGISTRY, ...changes });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const response = () => new Response(new Uint8Array([1, 2, 3]));
function buffer(channels = 1, length = 8000, sampleRate = 8000) {
  const data = Array.from({ length: channels }, (_, channel) => Float32Array.from({ length }, (_, i) => (channel + 1) * (.2 + i / length * .1)));
  return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: channel => data[channel] };
}
function decodeContext(decode = async () => buffer()) {
  return { allocations: 0, decodes: 0,
    decodeAudioData(bytes) { this.decodes++; return decode(bytes); },
    createBuffer(channels, length, rate) { this.allocations++; return buffer(channels, length, rate); },
  };
}

test("all ten shipping stems remain procedural; unreviewed/invalid metadata cannot fetch", async () => {
  assert.deepEqual(Object.keys(PRODUCTION_AUDIO_REGISTRY), [...NARRATIVE_AUDIO_STEM_IDS]);
  assert.ok(Object.values(PRODUCTION_AUDIO_REGISTRY).every(asset => asset.status === "procedural-fallback" && asset.url === null));
  for (const invalid of [
    { ...reviewed(), status: "procedural-fallback" }, reviewed({ url: "https://example.com/wind.mp3" }),
    reviewed({ url: "/audio/../wind.mp3" }), reviewed({ url: "/audio/test.wav" }), reviewed({ format: "ogg" }),
    reviewed({ nominalLevelDb: NaN }), reviewed({ nominalLevelDb: 1 }), reviewed({ provenance: "" }),
    reviewed({ reviewedAt: "not a date" }), reviewed({ loop: null }), reviewed({ loop: { startSeconds: -1 } }),
    reviewed({ loop: { edgeFadeSeconds: 0 } }), reviewed({ loop: [] }),
    reviewed({ alternatives: {} }), reviewed({ alternatives: null }), reviewed({ alternatives: "mp3" }),
    reviewed({ alternatives: [null] }), reviewed({ alternatives: new Array(2) }), reviewed({ alternatives: [reviewed(), reviewed(), reviewed()] }),
    reviewed({ reviewedAt: "2026-02-30" }), reviewed({ reviewedAt: "09/25/2026" }), reviewed({ reviewedAt: "0" }),
    reviewed({ reviewedAt: "2026-09-25T24:00:00.000Z" }), reviewed({ alternatives: [{ url: "/audio/raw.wav", format: "wav" }] }),
  ]) assert.equal(reviewedProductionAudio(invalid), null);
  const context = decodeContext();
  const loader = createProductionAudioLoader({ context, active: () => true, ready: () => assert.fail("unreviewed delivery"), fetchFile: () => assert.fail("unreviewed request") });
  for (const id of NARRATIVE_AUDIO_STEM_IDS) loader.request(id);
  await tick();
  assert.equal(context.decodes, 0);
  loader.dispose();
});

test("reviewed loading is gesture/audibility gated, requested on demand, and coalesced", async () => {
  let active = false, fetches = 0;
  const pending = deferred();
  const context = decodeContext(() => pending.promise), delivered = [];
  const loader = createProductionAudioLoader({ context, active: () => active, registry: registry({ room: reviewed(), wind: reviewed({ url: "/audio/test-wind.ogg", format: "ogg" }) }),
    fetchFile: async () => { fetches++; return response(); }, ready: (id, data) => delivered.push([id, data]) });
  loader.request("room"); await tick(); assert.equal(fetches, 0);
  active = true;
  loader.request("room"); loader.request("room"); await tick();
  assert.equal(fetches, 1); assert.equal(context.decodes, 1); assert.equal(delivered.length, 0);
  pending.resolve(buffer()); await tick();
  loader.request("room"); await tick();
  assert.equal(fetches, 1); assert.equal(delivered.length, 1); assert.equal(delivered[0][0], "room");
  loader.dispose();
  const remount = createProductionAudioLoader({ context, active: () => true, registry: registry({ room: reviewed() }),
    fetchFile: () => assert.fail("same-context reviewed buffer must be reused"), ready: (_id, data) => assert.equal(data, delivered[0][1]) });
  remount.request("room"); remount.dispose();
});

test("failed HTTP/decode requests preserve fallback and do not retry on every frame", async () => {
  for (const kind of ["http", "decode", "empty", "oversize"]) {
    let requests = 0;
    const context = decodeContext(async () => { throw new Error("unsupported codec"); });
    const loader = createProductionAudioLoader({ context, active: () => true, registry: registry({ room: reviewed() }), ready: () => assert.fail("failed file replaced fallback"),
      fetchFile: async () => { requests++; return kind === "http" ? new Response("missing", { status: 404 }) : kind === "empty" ? new Response(null) :
        kind === "oversize" ? new Response(new Uint8Array(MAX_PRODUCTION_AUDIO_BYTES + 1)) : response(); } });
    loader.request("room"); await tick(); await tick();
    for (let i = 0; i < 60; i++) loader.request("room");
    await tick(); assert.equal(requests, 1, kind);
    assert.equal(context.allocations, 0, kind);
    loader.dispose();
  }
});

test("an explicitly reviewed codec alternative can succeed after the first decode fails", async () => {
  const requests = [], delivered = [];
  let decode = 0;
  const context = decodeContext(async () => { if (decode++ === 0) throw new Error("unsupported Ogg"); return buffer(); });
  const loader = createProductionAudioLoader({ context, active: () => true,
    registry: registry({ room: reviewed({ url: "/audio/test-room.ogg", format: "ogg", alternatives: [{ url: "/audio/test-room.mp3", format: "mp3" }] }) }),
    fetchFile: async (url, init) => { assert.equal(init.redirect, "error"); assert.equal(init.credentials, "same-origin"); requests.push(url); return response(); }, ready: id => delivered.push(id) });
  loader.request("room"); await tick(); await tick();
  assert.deepEqual(requests, ["/audio/test-room.ogg", "/audio/test-room.mp3"]);
  assert.deepEqual(delivered, ["room"]); loader.dispose();
});

test("stalled fetches time out and release the shared slots for a later needed stem", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const context = decodeContext(), requested = [], aborted = [], delivered = [];
  const loader = createProductionAudioLoader({ context, active: () => true,
    registry: registry({ room: reviewed(), wind: reviewed({ url: "/audio/test-wind.mp3" }), water: reviewed({ url: "/audio/test-water.mp3" }) }),
    fetchFile: (url, { signal }) => {
      requested.push(url);
      if (url.includes("water")) return Promise.resolve(response());
      return new Promise((_resolve, reject) => signal.addEventListener("abort", () => {
        aborted.push(url); reject(signal.reason);
      }, { once: true }));
    }, ready: id => delivered.push(id) });
  t.after(() => loader.dispose());
  loader.request("room"); loader.request("wind"); loader.request("water");
  await tick();
  assert.equal(requested.length, 2); assert.equal(context.decodes, 0);
  t.mock.timers.tick(PRODUCTION_AUDIO_NETWORK_TIMEOUT_MS - 1);
  await tick(); assert.equal(aborted.length, 0);
  t.mock.timers.tick(1); await tick(); await tick();
  assert.equal(aborted.length, 2);
  assert.equal(requested.length, 3); assert.equal(context.decodes, 1);
  assert.deepEqual(delivered, ["water"]);
  loader.request("room"); loader.request("wind");
  assert.equal(requested.length, 3, "timed-out files must not retry on every frame");
});

test("a stalled response body shares its fetch deadline and can fall back to a reviewed codec", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const context = decodeContext(), requested = [], delivered = [];
  const headers = deferred();
  let cancelled = 0;
  const loader = createProductionAudioLoader({ context, active: () => true,
    registry: registry({ room: reviewed({ url: "/audio/test-room.ogg", format: "ogg", alternatives: [{ url: "/audio/test-room.mp3", format: "mp3" }] }) }),
    fetchFile: async url => { requested.push(url); return url.endsWith(".ogg") ? headers.promise : response(); },
    ready: id => delivered.push(id) });
  t.after(() => loader.dispose());
  loader.request("room");
  t.mock.timers.tick(PRODUCTION_AUDIO_NETWORK_TIMEOUT_MS - 1000);
  headers.resolve(new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); },
    cancel() { cancelled++; },
  })));
  await tick();
  assert.equal(context.decodes, 0); assert.equal(cancelled, 0);
  t.mock.timers.tick(999); await tick(); assert.equal(cancelled, 0);
  t.mock.timers.tick(1); await tick(); await tick();
  assert.equal(cancelled, 1, "the partial body must be cancelled at the original attempt deadline");
  assert.deepEqual(requested, ["/audio/test-room.ogg", "/audio/test-room.mp3"]);
  assert.equal(context.decodes, 1, "partial bytes must never reach the decoder");
  assert.deepEqual(delivered, ["room"]);
});

test("the network deadline is cleared before decoding and cannot free an in-flight decode slot", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const decodes = [deferred(), deferred(), deferred()], signals = [], delivered = [];
  const context = decodeContext(() => decodes[context.decodes - 1].promise);
  const loader = createProductionAudioLoader({ context, active: () => true,
    registry: registry({ room: reviewed(), wind: reviewed({ url: "/audio/test-wind.mp3" }), water: reviewed({ url: "/audio/test-water.mp3" }) }),
    fetchFile: async (_url, { signal }) => { signals.push(signal); return response(); }, ready: id => delivered.push(id) });
  t.after(() => loader.dispose());
  loader.request("room"); loader.request("wind"); loader.request("water");
  await tick();
  assert.equal(context.decodes, 2);
  t.mock.timers.tick(PRODUCTION_AUDIO_NETWORK_TIMEOUT_MS * 2); await tick();
  assert.ok(signals.every(signal => !signal.aborted));
  assert.equal(signals.length, 2, "decodes still occupy both shared slots after the network deadline");
  decodes[0].resolve(buffer()); await tick();
  assert.equal(signals.length, 3);
  decodes[1].resolve(buffer()); decodes[2].resolve(buffer()); await tick();
  assert.deepEqual(delivered, ["room", "wind", "water"]);
});

test("loop preparation keeps stereo/region/nominal level and closes both boundaries without mutating the source", () => {
  const original = buffer(2), before = original.getChannelData(0).slice();
  const context = decodeContext();
  const loop = prepareProductionAudioLoop(context, original, reviewed({ loop: { startSeconds: .2, endSeconds: .8, edgeFadeSeconds: .025 } }));
  assert.equal(loop.length, 4800); assert.equal(loop.numberOfChannels, 2);
  for (let channel = 0; channel < 2; channel++) {
    const samples = loop.getChannelData(channel);
    assert.equal(samples[0], 0); assert.equal(samples.at(-1), 0);
    assert.ok(Math.abs(samples[800] - original.getChannelData(channel)[2400] * Math.pow(10, -6 / 20)) < 1e-7);
  }
  assert.deepEqual(original.getChannelData(0), before);
  for (const loop of [{ startSeconds: 2 }, { endSeconds: 1.1 }, { startSeconds: .3, endSeconds: .31 }])
    assert.throws(() => prepareProductionAudioLoop(context, original, reviewed({ loop })));
  assert.throws(() => prepareProductionAudioLoop(context, buffer(3), reviewed()));
  const allocations = context.allocations;
  assert.throws(() => prepareProductionAudioLoop(context, { numberOfChannels: 2, length: 1_000_001, sampleRate: 48000 }, reviewed()));
  assert.equal(context.allocations, allocations, "oversized decoded audio must not allocate a second PCM copy");
});

test("a response arriving after unmount is cancelled without starting a decoder", async () => {
  const pending = deferred(), context = decodeContext();
  let cancelled = 0;
  const body = new ReadableStream({ cancel() { cancelled++; } });
  const loader = createProductionAudioLoader({ context, active: () => true, registry: registry({ room: reviewed() }),
    fetchFile: () => pending.promise, ready: () => assert.fail("late request installed a voice") });
  loader.request("room"); loader.dispose();
  pending.resolve(new Response(body)); await tick();
  assert.equal(cancelled, 1); assert.equal(context.decodes, 0);
});

test("pause and disposal abort fetch; a late non-abortable decode cannot create buffers or voices", async () => {
  for (const action of ["pause", "dispose"]) {
    const pending = deferred(), context = decodeContext(() => pending.promise);
    let active = true, signal;
    const loader = createProductionAudioLoader({ context, active: () => active, registry: registry({ room: reviewed() }),
      fetchFile: async (_url, init) => { signal = init.signal; return response(); }, ready: () => assert.fail("late voice") });
    loader.request("room"); await tick(); assert.equal(context.decodes, 1);
    active = false; loader[action](); assert.equal(signal.aborted, true);
    pending.resolve(buffer()); await tick();
    assert.equal(context.allocations, 0); loader.dispose();
  }
});

test("pause/resume cannot bypass the two in-flight decode limit or replay a stale completion", async () => {
  const pending = [deferred(), deferred(), deferred()], context = decodeContext(() => pending[context.decodes - 1].promise);
  const delivered = [], requests = [];
  const loader = createProductionAudioLoader({ context, active: () => true,
    registry: registry({ room: reviewed(), wind: reviewed({ url: "/audio/test-wind.mp3" }), water: reviewed({ url: "/audio/test-water.mp3" }) }),
    fetchFile: async url => { requests.push(url); return response(); }, ready: id => delivered.push(id) });
  loader.request("room"); loader.request("wind"); loader.request("water"); await tick();
  assert.equal(requests.length, 2); assert.equal(context.decodes, 2);
  loader.pause(); loader.request("water"); await tick(); assert.equal(requests.length, 2);
  pending[0].resolve(buffer()); await tick(); assert.equal(requests.length, 3);
  pending[1].resolve(buffer()); pending[2].resolve(buffer()); await tick();
  assert.deepEqual(delivered, ["water"]); loader.dispose();
});

test("a remounted director shares the decode budget while disposed decoders are still settling", async () => {
  const pending = [deferred(), deferred(), deferred()];
  const context = decodeContext(() => pending[context.decodes - 1].promise);
  let fetches = 0;
  const delivered = [];
  const options = { context, active: () => true, registry: registry({ room: reviewed(), wind: reviewed({ url: "/audio/test-wind.mp3" }) }),
    fetchFile: async () => { fetches++; return response(); } };
  const old = createProductionAudioLoader({ ...options, ready: () => assert.fail("disposed director received a loop") });
  old.request("room"); old.request("wind"); await tick(); old.dispose();
  const remount = createProductionAudioLoader({ ...options, ready: id => delivered.push(id) });
  remount.request("room"); await tick(); assert.equal(fetches, 2);
  pending[0].resolve(buffer()); await tick(); assert.equal(fetches, 3);
  pending[1].resolve(buffer()); pending[2].resolve(buffer()); await tick();
  assert.deepEqual(delivered, ["room"]); remount.dispose();
});

function voiceHarness() {
  const nodes = [], sources = [];
  const param = (value = 0) => ({ value, events: [],
    setValueAtTime(value, time) { this.value = value; this.events.push(["set", value, time]); },
    setTargetAtTime(value, time) { this.value = value; this.events.push(["target", value, time]); },
    cancelScheduledValues(time) { this.events.push(["cancel", time]); },
    linearRampToValueAtTime(value, time) { this.events.push(["ramp", value, time]); },
  });
  const node = () => { const n = { connections: new Set(), gain: param(1), frequency: param(),
    connect(to) { this.connections.add(to); }, disconnect(to) { if (to) this.connections.delete(to); else this.connections.clear(); } }; nodes.push(n); return n; };
  const context = { currentTime: 12, createGain: node, createBiquadFilter: node,
    createBufferSource() { const source = { ...node(), detune: param(), playbackRate: param(1), stops: [],
      start(time) { this.started = time; }, stop(time) { this.stops.push(time); } }; sources.push(source); return source; } };
  const input = node(), listener = { context, getInput: () => input };
  const stem = { ...createNarrativeStemVoice(listener, buffer()), volume: .2 };
  stem.sound.setVolume(.2); stem.sound.play();
  return { context, listener, stem, nodes, sources };
}

test("reviewed replacement overlaps two voices with complementary audio-clock fades, then releases the old graph", () => {
  const { context, listener, stem, sources } = voiceHarness();
  const previous = stem.sound, production = buffer();
  assert.equal(replaceNarrativeStemBuffer(listener, stem, production), true);
  assert.equal(sources.length, 2); assert.equal(stem.sound.isPlaying, true);
  assert.equal(stem.retiring.sound, previous);
  const end = context.currentTime + PRODUCTION_STEM_CROSSFADE_SECONDS;
  assert.deepEqual(stem.fade.gain.events, [["cancel", 12], ["set", 0, 12], ["ramp", 1, end]]);
  assert.deepEqual(stem.retiring.fade.gain.events, [["cancel", 12], ["set", 1, 12], ["ramp", 0, end]]);
  assert.deepEqual(sources[0].stops, [end]);
  const outgoing = stem.retiring;
  sources[0].onended();
  assert.equal(stem.retiring, undefined);
  assert.equal(outgoing.sound.isPlaying, false);
  for (const node of [sources[0], outgoing.filter, outgoing.sound.getOutput(), outgoing.fade]) assert.equal(node.connections.size, 0);
  assert.equal(replaceNarrativeStemBuffer(listener, stem, production), false);
  assert.equal(sources.length, 2);
});

test("mute during production crossfade stops both voices immediately; resume cannot resurrect the retired loop", () => {
  const { listener, stem, sources, nodes } = voiceHarness();
  replaceNarrativeStemBuffer(listener, stem, buffer());
  pauseNarrativeAudioNodes(listener, [stem]);
  assert.equal(listener.getInput().gain.value, 0);
  assert.equal(stem.sound.isPlaying, false); assert.equal(stem.retiring, undefined); assert.equal(stem.volume, 0);
  assert.equal(sources[0].onended, null); assert.equal(sources[1].onended, null);
  assert.equal(sources[0].connections.size, 0); assert.equal(sources[1].connections.size, 0);
  stem.sound.play(); assert.equal(sources.length, 3); assert.equal(sources[2].buffer, stem.sound.buffer);
  pauseNarrativeAudioNodes(listener, [stem]); disposeNarrativeAudioNodes(listener, [stem]);
  assert.ok(nodes.every(node => node.connections.size === 0), "unmount detaches every owned node including crossfade gains");
});

test("an interrupted replacement start retains the playing fallback and disposes the rejected voice", () => {
  const { context, listener, stem, sources, nodes } = voiceHarness();
  const previous = stem.sound;
  context.createBufferSource = () => { throw new Error("context interrupted"); };
  assert.equal(replaceNarrativeStemBuffer(listener, stem, buffer()), false);
  assert.equal(stem.sound, previous); assert.equal(previous.isPlaying, true);
  assert.equal(stem.retiring, undefined); assert.deepEqual(sources[0].stops, []);
  assert.deepEqual(stem.fade.gain.events.slice(-2), [["cancel", 12], ["set", 1, 12]]);
  pauseNarrativeAudioNodes(listener, [stem]); disposeNarrativeAudioNodes(listener, [stem]);
  assert.ok(nodes.every(node => node.connections.size === 0));
});


test("review dates are real calendar dates or canonical UTC timestamps", () => {
  for (const reviewedAt of ["2024-02-29", "2026-09-25", "2026-09-25T10:21:22.123Z"])
    assert.equal(reviewedProductionAudio(reviewed({ reviewedAt }))?.reviewedAt, reviewedAt);
  for (const reviewedAt of ["2025-02-29", "2026-04-31", "2026-00-01", "2026-09-25T10:21:22.123+00:00"])
    assert.equal(reviewedProductionAudio(reviewed({ reviewedAt })), null);
});

test("decoded admission rejects invalid PCM anywhere in the recording before copying a loop", () => {
  const context = decodeContext();
  for (const index of [0, 2000, 7999]) for (const invalid of [NaN, Infinity, -Infinity]) {
    const decoded = buffer(2);
    decoded.getChannelData(1)[index] = invalid;
    assert.throws(() => prepareProductionAudioLoop(context, decoded, reviewed({ loop: { startSeconds: .2, endSeconds: .8 } })), /Non-finite/);
  }
  for (const patch of [
    { numberOfChannels: 1.5 }, { length: 0 }, { length: NaN }, { length: 8000.5 },
    { sampleRate: Infinity }, { sampleRate: 1000 }, { sampleRate: 192001 },
    { getChannelData: () => new Float32Array(7999) },
  ]) assert.throws(() => prepareProductionAudioLoop(context, { ...buffer(), ...patch }, reviewed()));
  assert.equal(context.allocations, 0, "invalid recordings must allocate no retained PCM");
  for (const rate of [8000, 44100, 48000, 96000, 192000]) {
    const result = prepareProductionAudioLoop(context, buffer(1, rate / 2, rate), reviewed());
    assert.equal(result.sampleRate, rate); assert.equal(result.length, rate / 2);
  }
});

test("zero-byte streamed audio fails before decoding and tries alternatives in the declared order", async () => {
  const requested = [], delivered = [], context = decodeContext();
  const loader = createProductionAudioLoader({ context, active: () => true,
    registry: registry({ room: reviewed({ alternatives: [
      { url: "/audio/second.ogg", format: "ogg" }, { url: "/audio/third.mp3", format: "mp3" },
    ] }) }),
    fetchFile: async url => { requested.push(url); return requested.length < 3 ? new Response(new Uint8Array()) : response(); },
    ready: id => delivered.push(id) });
  loader.request("room"); await tick(); await tick();
  assert.deepEqual(requested, ["/audio/test-room.mp3", "/audio/second.ogg", "/audio/third.mp3"]);
  assert.equal(context.decodes, 1); assert.deepEqual(delivered, ["room"]); loader.dispose();
});

test("a second replacement never retains three voices and unmount releases its pending audio-clock fade", () => {
  const { listener, stem, sources, nodes } = voiceHarness();
  replaceNarrativeStemBuffer(listener, stem, buffer());
  const firstRetired = stem.retiring;
  replaceNarrativeStemBuffer(listener, stem, buffer());
  assert.equal(sources.length, 3);
  assert.equal(firstRetired.sound.isPlaying, false);
  assert.equal(firstRetired.sound.source.onended, null);
  assert.equal(firstRetired.sound.source.connections.size, 0);
  assert.equal(stem.retiring.sound.source, sources[1]);
  assert.equal(stem.sound.source, sources[2]);
  pauseNarrativeAudioNodes(listener, [stem]); disposeNarrativeAudioNodes(listener, [stem]);
  assert.ok(nodes.every(node => node.connections.size === 0));
  assert.ok(sources.every(source => source.onended === null && source.stops.length > 0));
});

test("context interruption cancels pending loading and both crossfade voices without resuming or closing the shared context", async () => {
  const { context, listener, stem, sources } = voiceHarness();
  const events = new EventTarget();
  context.addEventListener = events.addEventListener.bind(events);
  context.removeEventListener = events.removeEventListener.bind(events);
  context.state = "running";
  context.createBuffer = () => assert.fail("late decode allocated a retained buffer");
  const decode = deferred(); context.decodeAudioData = () => decode.promise;
  let allowed = true, playing = true, signal, starts = 0;
  const loader = createProductionAudioLoader({ context, active: () => allowed && playing && context.state === "running",
    registry: registry({ room: reviewed() }), fetchFile: async (_url, init) => { signal = init.signal; return response(); },
    ready: () => assert.fail("interrupted context installed a stale loop") });
  const gate = createNarrativePlaybackGate({ allowed: () => allowed, running: () => context.state === "running",
    resume: () => assert.fail("state observation cannot resume audio"),
    play: () => { starts++; playing = true; },
    pause: () => { playing = false; loader.pause(); pauseNarrativeAudioNodes(listener, [stem]); },
    dispose: () => { loader.dispose(); disposeNarrativeAudioNodes(listener, [stem]); },
  });
  const unobserve = observeNarrativeAudioContext(context, () => gate.pause(), () => { void gate.start(); });
  replaceNarrativeStemBuffer(listener, stem, buffer()); loader.request("room"); await tick();
  context.state = "suspended"; events.dispatchEvent(new Event("statechange"));
  assert.equal(signal.aborted, true); assert.equal(stem.retiring, undefined);
  assert.equal(stem.sound.isPlaying, false); assert.equal(listener.getInput().gain.value, 0);
  assert.ok(sources.every(source => source.stops.length > 0));
  decode.resolve(buffer()); await tick();
  allowed = false; context.state = "running"; events.dispatchEvent(new Event("statechange")); await tick();
  assert.equal(starts, 0, "running context cannot bypass mute");
  allowed = true; events.dispatchEvent(new Event("statechange")); await tick(); assert.equal(starts, 1);
  unobserve(); gate.dispose();
  events.dispatchEvent(new Event("statechange")); await tick(); assert.equal(starts, 1, "unmounted observer is detached");
});
