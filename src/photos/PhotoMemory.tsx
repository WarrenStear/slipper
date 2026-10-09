import { useEffect, useMemo, useState } from 'react';
import { useMobileViewport } from '../hooks/useMobileViewport';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { entries as canonicalEntries, visuals as canonicalVisuals } from '../data/slipperContent';
import type { Slipper3DEntry, Slipper3DVisual, Vector3Tuple } from '../data/slipper3dTypes';
import { useStoryRuntimeHost } from '../experience/StoryRuntimeContext';
import { useJourneyStore } from '../stores/useJourneyStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useWorldStore } from '../stores/useWorldStore';
import { resolvePhotoMemory, photoMemorySize, type PhotoMemoryIntent, type PhotoMemoryAdmission } from './photoMemoryAdmission';
import { createPhotoMemoryFrame } from './photoMemoryGeometry';
import { photoMemoryTexturePool, type PhotoTextureResource } from './photoMemoryTextures';

export type PhotoMemoryProps = {
  entryId: string;
  /** No mount is a reveal intent. An existing explicit inspected/still presentation may opt in. */
  intent?: PhotoMemoryIntent | null;
  position: Vector3Tuple;
  quality: 'low' | 'medium' | 'high' | 'cinematic';
  mobile?: boolean;
  entries?: readonly Slipper3DEntry[];
  visuals?: readonly Slipper3DVisual[];
};

function usePhotographForeground() {
  const [foreground,setForeground] = useState(() => typeof document !== 'undefined' && !document.hidden && document.hasFocus());
  useEffect(() => {
    let disposed=false,pageHidden=false;
    const refresh = () => {if(!disposed)setForeground(!pageHidden&&!document.hidden&&document.hasFocus());};
    const blur = () => {if(!disposed)setForeground(false);};
    const hide = () => {pageHidden=true;blur();};
    const show = () => {pageHidden=false;refresh();};
    window.addEventListener('blur',blur);window.addEventListener('focus',refresh);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);
    document.addEventListener('visibilitychange',refresh);refresh();
    return () => {disposed=true;window.removeEventListener('blur',blur);window.removeEventListener('focus',refresh);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  return foreground;
}

/** Rare presentation only. Witness/explicit binding precedes URL/alt lookup and texture work. */
export function PhotoMemory({ entryId,intent,position,quality,mobile=false,
  entries=canonicalEntries,visuals=canonicalVisuals }: PhotoMemoryProps) {
  const host = useStoryRuntimeHost();
  const viewport = useMobileViewport();
  const activeEntryId = useJourneyStore(state=>state.activeEntryId),sceneId=useJourneyStore(state=>state.sceneId);
  const witnesses=useJourneyStore(state=>state.witnessedEntryIds),inventory=useJourneyStore(state=>state.inventory);
  const completedRituals=useJourneyStore(state=>state.completedRitualIds);
  const reducedEffects=useSettingsStore(state=>state.reducedEffects),drawerOpen=useSettingsStore(state=>state.drawerOpen);
  const mode=useWorldStore(state=>state.mode),paused=useWorldStore(state=>state.physicsPaused);
  const foreground=usePhotographForeground();
  const memory=resolvePhotoMemory({entryId,activeEntryId,sceneId,witnessedEntryIds:witnesses,
    openingResolved: inventory.lantern || completedRituals.includes('ritual.accept-lantern'),
    participating:Boolean(host?.runtime.currentLease()),foreground,overlayOpen:drawerOpen||paused,
    mode,quality,reducedEffects,mobile:mobile||viewport.isMobile,intent},entries,visuals);
  return memory ? <FramedPhotoMemory key={`${memory.entryId}:${memory.visualId}:${memory.src}`} memory={memory} position={position} /> : null;
}

function FramedPhotoMemory({ memory,position }: {memory:PhotoMemoryAdmission;position:Vector3Tuple}) {
  const {gl}=useThree();
  const [loaded,setLoaded]=useState<PhotoTextureResource|null>(null);
  useEffect(()=>{
    let disposed=false;const owned=photoMemoryTexturePool(gl).acquire(memory.src);
    owned.promise.then(resource=>{if(!disposed)setLoaded(resource);});
    return()=>{disposed=true;owned.release();};
  },[gl,memory.src]);
  return loaded ? <PhotoMemoryImage resource={loaded} memory={memory} position={position} /> : null;
}

function PhotoMemoryImage({ resource,memory,position }:{resource:PhotoTextureResource;memory:PhotoMemoryAdmission;position:Vector3Tuple}) {
  const {gl}=useThree();
  // The admitted alt needs no screen position or per-frame projection owner.
  useEffect(()=>{
    const parent=gl.domElement.parentElement;if(!parent)return;
    const semantic=gl.domElement.ownerDocument.createElement('span');
    semantic.className='sr-only';semantic.setAttribute('role','img');semantic.setAttribute('aria-label',memory.alt);
    parent.appendChild(semantic);
    return()=>semantic.remove();
  },[gl,memory.alt]);
  const size=photoMemorySize(memory.orientation,resource.width/resource.height);
  const resources=useMemo(()=>({ frame:createPhotoMemoryFrame(size.width,size.height),
    plane:new THREE.PlaneGeometry(size.width,size.height),
    frameMaterial:new THREE.MeshStandardMaterial({color:'#51473b',roughness:.94,metalness:0}),
    photoMaterial:new THREE.MeshStandardMaterial({map:resource.texture,color:'#ffffff',roughness:.92,metalness:0,side:THREE.FrontSide}),
  }),[size.width,size.height,resource.texture]);
  useEffect(()=>()=>{resources.frame.dispose();resources.plane.dispose();resources.frameMaterial.dispose();resources.photoMaterial.dispose();},[resources]);
  return <group name="diegetic-photo-memory" position={position} dispose={null}
    userData={{entryId:memory.entryId,visualId:memory.visualId,photoMemory:'framed'}}>
    <mesh geometry={resources.frame} material={resources.frameMaterial}/>
    <mesh position={[0,0,.024]} geometry={resources.plane} material={resources.photoMaterial}/>
  </group>;
}

/** Historical shrine adapter remains dormant without an explicit existing reveal intent.
 * Its legacy visual prop remains accepted; canonical binding now chooses the asset. */
export function MemoryShrine({entry,visual,intent}:{entry:Slipper3DEntry;visual?:Slipper3DVisual;intent?:PhotoMemoryIntent}) {
  const quality=useSettingsStore(state=>state.performanceProfile);
  const mobile=typeof window!=='undefined'&&window.matchMedia('(pointer: coarse)').matches;
  return <PhotoMemory entryId={entry.id} intent={intent} quality={quality} mobile={mobile}
    position={[0,.42,entry.engine3d.sceneKind==='archive'?-6.7:-6.15]} />;
}
