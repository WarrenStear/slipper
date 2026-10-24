// Derive the review map from approved repository content, never a private export.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { journeyChapters, journeyScenes } from '../src/data/journeyNarrative.ts';
import { rawEntries } from '../src/data/slipperArchiveSource.ts';
import { getJourneySceneLayout } from '../src/data/journeyWorldLayout.ts';
import { SCENE_LOOKS } from '../src/components/three/artDirection/SceneLookRegistry.ts';
import { eventsForScene, objectsForScene } from '../src/storyEvents/storyEventRegistry.ts';

const tones = {
  'broken-floor': 'Vulnerability, fracture, willingness', 'enchanted-wood': 'Curiosity, warmth, cautious trust',
  'blue-moon-sanctuary': 'Beauty, tenderness, contradiction', nest: 'Care, responsibility, protection',
  'sunset-seer': 'Witness, stillness, discernment', 'thorned-house': 'Pressure, ambiguity, boundaries',
  'wolf-swan-seer': 'Contradiction held without erasure', 'fire-river': 'Release, cleansing, surrender',
  fork: 'Discernment and relinquishment', 'three-climbs': 'Release of thought, grief, creative agency',
  'crowned-return': 'Self-possession, recognition, sovereignty', 'lantern-epilogue': 'Integration, remembered light, continued freedom',
};
const source = await readFile(new URL('../src/data/slipperArchiveSource.ts', import.meta.url), 'utf8');
const lineFor = id => source.slice(0, source.indexOf(`"id": "${id}"`)).split('\n').length;
const textHash = entry => createHash('sha256').update(entry.body, 'utf8').digest('hex');
const approved = new Map(rawEntries.map(entry => [entry.id, entry]));
const doc = [
  '# Approved source → continuous world map', '',
  'Generated with `node --experimental-strip-types scripts/write-source-world-map.mjs`. The 12 chapters, 32 scenes and 66 approved fragments below remain the canonical catalogue. The willow is optional geography outside this catalogue.', '',
  'The exact text is referenced at its approved source declaration and identified by a SHA-256 digest of its UTF-8 body. This avoids making another copy of the literary source or accidentally incorporating a private-edition overlay. Raw chat, private images and withheld passages are not inputs to this generator.', '',
  'Physical residency is determined by camera position and quality. Story interaction, prose disclosure, progression and save validation still use the existing authoritative event system. The accessible journey uses those same event definitions and prerequisites. Scenery-only objects have separate identities, no event listeners, no prose, no inventory awards and no completion callbacks.', '',
  'Revisits reconstruct accepted object states and placements from the existing journey store. Carried, burned and released objects are excluded from scenery copies. Unaccepted future actions are never synthesized. Local animations may restart after eviction; their progress is not evidence of a canonical action.', '',
];
const receipt = [];
for (const scene of journeyScenes) {
  const chapter = journeyChapters.find(chapter => chapter.id === scene.chapterId), layout = getJourneySceneLayout(scene.id);
  const look = SCENE_LOOKS[scene.id], objects = objectsForScene(scene.id), events = eventsForScene(scene.id);
  const stateActions = events.flatMap(event => event.actions).filter(action => ['object-state','placement','world-flag','landmark','key','symbol','release-word'].includes(action.type));
  const effect = action => Object.entries(action).map(([key,value])=>`${key}=${value}`).join(', ');
  doc.push(`## ${scene.title} — \`${scene.id}\``, '',
    `- **Narrative purpose:** ${chapter.dramaticFunction} Scene role: ${scene.role}.`,
    `- **Emotional tone:** ${tones[scene.chapterId]}.`,
    `- **Original symbols / physical objects:** ${objects.map(object=>`${object.label} (\`${object.id}\`)`).join('; ') || 'Witnessed places and remembered light'}.`,
    `- **Physical landmark:** ${look.composition.heroLandmark}. Anchor X/Z: ${layout.anchor.position[0]}, ${layout.anchor.position[2]}; ground height comes from the shared terrain sampler.`,
    `- **Natural environment:** \`${scene.environmentCue}\`; technical biome \`${scene.biome}\`; motivated ${look.source} light.`,
    `- **Meaningful interactions:** ${events.map(event=>`\`${event.id}\` (${event.trigger}${event.objectId?`, ${event.objectId}`:''})`).join('; ')}.`,
    `- **Persistent environmental consequences:** ${[...new Set(stateActions.map(effect))].map(value=>`\`${value}\``).join('; ') || 'Witnessed completion and existing scene/chapter evidence; no additional collectible state'}.`,
    '- **Exact approved text:** ' + scene.entryIds.map(id=>`[${id}](../src/data/slipperArchiveSource.ts#L${lineFor(id)})${id===scene.keystoneEntryId?' (keystone)':' (echo)'}`).join(', ') + '.',
    '- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.',
    '- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.', '',
  );
  for(const id of scene.entryIds) {
    const entry=approved.get(id);if(!entry)throw Error('Missing approved source: '+id);
    receipt.push({id,sceneId:scene.id,chapterId:scene.chapterId,sourceLine:lineFor(id),bodySha256:textHash(entry)});
  }
}
doc.push('## Optional Willow Refuge', '',
  'The approved willow-and-key passage supplies the source context; no new line, chapter, canonical event or inventory item was added. The old willow stands beside a shallow pool at X −53 / Z −320. Its roots follow the terrain. An earth path connects the first woodland to the sanctuary, with a second exit to the meadow. The unclaimed key remains a small visual symbol of agency. Discovery and pausing are optional; none of the 32 scenes depends on visiting this place.', '',
  'The accessible journey retains the canonical willow/key passage through its existing fragment assignment. The optional scenery adds no exclusive story information or completion requirement.', '',
  '## Exact-text receipt', '', '| Fragment | Scene | Approved body SHA-256 |', '| --- | --- | --- |',
  ...receipt.map(row=>`| ${row.id} | ${row.sceneId} | \`${row.bodySha256}\` |`), '',
);
if(receipt.length!==66||new Set(receipt.map(row=>row.id)).size!==66)throw Error('Canonical fragment mapping changed');
await writeFile(new URL('../docs/CONTINUOUS_WORLD_SOURCE_MAP.md',import.meta.url),doc.join('\n'));
console.log(`Mapped ${journeyChapters.length} chapters, ${journeyScenes.length} scenes, ${receipt.length} approved fragments.`);
