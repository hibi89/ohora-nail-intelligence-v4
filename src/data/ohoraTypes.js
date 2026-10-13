/**
 * JSDoc contracts shared by the browser-safe data layer. Keep raw source,
 * normalized analysis media, and decorative assets as distinct types.
 *
 * @typedef {'color'|'technique'|'texture'|'motif'|'season'|'use'} TagCategory
 * @typedef {Record<TagCategory, string[]>} SlideTags
 * @typedef {'matched'|'matched-index-only'|'unmatched-slide'|'ambiguous-index'|'ambiguous-post-id'|'url-mismatch'|'invalid-index'} SlideMatchStatus
 * @typedef {{ code: string, severity: 'warning'|'error', count: number, message: string }} DataQualityIssue
 * @typedef {{ from: string|null, to: string|null, source: 'latest-observation'|'user-filter' }} DateRange
 *
 * @typedef {object} NormalizedAsset
 * @property {string|null} assetId
 * @property {string} postId
 * @property {number|null} index
 * @property {string|null} mediaType
 * @property {string|null} url Safe HTTP(S) URL, or null.
 * @property {boolean} hasAnalysis
 * @property {string|null} matchedSlideKey
 *
 * @typedef {object} NormalizedSlide
 * @property {string} key Composite key derived from parent post ID and exact slide index.
 * @property {string} postId
 * @property {number|null} index
 * @property {string|null} imageUrl Safe HTTP(S) URL, or null.
 * @property {string} imageUrlSource
 * @property {string|null} assetId Exact-index asset only; null on ambiguous or mismatched links.
 * @property {SlideMatchStatus} matchStatus
 * @property {boolean|null} isDesignPost
 * @property {SlideTags} tags
 * @property {unknown} visualEvidence
 *
 * @typedef {object} NormalizedPost
 * @property {string} postId
 * @property {string|null} caption
 * @property {string|null} publishedAt ISO UTC timestamp, or null.
 * @property {string|null} permalink Safe HTTP(S) URL, or null.
 * @property {string|null} permalinkHost Host only; never the full URL.
 * @property {string|null} explicitPlatform
 * @property {string|null} mediaType
 * @property {boolean|null} isCarousel
 * @property {number|null} imageCount
 * @property {number|null} carouselChildCount
 * @property {boolean|null} isDesignPost
 * @property {number|null} likes
 * @property {number|null} comments
 * @property {number|null} followers
 * @property {number|null} engagementRatePct Source field, confirmed as percent for the audited snapshot.
 * @property {number|null} calculatedEngagementRatePct Independently calculated from available counts.
 * @property {unknown} visualEvidence
 * @property {string[]} slideKeys
 * @property {string[]} assetIds
 *
 * @typedef {object} NormalizedOhoraData
 * @property {{schemaVersion:string, generatedAt:string|null, sourceUpdatedAt:string|null, fetchedAt:string|null, stale:boolean, cached:boolean}} meta
 * @property {NormalizedPost[]} posts
 * @property {NormalizedSlide[]} slides
 * @property {NormalizedAsset[]} assets
 * @property {Array<{key:string,postId:string,slideIndex:number,label:string}>} colors
 * @property {Array<{key:string,postId:string,slideIndex:number,category:TagCategory,value:string}>} tags
 * @property {Array<{postId:string,isDesignPost:boolean|null,visionStatus:string|null,analyzedImageCount:number|null,visualEvidence:unknown,slideKeys:string[],success:boolean}>} aiResults
 * @property {object} dataQuality
 *
 * @typedef {{kind:'decorative-generated'|'decorative-reference', slot:string, status:'pending-generation'|'ready', src:string|null, alt:string, fileName:string, target:{width:number,height:number}}} DecorativeAsset
 * @typedef {{kind:'analysis-source', postId:string, slideIndex:number, assetId:string|null, src:string|null}} AnalysisImageAsset
 * @typedef {DecorativeAsset|AnalysisImageAsset} DashboardImageAsset
 */

export const TAG_CATEGORIES = Object.freeze([
  'color',
  'technique',
  'texture',
  'motif',
  'season',
  'use',
]);

export const COMBINATION_CATEGORIES = Object.freeze([
  'color',
  'technique',
  'motif',
]);
