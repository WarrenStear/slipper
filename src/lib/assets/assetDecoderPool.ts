import { LoadingManager, type CompressedTexture, type WebGLRenderer } from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTFParser } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { disposeHeroResources } from "./heroAssetValidation.ts";

export const DRACO_DECODER_PATH = "/draco/";
export const BASIS_TRANSCODER_PATH = "/basis/";
export const ASSET_DECODER_WORKERS = 2;

type Decoders = { gltf: GLTFLoader; ktx2: KTX2Loader; dispose: () => void; whenIdle?: () => Promise<void> };

export function createAssetOperationTracker() {
  const pending = new Set<Promise<unknown>>();
  return {
    track<T>(operation: Promise<T>): Promise<T> {
      pending.add(operation);
      void operation.then(() => pending.delete(operation), () => pending.delete(operation));
      return operation;
    },
    async whenIdle() {
      // Settling a buffer dependency can start its texture/geometry decode. Drain
      // again until those newly started operations have also completed.
      while (pending.size) await Promise.allSettled([...pending]);
    },
  };
}

/** Three's root Promise.all may reject before sibling worker decodes finish.
 * Delay the error callback until real dependency work settles, then dispose any
 * partial scene/material/texture resources instead of orphaning them. */
export function guardGltfParserLifetime(parser: GLTFParser) {
  const work = createAssetOperationTracker(), resources = new Set<unknown>();
  const retain = <T,>(operation: Promise<T>) => work.track(operation.then(value => { resources.add(value); return value; }));
  const getDependency = parser.getDependency.bind(parser), loadGeometries = parser.loadGeometries.bind(parser), parse = parser.parse.bind(parser);
  parser.getDependency = (type, index) => retain(getDependency(type, index));
  parser.loadGeometries = primitives => retain(loadGeometries(primitives));
  parser.parse = (onLoad, onError) => parse(result => { resources.clear(); onLoad(result); }, error => {
    void work.whenIdle().then(() => {
      disposeHeroResources(resources); resources.clear(); onError?.(error);
    });
  });
}

/** Lease owners must retain their lease until non-abortable parses/transcodes settle. */
export function createAssetDecoderPool(factory: (renderer: WebGLRenderer) => Decoders) {
  const pools = new WeakMap<WebGLRenderer, { decoders: Decoders; users: number }>();
  return (renderer: WebGLRenderer) => {
    let pool = pools.get(renderer);
    if (!pool) { pool = { decoders: factory(renderer), users: 0 }; pools.set(renderer, pool); }
    const current = pool;
    current.users++;
    let released = false;
    return { gltf: current.decoders.gltf, ktx2: current.decoders.ktx2, release() {
      if (released) return;
      released = true; current.users--;
      // StrictMode's cleanup/setup pair can reuse the same renderer's decoder state.
      queueMicrotask(() => {
        if (current.users || pools.get(renderer) !== current) return;
        const finish = () => {
          if (current.users || pools.get(renderer) !== current) return;
          pools.delete(renderer); current.decoders.dispose();
        };
        if (current.decoders.whenIdle) void current.decoders.whenIdle().then(finish);
        else finish();
      });
    } };
  };
}

export const acquireAssetDecoders = createAssetDecoderPool(renderer => {
  const manager = new LoadingManager();
  // Reviewed GLBs are self-contained. The shared map loader also admits its
  // local material namespace; parser-created blobs/data never require a CDN.
  manager.setURLModifier(url => {
    if ((!url.includes("..") && /^\/art\/materials\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.ktx2$/.test(url)) || /^blob:/.test(url) || /^data:/.test(url) || /^\/(?:draco|basis)\/[A-Za-z0-9_.-]+$/.test(url)) return url;
    throw new Error("External GLTF resource rejected");
  });
  const draco = new DRACOLoader(manager).setDecoderPath(DRACO_DECODER_PATH).setWorkerLimit(ASSET_DECODER_WORKERS);
  const ktx2 = new KTX2Loader(manager).setTranscoderPath(BASIS_TRANSCODER_PATH).setWorkerLimit(ASSET_DECODER_WORKERS).detectSupport(renderer);
  const work = createAssetOperationTracker(), parseTexture = ktx2.parse.bind(ktx2);
  ktx2.parse = (buffer, onLoad, onError) => {
    const pending = work.track(new Promise<CompressedTexture>((resolve, reject) => parseTexture(buffer, resolve, reject)));
    void pending.then(texture => onLoad?.(texture)).catch(error => onError?.(error));
  };
  const gltf = new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  gltf.register(parser => { guardGltfParserLifetime(parser); return { name: "SITW_parser_resource_lifetime" }; });
  return { gltf, ktx2, whenIdle: work.whenIdle, dispose() {
    draco.dispose();
    // Three r171 decrements its active-loader counter even before init. No
    // workers/blob exist until transcoderPending is set, so skip that case.
    if (ktx2.transcoderPending) ktx2.dispose();
  } };
});
