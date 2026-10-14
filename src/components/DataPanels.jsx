import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDisplayDate } from '../utils/dateFormat.js';
import { DecorativePlaceholder } from './DecorativePlaceholder.jsx';
import { Icon } from './Icon.jsx';

const DONUT_COLORS = ['#d99491', '#e8b6a6', '#c88f7d', '#e6c8b8', '#a97a63', '#e7ddd5'];

function useImageFailure() {
  const [failed, setFailed] = useState(false);
  return { failed, markFailed: () => setFailed(true) };
}

function AnalysisImage({ image, className = '', alt = 'OHORA analyzed nail design', onClick, title }) {
  const state = useImageFailure();
  if (!image?.src || state.failed) {
    return (
      <div className={`analysis-image-fallback ${className}`} aria-label="Source image unavailable in this view">
        <Icon name="camera" size={20} />
        <span>Source image unavailable</span>
      </div>
    );
  }
  const element = <img src={image.src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={state.markFailed} />;
  return onClick
    ? <button className={`analysis-image-button ${className}`} type="button" onClick={onClick} title={title || 'Open image details'}>{element}</button>
    : <div className={`analysis-image ${className}`}>{element}</div>;
}

export function KpiGrid({ kpis, engagement }) {
  const icons = ['trend', 'heart', 'palette', 'tag'];
  const secondary = [
    'AI analyzed posts in this selection',
    'AI classified design slides observed',
    'Distinct color labels on design slides',
    'Distinct tags across six categories',
  ];
  return (
    <section className="kpi-grid" aria-label="Dashboard key metrics">
      {kpis.map((kpi, index) => (
        <article className="kpi-card" key={kpi.id} title={kpi.definition}>
          <span className={`kpi-icon kpi-icon--${index}`}><Icon name={icons[index]} size={25} strokeWidth={1.8} /></span>
          <div className="kpi-copy">
            <div className="kpi-label">{index === 1 ? 'Observed Design Slides' : index === 2 ? 'Observed Colors' : index === 3 ? 'Classified Tag Types' : kpi.label}</div>
            <div className="kpi-value-row"><strong>{Number(kpi.value).toLocaleString('en-US')}</strong><span className="kpi-unit">{kpi.unit}</span></div>
            <p>{secondary[index]}</p>
          </div>
          {index === 0 && (
            <div className="kpi-engagement" title="Per-post source engagement metrics are omitted from this public view">
              <span>Engagement</span>
              <strong>{engagement.simpleMeanPct == null ? 'Not published' : `${engagement.simpleMeanPct.toFixed(2)}%`}</strong>
              <small>{engagement.simpleMeanPct == null ? 'Source metric omitted' : `n=${engagement.simpleMeanSampleSize}/${engagement.simpleMeanEligiblePostCount}`}</small>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

export function MostObservedDesigns({ model, onSelect, onViewAll }) {
  const cards = model.cards;
  return (
    <section className="panel designs-panel" id="most-observed-designs" aria-labelledby="designs-title">
      <div className="panel-heading">
        <div className="panel-title-group"><Icon name="heart" className="section-icon section-icon--coral" size={18} /><h2 id="designs-title">Most Observed Designs</h2></div>
        <button type="button" className="text-action" onClick={onViewAll}>View All <Icon name="arrow" size={15} /></button>
      </div>
      {cards.length ? (
        <>
          <div className="design-cards">
            {cards.map((card, index) => (
              <button className="design-card" key={card.key} type="button" onClick={() => onSelect(card)} aria-label={`Open observed design ${card.title}`}>
                <span className="design-image-wrap">
                  <AnalysisImage image={card.representativeImage} alt={`${card.title}, observed nail design`} className="design-image" />
                  <span className="observed-count"><Icon name="heart" size={12} /> {card.observedSlideCount}×</span>
                  <span className="design-rank">{String(index + 1).padStart(2, '0')}</span>
                </span>
                <span className="design-name" title={card.title}>{card.title}</span>
                <span className="design-tags">
                  {card.tags.slice(0, 2).map((tag) => <span className="tag-chip" key={`${tag.category}:${tag.value}`}>#{tag.value}</span>)}
                  {card.tags.length > 2 && <span className="tag-chip tag-chip--more">+{card.tags.length - 2}</span>}
                </span>
              </button>
            ))}
          </div>
          <p className="panel-footnote">Ranked by observed combination frequency · {model.eligibleSlideCount} eligible design slides · ties sorted alphabetically</p>
        </>
      ) : <div className="panel-empty">No matched design combinations in this selection.</div>}
    </section>
  );
}

export function CombinationTrends({ model, onViewDetails }) {
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  let consumed = 0;
  const topFivePercent = model.denominator
    ? model.slices.filter((slice) => slice.key !== 'other').reduce((sum, slice) => sum + slice.percentage, 0)
    : 0;
  const segments = model.slices.map((slice, index) => {
    const dash = Math.max(0, (slice.percentage / 100) * circumference - 1.5);
    const item = { ...slice, color: DONUT_COLORS[index % DONUT_COLORS.length], dash, offset: -(consumed / 100) * circumference };
    consumed += slice.percentage;
    return item;
  });
  return (
    <section className="panel combination-panel" id="combination-trends" aria-labelledby="combination-title">
      <div className="panel-heading">
        <div className="panel-title-group"><Icon name="trend" className="section-icon section-icon--rose" size={19} /><h2 id="combination-title">Design Combination Trends</h2></div>
        <button type="button" className="text-action" onClick={onViewDetails}>View Details <Icon name="arrow" size={15} /></button>
      </div>
      <div className="combination-content">
        <div className="donut-wrap">
          <svg viewBox="0 0 180 180" role="img" aria-label={`Top five observed combinations account for ${topFivePercent.toFixed(1)} percent of ${model.denominator} eligible design slides`}>
            <circle cx="90" cy="90" r={radius} fill="none" stroke="#eee4dd" strokeWidth="23" />
            {segments.map((segment) => <circle key={segment.key} cx="90" cy="90" r={radius} fill="none" stroke={segment.color} strokeWidth="23" strokeDasharray={`${segment.dash} ${circumference - segment.dash}`} strokeDashoffset={segment.offset} transform="rotate(-90 90 90)" />)}
          </svg>
          <div className="donut-center"><small>Top 5 share</small><strong>{model.denominator ? `${topFivePercent.toFixed(1)}%` : '—'}</strong><span>of eligible</span></div>
        </div>
        <div className="combination-legend" aria-label="Combination frequency legend">
          {segments.length ? segments.map((item) => (
            <div className="combination-legend-row" key={item.key} title={`${item.count} of ${item.denominator} eligible slides`}>
              <i style={{ background: item.color }} />
              <span>{item.label}</span>
              <strong>{item.percentage.toFixed(1)}%</strong>
            </div>
          )) : <span className="legend-empty">No combinations</span>}
        </div>
        <DecorativePlaceholder slot={model.decorativeImageSlot} className="signature-placeholder" />
      </div>
      <p className="panel-footnote">Denominator: {model.denominator} eligible slides. {model.unclassifiedDesignSlideCount} of {model.designSlideCount} design slides lack two classified combination dimensions.</p>
    </section>
  );
}

function CompactDate({ value }) {
  if (!value) return '—';
  return formatDisplayDate(value, { year: false });
}

function TagCell({ items, className = '' }) {
  if (!items?.length) return <span className="muted-dash">—</span>;
  return <div className={`table-chips ${className}`} title={items.map((item) => typeof item === 'string' ? item : item.value).join(', ')}>
    {items.slice(0, 2).map((item) => {
      const label = typeof item === 'string' ? item : item.label || item.value;
      return <span className="tag-chip" key={label}>#{label}</span>;
    })}
    {items.length > 2 && <span className="tag-chip tag-chip--more">+{items.length - 2}</span>}
  </div>;
}

export function PostsTable({ model, rows, selectedIds, onSelectionChange, onOpenPost, onSort, tableFilters, onTableFiltersChange, onExcelDownload, downloadState }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { designOnly, analysisOnly } = tableFilters;
  const visibleRows = useMemo(() => rows.filter((row) => (!designOnly || row.isDesignPost === true)
    && (!analysisOnly || row.slideCount > 0)), [rows, designOnly, analysisOnly]);
  const selectedVisibleCount = visibleRows.filter((row) => selectedIds.has(row.postId)).length;
  const toggleAll = () => {
    if (selectedVisibleCount === visibleRows.length && visibleRows.length > 0) {
      onSelectionChange(new Set([...selectedIds].filter((id) => !visibleRows.some((row) => row.postId === id))));
    } else {
      onSelectionChange(new Set([...selectedIds, ...visibleRows.map((row) => row.postId)]));
    }
  };
  const toggleOne = (postId) => {
    const next = new Set(selectedIds);
    if (next.has(postId)) next.delete(postId); else next.add(postId);
    onSelectionChange(next);
  };
  const sortButton = (label, key) => <button type="button" className="sort-button" onClick={() => onSort(key)}>{label}<span aria-hidden="true">↕</span></button>;

  return (
    <section className="panel posts-panel" id="analyzed-posts" aria-labelledby="posts-title">
      <div className="panel-heading posts-heading">
        <div className="panel-title-group"><Icon name="message" className="section-icon section-icon--outline" size={18} /><h2 id="posts-title">Analyzed Posts</h2><span className="row-count">{visibleRows.length} {model.meta.publicView ? 'observations' : 'posts'}</span></div>
        <div className="posts-actions">
          {selectedIds.size > 0 && <span className="selection-count">{selectedIds.size} selected</span>}
          <button className="button button--primary button--small" type="button" disabled={downloadState.pending} onClick={onExcelDownload} title="Downloads five worksheets for the current search, date range, table filters, and sort order"><Icon name="download" size={14} /> {downloadState.pending ? 'Preparing…' : 'Excel Download'}</button>
          <div className="filter-anchor">
            <button className={`button button--quiet button--small ${filtersOpen ? 'is-open' : ''}`} type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><Icon name="filter" size={15} /> Filter</button>
            {filtersOpen && <div className="filter-popover" role="group" aria-label="Table filters">
              <strong>Table filters</strong>
              <label><input type="checkbox" checked={designOnly} onChange={(event) => onTableFiltersChange((current) => ({ ...current, designOnly: event.target.checked }))} /> Design posts only</label>
              <label><input type="checkbox" checked={analysisOnly} onChange={(event) => onTableFiltersChange((current) => ({ ...current, analysisOnly: event.target.checked }))} /> AI slide analysis available</label>
              <button type="button" className="filter-clear" onClick={() => onTableFiltersChange({ designOnly: false, analysisOnly: false })}>Clear filters</button>
            </div>}
          </div>
        </div>
      </div>
      <div className="posts-table-scroll" tabIndex="0" aria-label="Analyzed posts table; scroll to see all rows">
        <table className="posts-table">
          <colgroup><col className="col-select" /><col className="col-date" /><col className="col-platform" /><col className="col-image" /><col className="col-caption" /><col className="col-colors" /><col className="col-tags" /><col className="col-engagement" /><col className="col-details" /></colgroup>
          <thead><tr>
            <th><input type="checkbox" aria-label="Select all visible posts" checked={visibleRows.length > 0 && selectedVisibleCount === visibleRows.length} onChange={toggleAll} /></th>
            <th>{sortButton('Date', 'publishedAt')}</th><th>Platform</th><th>Post Image</th><th>Observation / Keywords</th><th>Detected Colors</th><th>Tags</th><th>Engagement</th><th><span className="sr-only">Details</span></th>
          </tr></thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.postId} className={selectedIds.has(row.postId) ? 'is-selected' : ''}>
                <td><input type="checkbox" aria-label={`Select post from ${row.publishedAt ? formatDisplayDate(row.publishedAt) : 'unknown date'}`} checked={selectedIds.has(row.postId)} onChange={() => toggleOne(row.postId)} /></td>
                <td className="table-date"><time dateTime={row.publishedAt || undefined}>{CompactDate({ value: row.publishedAt })}</time></td>
                <td><span className={row.platform ? 'platform-verified' : 'platform-unavailable'} title={row.platform ? 'Platform label derived from a verified Instagram route; the source link is omitted' : 'No validated platform permalink is present'}>{row.platform || '—'}</span></td>
                <td><AnalysisImage image={row.thumbnail} className="post-thumbnail" alt="Open analyzed post details" onClick={() => onOpenPost(row.postId)} /></td>
                <td className="caption-cell"><span title={row.caption ? 'Source caption' : 'Anonymous observation; source caption omitted'}>{row.caption?.trim() || row.recordLabel || 'Observation'}</span><small>{row.keywords.slice(0, 2).map((tag) => `#${tag.value}`).join('  ') || 'No classified keywords'}</small></td>
                <td><TagCell items={row.detectedColors.map((color) => color.label)} className="color-chips" /></td>
                <td><TagCell items={row.tags} /></td>
                <td className="engagement-cell"><span className="reaction-line">Not published</span><small>Omitted from public view</small></td>
                <td><button type="button" className="icon-button row-detail-button" aria-label="Open post analysis details" onClick={() => onOpenPost(row.postId)}>···</button></td>
              </tr>
            ))}
            {!visibleRows.length && <tr><td colSpan="9"><div className="table-empty"><Icon name="search" size={18} />No posts match the current selection.</div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-footer"><span>Showing {visibleRows.length} of {model.totalRows} observations · scroll for more</span><span>{model.meta.publicView ? 'Matched images shown; source text and engagement omitted' : 'Missing metrics remain blank'}</span></div>
      {downloadState.message && <div className="export-status" role="status" aria-live="polite">{downloadState.message}</div>}
    </section>
  );
}

export function DetailsDialog({ selection, posts, slides, onClose, publicView = false }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const dialogRef = useRef(null);
  const post = selection?.type === 'post' && selection.postId ? posts.find((item) => item.postId === selection.postId) : null;
  const postSlides = useMemo(() => post ? slides.filter((slide) => slide.postId === post.postId)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0)) : [], [post, slides]);
  const activeSlide = postSlides.find((slide) => slide.index === activeIndex) || postSlides[0] || null;
  const designCard = selection?.card || null;

  useEffect(() => {
    if (selection) dialogRef.current?.focus();
  }, [selection]);

  if (!selection) return null;
  const viewedSlide = post ? activeSlide : selection.slide || null;
  const title = post ? 'Observation analysis' : designCard ? 'Observed design detail' : 'Analysis detail';
  const evidence = viewedSlide?.visualEvidence;
  const categories = ['color', 'technique', 'texture', 'motif', 'season', 'use'];
  const aggregatedPostTags = postSlides.length
    ? Object.fromEntries(categories.map((category) => [category, [...new Set(postSlides.flatMap((slide) => slide.tags?.[category] || []))]]))
    : null;
  const tags = publicView && post ? aggregatedPostTags : viewedSlide?.tags || aggregatedPostTags
    || (designCard ? Object.fromEntries(categories.map((category) => [category, designCard.tags.filter((tag) => tag.category === category).map((tag) => tag.value)])) : null);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-dialog-title" tabIndex="-1">
        <header className="dialog-header"><div><span className="dialog-kicker">OHORA · DATA DETAIL</span><h2 id="detail-dialog-title">{title}</h2></div><button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Close detail dialog"><Icon name="close" /></button></header>
        <div className="dialog-body">
          <div className="dialog-media-column">
            {viewedSlide?.imageUrl
              ? <AnalysisImage image={{ src: viewedSlide.imageUrl }} className="dialog-main-image" alt="Selected analyzed nail design" />
              : <div className="dialog-image-empty"><Icon name="camera" size={25} /><span>{publicView ? 'No approved matched image is available for this slide.' : 'No matched analysis image for this selection.'}</span></div>}
            {postSlides.length > 1 && postSlides.some((slide) => slide.imageUrl) && <div className="dialog-slide-strip" aria-label="Carousel analyzed slides">
              {postSlides.map((slide) => <button type="button" key={slide.key} className={activeSlide?.key === slide.key ? 'slide-picker is-active' : 'slide-picker'} onClick={() => setActiveIndex(slide.index)} aria-label={`Show slide ${slide.index}`}>
                <img src={slide.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /><span>{slide.index}</span>
              </button>)}
            </div>}
          </div>
          <div className="dialog-details">
            {post && <>
              <div className="detail-meta-row"><span>Date</span><strong>{formatDisplayDate(post.publishedAt, { year: true })}</strong></div>
              <div className="detail-meta-row"><span>Design classification</span><strong>{(viewedSlide?.isDesignPost ?? post.isDesignPost) == null ? 'Unclassified' : (viewedSlide?.isDesignPost ?? post.isDesignPost) ? 'Design slide' : 'Non-design slide'}</strong></div>
              <div className="detail-meta-row"><span>Slide</span><strong>{viewedSlide?.index ?? '—'} / {postSlides.length}</strong></div>
              <div className="detail-caption">{post.caption || (publicView ? 'Source caption is omitted from this public view.' : 'Caption unavailable')}</div>
              {publicView
                ? <div className="detail-meta-row"><span>Engagement metrics</span><strong>Not published</strong></div>
                : <><div className="detail-meta-row"><span>Likes / comments</span><strong>{post.likes == null ? '—' : post.likes.toLocaleString()} / {post.comments == null ? '—' : post.comments.toLocaleString()}</strong></div><div className="detail-meta-row"><span>Engagement</span><strong>{post.engagementRatePct == null ? '—' : `${post.engagementRatePct.toFixed(2)}%`}</strong></div></>}
            </>}
            {designCard && <>
              <div className="detail-meta-row"><span>Observed rank</span><strong>#{designCard.rank}</strong></div>
              <div className="detail-meta-row"><span>Observed slides</span><strong>{designCard.observedSlideCount} / {designCard.support.denominator} eligible</strong></div>
              <p className="detail-copy">Ranked by exact observed combination frequency in the selected date range. This is not a growth or popularity comparison.</p>
            </>}
            <div className="detail-tags-block"><h3>AI tags</h3>
              {tags && Object.values(tags).some((values) => values.length > 0) ? Object.entries(tags).map(([category, values]) => values.length > 0 && <div className="detail-tag-row" key={category}><span>{category}</span><div>{values.map((value) => <span className="tag-chip" key={value}>{value}</span>)}</div></div>) : <p className="muted-dash">No slide tag details for this selection.</p>}
            </div>
            {evidence && <div className="detail-evidence"><h3>Visual evidence</h3><p>{evidence.description || 'No text evidence supplied.'}</p><div>{evidence.backgroundColor && <span>Background · {evidence.backgroundColor}</span>}{evidence.handCount != null && <span>Hands · {evidence.handCount}</span>}{evidence.nailsVisible != null && <span>Nails visible · {evidence.nailsVisible ? 'Yes' : 'No'}</span>}</div></div>}
            {post && (publicView ? <p className="muted-dash">Original post links are omitted from this public view.</p> : post.permalink ? <a className="button button--primary dialog-link" href={post.permalink} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open original post <Icon name="arrow" size={15} /></a> : <p className="muted-dash">Original post link is unavailable.</p>)}
          </div>
        </div>
      </section>
    </div>
  );
}

export function RankedCombinationsDialog({ combinations, onClose, onSelect }) {
  if (!combinations) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="ranked-dialog" role="dialog" aria-modal="true" aria-labelledby="ranked-dialog-title">
        <header className="dialog-header"><div><span className="dialog-kicker">OBSERVED FREQUENCY · NO GROWTH CLAIM</span><h2 id="ranked-dialog-title">Most observed combinations</h2></div><button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Close combinations"><Icon name="close" /></button></header>
        <p className="ranked-dialog-note">{combinations.length} distinct combinations · ties use alphabetical order · low counts are descriptive only.</p>
        <ol className="ranked-list">{combinations.map((item) => <li key={item.key}><button type="button" onClick={() => { onSelect(item); onClose(); }}><span className="ranked-number">{String(item.rank).padStart(2, '0')}</span><span className="ranked-name">{item.title}</span><span className="ranked-count">{item.observedSlideCount} slides</span></button></li>)}</ol>
      </section>
    </div>
  );
}
