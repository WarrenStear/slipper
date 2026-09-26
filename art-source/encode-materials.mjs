import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { zstdCompressSync, constants as zlibConstants } from 'node:zlib';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import * as ktx from 'ktx-parse';
const root=fileURLToPath(new URL('../',import.meta.url));
for (const material of ['oak','bark']) {
const sources=Object.fromEntries(['albedo','roughness','normal'].map(channel=>[channel,path.join(root,'art-source',material,channel+'-v1.png')]));
const records=[];
await fs.mkdir(path.join(root,'public/art/materials/'+material),{recursive:true});
await fs.mkdir(path.join(root,'art-source/'+material),{recursive:true});
for (const [channel,input] of Object.entries(sources)) {
 const source=await fs.readFile(input);
 const container=ktx.createDefaultContainer();
 container.vkFormat=channel==='albedo'?ktx.VK_FORMAT_R8G8B8A8_SRGB:ktx.VK_FORMAT_R8G8B8A8_UNORM;
 const dimension=channel==='albedo'?512:256;
 container.pixelWidth=container.pixelHeight=dimension;
 container.supercompressionScheme=ktx.KHR_SUPERCOMPRESSION_ZSTD;
 container.keyValue={KTXorientation:'ru',KTXwriter:`Slipper in the Woods generated ${material} asset packing, sharp + ktx-parse`,source:'Generated using OpenAI ImageGen; not a measured scan'};
 const dfd=container.dataFormatDescriptor[0];
 dfd.colorModel=ktx.KHR_DF_MODEL_RGBSDA;
 dfd.transferFunction=channel==='albedo'?ktx.KHR_DF_TRANSFER_SRGB:ktx.KHR_DF_TRANSFER_LINEAR;
 dfd.bytesPlane=[4,0,0,0,0,0,0,0];
 dfd.samples=[0,1,2,15].map((channelType,index)=>({bitOffset:index*8,bitLength:7,channelType,samplePosition:[0,0,0,0],sampleLower:0,sampleUpper:255}));
 let residentBytes=0;
 for(let size=dimension;size>=1;size>>=1) {
  // File packing only: bottom row first lets flipY=false retain OpenGL UV orientation.
  const bytes=await sharp(source).resize(size,size,{kernel:'lanczos3'}).flip().ensureAlpha().raw().toBuffer();
  if(material==='bark' && channel==='normal') for(let i=1;i<bytes.length;i+=4) bytes[i]=255-bytes[i];
  residentBytes+=bytes.length;
  const packed=zstdCompressSync(bytes,{params:{[zlibConstants.ZSTD_c_compressionLevel]:15}});
  container.levels.push({levelData:new Uint8Array(packed),uncompressedByteLength:bytes.length});
 }
 container.levelCount=container.levels.length;
 const packed=ktx.write(container),file=`${material}-${channel}-v1.ktx2`;
 await fs.writeFile(path.join(root,'public/art/materials/'+material,file),packed);
 records.push({channel,file,sourceSha256:createHash('sha256').update(source).digest('hex'),runtimeSha256:createHash('sha256').update(packed).digest('hex'),dimension,levels:container.levelCount,downloadBytes:packed.length,residentBytes,format:channel==='albedo'?'RGBA8 sRGB':'RGBA8 linear',supercompression:'Zstandard',greenChannelConverted:material==='bark'&&channel==='normal'});
}
const recordPath=path.join(root,'art-source',material,'source-record.json');
const previous=JSON.parse(await fs.readFile(recordPath,'utf8'));
await fs.writeFile(recordPath,JSON.stringify({...previous,records},null,2)+'\n');
console.log(material,JSON.stringify(records,null,2));
}
