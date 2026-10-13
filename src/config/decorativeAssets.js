/** Reference-provided presentation assets, kept separate from analyzed media. */
export const DECORATIVE_ASSET_ROOT = 'public/assets';

/** @type {Record<string, import('../data/ohoraTypes.js').DecorativeAsset>} */
export const DECORATIVE_ASSETS = Object.freeze({
  heroBannerImage: Object.freeze({
    kind: 'decorative-reference',
    slot: 'heroBannerImage',
    status: 'ready',
    src: '/assets/e04-hero-banner.png',
    fileName: 'e04-hero-banner.png',
    alt: 'OHORA Nail Intelligence. Discover trends. Analyze designs. Turn inspiration into opportunity.',
    target: { width: 965, height: 154 },
  }),
  sidebarStoryImage: Object.freeze({
    kind: 'decorative-reference',
    slot: 'sidebarStoryImage',
    status: 'ready',
    src: '/assets/e03-every-nail-tells-a-story.png',
    fileName: 'e03-every-nail-tells-a-story.png',
    alt: 'OHORA manicure photograph with the words Every Nail Tells a Story.',
    target: { width: 192, height: 385 },
  }),
  todayInsightImage: Object.freeze({
    kind: 'decorative-reference',
    slot: 'todayInsightImage',
    status: 'ready',
    src: '/assets/e01-todays-insight-photo.png',
    fileName: 'e01-todays-insight-photo.png',
    alt: 'Cropped editorial pink and glitter manicure photograph.',
    target: { width: 422, height: 154 },
  }),
  signatureCombinationImage: Object.freeze({
    kind: 'decorative-reference',
    slot: 'signatureCombinationImage',
    status: 'ready',
    src: '/assets/e02-signature-combinations.png',
    fileName: 'e02-signature-combinations.png',
    alt: 'Signature combinations nail color sample image.',
    target: { width: 126, height: 204 },
  }),
});

export function getDecorativeAsset(slot) {
  return DECORATIVE_ASSETS[slot] || null;
}

export function isDecorativeAsset(asset) {
  return asset?.kind === 'decorative-generated' || asset?.kind === 'decorative-reference';
}
