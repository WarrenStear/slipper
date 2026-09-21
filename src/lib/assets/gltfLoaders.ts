import { useGLTF, useKTX2 } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { KTX2Loader } from "three-stdlib";

export const DRACO_DECODER_PATH = "/draco/";
export const BASIS_TRANSCODER_PATH = "/basis/";

let sharedKtx2Loader: KTX2Loader | null = null;

export function useSharedKtx2Loader() {
  const gl = useThree((state) => state.gl);

  if (!sharedKtx2Loader) {
    sharedKtx2Loader = new KTX2Loader();
    sharedKtx2Loader.setTranscoderPath(BASIS_TRANSCODER_PATH);
    sharedKtx2Loader.detectSupport(gl);
  }

  return sharedKtx2Loader;
}

export function useCompressedGLTF(path: string) {
  const ktx2Loader = useSharedKtx2Loader();

  return useGLTF(path, DRACO_DECODER_PATH, true, (loader) => {
    loader.setKTX2Loader(ktx2Loader);
  });
}

export function useForestKtx2Textures() {
  const [bark, crown, marsh] = useKTX2(
    [
      "/textures/forest/bark.ktx2",
      "/textures/forest/crown.ktx2",
      "/textures/forest/marsh.ktx2",
    ],
    BASIS_TRANSCODER_PATH,
  );

  return { bark, crown, marsh };
}

useGLTF.preload("/models/wolf.glb", DRACO_DECODER_PATH);
useGLTF.preload("/models/phantom.glb", DRACO_DECODER_PATH);
