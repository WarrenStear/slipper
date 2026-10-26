import { Texture, SRGBColorSpace, RepeatWrapping, ClampToEdgeWrapping } from "three";

/** Independent samplers over the loader's immutable 2D image. Texture.clone()
 * marks its shared Source dirty, needlessly re-uploading unchanged pixels when
 * scenery mounts. Mark our fresh sampler ready BEFORE borrowing the Source.
 * Three then owns GPU sharing, reference counts and renderer-specific disposal.
 * This helper is only for the woodland's loaded image textures, not video,
 * render targets, data textures or compressed material delivery. */
export function createForestImageSampler(source: Texture, repeat: readonly [number, number] = [1, 1], anisotropy = 4, clamp = false) {
  const texture = new Texture();
  texture.mapping = source.mapping; texture.channel = source.channel;
  texture.magFilter = source.magFilter; texture.minFilter = source.minFilter;
  texture.format = source.format; texture.internalFormat = source.internalFormat; texture.type = source.type;
  texture.generateMipmaps = source.generateMipmaps; texture.mipmaps = source.mipmaps?.slice() ?? [];
  texture.flipY = source.flipY; texture.premultiplyAlpha = source.premultiplyAlpha; texture.unpackAlignment = source.unpackAlignment;
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = clamp ? ClampToEdgeWrapping : RepeatWrapping;
  texture.repeat.set(...repeat); texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  texture.source = source.source;
  return texture;
}
