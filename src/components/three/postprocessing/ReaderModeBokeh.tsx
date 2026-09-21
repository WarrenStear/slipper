export type ReaderModeBokehProps = {
  mode: "explore" | "read" | "map";
  quality: "low" | "medium" | "high";
};

/**
 * Reader mode post-processing is intentionally disabled in the lean production
 * build. The previous component imported @react-three/postprocessing and
 * postprocessing, but those packages are not part of the locked dependency set.
 * Keeping this no-op preserves the public component API without reintroducing a
 * heavy optional render path or breaking Cloudflare builds.
 */
export function ReaderModeBokeh(_props: ReaderModeBokehProps) {
  return null;
}
