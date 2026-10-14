import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildDashboardViewModel } from './data/buildDashboardViewModel.js';
import { DISPLAY_TIME_ZONE, formatDateRange, subtractCalendarDays } from './utils/dateFormat.js';
import { fetchDashboardData } from './api/ohoraClient.js';
import { AnalysisOverview } from './components/AnalysisOverview.jsx';
import { CombinationTrends, DetailsDialog, KpiGrid, MostObservedDesigns, PostsTable, RankedCombinationsDialog } from './components/DataPanels.jsx';
import { DecorativePlaceholder } from './components/DecorativePlaceholder.jsx';
import { Icon } from './components/Icon.jsx';

const SIDEBAR_ICONS = {
  dashboard: 'home',
  'trend-analysis': 'trend',
  'design-analysis': 'diamond',
  'color-analysis': 'palette',
  'tag-analysis': 'tag',
  'social-monitoring': 'message',
  'saved-collections': 'heart',
};

const MENU_TARGETS = {
  dashboard: { section: null },
  'trend-analysis': { section: 'analysis-overview', tab: 'trend-analysis' },
  'design-analysis': { section: 'most-observed-designs' },
  'color-analysis': { section: 'analysis-overview', tab: 'color-distribution' },
  'tag-analysis': { section: 'analysis-overview', tab: 'tag-coverage' },
};

function LoadingScreen() {
  return <div className="state-page"><div className="loading-mark"><span className="loading-spark"><Icon name="sparkles" size={22} /></span><div><span className="eyebrow">OHORA · PRIVATE DATA</span><h1>Preparing your nail intelligence</h1><p>Validating the private analysis snapshot…</p></div><span className="loading-spinner" aria-label="Loading" /></div></div>;
}

function ErrorScreen({ message, code, authPending, authFeedback, onLogin, onRetry }) {
  if (code === 'auth-required') {
    return <div className="state-page"><section className="error-card auth-card" aria-labelledby="auth-title"><span className="error-icon"><Icon name="info" size={21} /></span><span className="eyebrow">AUTHORIZED ACCESS</span><h1 id="auth-title">OHORA Nail Intelligence</h1><p>Enter the access code shared with you to open the verified analysis dashboard.</p><form className="auth-form" onSubmit={(event) => { event.preventDefault(); onLogin(new FormData(event.currentTarget).get('accessCode')); }}><label htmlFor="access-code">Access code</label><input id="access-code" name="accessCode" type="password" autoComplete="current-password" required minLength={24} disabled={authPending} /><button type="submit" className="button button--primary" disabled={authPending}>{authPending ? 'Checking…' : 'Continue'}</button></form>{authFeedback && <p className="auth-feedback" role="status">{authFeedback}</p>}</section></div>;
  }
  return <div className="state-page"><section className="error-card" role="alert"><span className="error-icon"><Icon name="info" size={21} /></span><span className="eyebrow">ANALYSIS DATA UNAVAILABLE</span><h1>We couldn’t load the analysis</h1><p>{message}</p><p className="error-hint">The private dashboard service could not validate or load its analysis snapshot. Retry or contact the project owner.</p><button type="button" className="button button--primary" onClick={onRetry}>Try again</button></section></div>;
}

function SearchBox({ value, onChange }) {
  return <label className="search-box"><Icon name="search" size={18} /><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search nail designs, tags, or keywords…" aria-label="Search captions and all six tag dimensions" />{value && <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Clear search"><Icon name="close" size={14} /></button>}</label>;
}

function DateRangePopover({ range, fullRange, onApply, onClose }) {
  const [draft, setDraft] = useState({ from: range.from, to: range.to });
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const lastSeven = () => {
    const to = fullRange.to;
    onApply({ from: subtractCalendarDays(to, 6), to });
    onClose();
  };
  return (
    <div className="date-popover" role="dialog" aria-label="Choose observed date range">
      <div className="date-popover-title"><strong>Observed date range</strong><span>Asia/Seoul</span></div>
      <label>From<input type="date" min={fullRange.from || undefined} max={fullRange.to || undefined} value={draft.from || ''} onChange={(event) => update('from', event.target.value)} /></label>
      <label>To<input type="date" min={fullRange.from || undefined} max={fullRange.to || undefined} value={draft.to || ''} onChange={(event) => update('to', event.target.value)} /></label>
      {draft.from && draft.to && draft.from > draft.to && <p className="date-error" role="alert">Start date must be on or before the end date.</p>}
      <div className="date-popover-actions">
      <button type="button" className="date-text-button" onClick={lastSeven}>Last 7 calendar days in sample</button>
        <button type="button" className="date-text-button" onClick={() => { onApply(null); onClose(); }}>All observed dates</button>
      </div>
      <div className="date-footer"><button type="button" className="button button--quiet button--small" onClick={onClose}>Cancel</button><button type="button" className="button button--primary button--small" disabled={!draft.from || !draft.to || draft.from > draft.to} onClick={() => { onApply(draft); onClose(); }}>Apply range</button></div>
    </div>
  );
}

function TopBar({ search, onSearch, range, fullRange, onRangeChange, meta, warningCount, notificationOpen, setNotificationOpen, profileOpen, setProfileOpen }) {
  const [dateOpen, setDateOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('');
  useEffect(() => {
    if (!meta?.sourceUpdatedAt) return;
    const date = new Date(meta.sourceUpdatedAt);
    if (Number.isFinite(date.getTime())) {
      setUpdatedAt(new Intl.DateTimeFormat('en-US', { timeZone: DISPLAY_TIME_ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date));
    }
  }, [meta?.sourceUpdatedAt]);
  return (
    <header className="topbar">
      <SearchBox value={search} onChange={onSearch} />
      <div className="topbar-right">
        <span className={`header-data-status ${meta.stale || meta.demo ? 'is-warning' : ''}`} title={`${warningCount} data quality notices`}><i />{meta.stale ? 'Stale source' : meta.demo ? 'Demo data' : meta.hosted ? 'Authorized snapshot' : 'Local snapshot'} <small>{warningCount} notices</small></span>
        <div className="date-anchor">
          <button type="button" className="date-trigger" aria-expanded={dateOpen} onClick={() => setDateOpen(!dateOpen)}><Icon name="calendar" size={17} /><span>{formatDateRange(range)}</span><Icon name="chevron" size={14} /></button>
          {dateOpen && <DateRangePopover range={range} fullRange={fullRange} onApply={onRangeChange} onClose={() => setDateOpen(false)} />}
        </div>
        <div className="popover-anchor">
          <button type="button" className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationOpen} onClick={() => setNotificationOpen(!notificationOpen)}><Icon name="bell" size={19} /></button>
          {notificationOpen && <div className="small-popover notification-popover"><strong>Notifications</strong><p>No notification feed is available in this data source.</p></div>}
        </div>
        <div className="popover-anchor profile-anchor">
          <button type="button" className="profile-trigger" aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)}><span className="profile-avatar">OH</span><span className="profile-name">Workspace</span><Icon name="chevron" size={14} /></button>
          {profileOpen && <div className="small-popover profile-popover"><strong>{meta.hosted ? 'Authorized workspace' : 'Local workspace'}</strong><p>{updatedAt ? `Source updated ${updatedAt}` : 'Using the private analysis snapshot.'}</p><span className="local-only-pill">{meta.hosted ? 'SECURE ACCESS' : 'LOCAL ONLY'}</span></div>}
        </div>
      </div>
    </header>
  );
}

function Sidebar({ selectedItem, onNavigate }) {
  const menu = [
    ['dashboard', 'Dashboard', true],
    ['trend-analysis', 'Trend Analysis', true],
    ['design-analysis', 'Design Analysis', true],
    ['color-analysis', 'Color Analysis', true],
    ['tag-analysis', 'Tag Analysis', true],
    ['social-monitoring', 'Social Monitoring', false],
    ['saved-collections', 'Saved Collections', false],
  ];
  return (
    <aside className="sidebar">
      <button type="button" className="brand-lockup" onClick={() => onNavigate('dashboard')} aria-label="OHORA Nail Intelligence dashboard"><span>OHORA</span><small>Nail Intelligence</small></button>
      <nav className="side-nav" aria-label="Dashboard sections">
        {menu.map(([id, label, available]) => (
          <button key={id} type="button" className={`nav-item ${selectedItem === id ? 'is-active' : ''} ${available ? '' : 'is-upcoming'}`} aria-current={selectedItem === id ? 'page' : undefined} disabled={!available} title={available ? label : `${label} · coming soon`} onClick={() => onNavigate(id)}>
            <Icon name={SIDEBAR_ICONS[id]} size={19} /><span>{label}</span>{!available && <small>SOON</small>}
          </button>
        ))}
      </nav>
      <DecorativePlaceholder slot="sidebarStoryImage" className="sidebar-story" />
    </aside>
  );
}

function Hero({ viewModel }) {
  return (
    <div className="hero-grid" id="dashboard-top">
      <section className="hero-banner" aria-label="OHORA Nail Intelligence. Discover trends. Analyze designs. Turn inspiration into opportunity.">
        <DecorativePlaceholder slot={viewModel.hero.decorativeImageSlot} className="hero-art-placeholder" />
      </section>
      <section className="insight-card" aria-labelledby="insight-title">
        <DecorativePlaceholder slot={viewModel.hero.insight.decorativeImageSlot} className="insight-art-placeholder" />
        <div className="insight-copy"><div className="insight-heading"><Icon name="sparkles" size={19} /><h2 id="insight-title">Today's Insight</h2></div>
          {viewModel.hero.insight.candidate ? <><p>Most observed in this selection</p><strong className="insight-combination">{viewModel.hero.insight.candidate.label}</strong><span className="insight-support">{viewModel.hero.insight.candidate.count} of {viewModel.hero.insight.candidate.denominator} eligible design slides</span></> : <p className="insight-empty">No supported combination in this selection.</p>}
        </div>
      </section>
    </div>
  );
}

function CombinationMethodDialog({ model, onClose }) {
  if (!model) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="method-dialog" role="dialog" aria-modal="true" aria-labelledby="method-dialog-title">
        <header className="dialog-header"><div><span className="dialog-kicker">CURRENT FILTER · TRANSPARENT DENOMINATOR</span><h2 id="method-dialog-title">Combination trend basis</h2></div><button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Close method details"><Icon name="close" /></button></header>
        <div className="method-content"><p>Each design-classified slide with at least two populated dimensions among color, technique, and motif contributes one observed combination.</p><div className="method-stats"><div><strong>{model.denominator}</strong><span>eligible design slides</span></div><div><strong>{model.designSlideCount}</strong><span>design slides total</span></div><div><strong>{model.unclassifiedDesignSlideCount}</strong><span>without enough dimensions</span></div></div><p>The top five and Others use the eligible-slide denominator. Rankings describe frequency in the selected sample only; they do not show growth, market share, or popularity outside this dataset.</p></div>
      </section>
    </div>
  );
}

export function App() {
  const [loadState, setLoadState] = useState({ status: 'loading', data: null, message: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const [authPending, setAuthPending] = useState(false);
  const [authFeedback, setAuthFeedback] = useState('');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [selectedOverviewTab, setSelectedOverviewTab] = useState('trend-analysis');
  const [selectedSidebarItem, setSelectedSidebarItem] = useState('dashboard');
  const [tableSort, setTableSort] = useState({ key: 'publishedAt', direction: 'desc' });
  const [tableFilters, setTableFilters] = useState({ designOnly: false, imageOnly: false });
  const [downloadState, setDownloadState] = useState({ pending: false, message: '' });
  const [selectedPostIds, setSelectedPostIds] = useState(new Set());
  const [detailSelection, setDetailSelection] = useState(null);
  const [rankedOpen, setRankedOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({ status: 'loading', data: null, message: '' });
    fetchDashboardData(controller.signal).then((data) => {
      if (!controller.signal.aborted) setLoadState({ status: 'ready', data, message: '' });
    }).catch((error) => {
      if (!controller.signal.aborted) setLoadState({ status: 'error', data: null, code: error.code, message: error.message || 'The private snapshot could not be loaded.' });
    });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (!detailSelection && !rankedOpen && !methodOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (detailSelection) setDetailSelection(null);
      else if (rankedOpen) setRankedOpen(false);
      else if (methodOpen) setMethodOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [detailSelection, rankedOpen, methodOpen]);

  const snapshot = loadState.data;
  const fullRange = useMemo(() => snapshot
    ? buildDashboardViewModel(snapshot, { timeZone: DISPLAY_TIME_ZONE }).filters.dateRange
    : { from: null, to: null }, [snapshot]);
  const viewModel = useMemo(() => snapshot ? buildDashboardViewModel(snapshot, {
    dateRange,
    search,
    timeZone: DISPLAY_TIME_ZONE,
    selectedOverviewTab,
    selectedSidebarItem,
    tableSort,
  }) : null, [snapshot, dateRange, search, selectedOverviewTab, selectedSidebarItem, tableSort]);

  const navigate = useCallback((item) => {
    const target = MENU_TARGETS[item];
    if (!target) return;
    setSelectedSidebarItem(item);
    if (target.tab) setSelectedOverviewTab(target.tab);
    if (!target.section) window.scrollTo({ top: 0, behavior: 'smooth' });
    else document.getElementById(target.section)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const changeSort = (key) => {
    setTableSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
    setDownloadState((current) => ({ ...current, message: '' }));
  };
  const changeTableFilters = (nextFilters) => {
    setTableFilters(nextFilters);
    setDownloadState((current) => ({ ...current, message: '' }));
  };
  const changeSearch = (value) => {
    setSearch(value);
    setDownloadState((current) => ({ ...current, message: '' }));
  };

  const handleAccessLogin = async (password) => {
    setAuthPending(true);
    setAuthFeedback('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        let body = null;
        try { body = await response.json(); } catch { /* Keep the access message generic. */ }
        setAuthFeedback(body?.error?.message || 'Secure access could not be verified. Try again.');
        return;
      }
      setAuthFeedback('Access verified. Loading the analysis…');
      setReloadKey((value) => value + 1);
    } catch {
      setAuthFeedback('The secure access service could not be reached. Try again.');
    } finally {
      setAuthPending(false);
    }
  };

  if (loadState.status === 'loading') return <LoadingScreen />;
  if (loadState.status === 'error' || !viewModel) return <ErrorScreen message={loadState.message || 'The private data contract could not be prepared.'} code={loadState.code} authPending={authPending} authFeedback={authFeedback} onLogin={handleAccessLogin} onRetry={() => setReloadKey((value) => value + 1)} />;

  const slides = snapshot.slides;
  const openPost = (postId) => setDetailSelection({ type: 'post', postId });
  const openDesignCard = (card) => {
    const image = card.representativeImage;
    const slide = image ? slides.find((item) => item.postId === image.postId && item.index === image.slideIndex && item.matchStatus.startsWith('matched')) : null;
    setDetailSelection({ type: 'design', postId: image?.postId || null, slide: slide || null, card });
  };
  const filteredRanked = viewModel.trendingDesigns.rankedCombinations;
  const exportRows = viewModel.postsTable.rows.filter((row) => (!tableFilters.designOnly || row.isDesignPost === true)
    && (!tableFilters.imageOnly || Boolean(row.thumbnail?.src)));
  const handleExcelDownload = async () => {
    setDownloadState({ pending: true, message: '' });
    try {
      const { downloadFilteredWorkbook } = await import('./export/excelExport.js');
      await downloadFilteredWorkbook({
        snapshot,
        rows: exportRows,
        filters: { search, dateRange: viewModel.filters.dateRange, tableSort: viewModel.postsTable.sort, tableFilters },
        timeZone: DISPLAY_TIME_ZONE,
      });
      setDownloadState({ pending: false, message: `Excel file created for ${exportRows.length} filtered posts.` });
    } catch {
      setDownloadState({ pending: false, message: 'The Excel file could not be created. Please try again.' });
    }
  };

  return (
    <div className="app-shell">
      <Sidebar selectedItem={viewModel.sidebar.selectedItem} onNavigate={navigate} />
      <div className="workspace">
        <TopBar search={search} onSearch={changeSearch} range={viewModel.filters.dateRange} fullRange={fullRange} onRangeChange={(range) => { setDateRange(range); setSelectedPostIds(new Set()); setDownloadState((current) => ({ ...current, message: '' })); }} meta={viewModel.meta} warningCount={viewModel.warnings.length + (viewModel.meta.stale ? 1 : 0) + (viewModel.meta.demo ? 1 : 0)} notificationOpen={notificationOpen} setNotificationOpen={setNotificationOpen} profileOpen={profileOpen} setProfileOpen={setProfileOpen} />
        <main className="dashboard-main">
          <Hero viewModel={viewModel} />
          <KpiGrid kpis={viewModel.kpis} engagement={viewModel.engagement} />
          <div className="analysis-grid">
            <MostObservedDesigns model={viewModel.trendingDesigns} onSelect={openDesignCard} onViewAll={() => setRankedOpen(true)} />
            <CombinationTrends model={viewModel.combinationTrends} onViewDetails={() => setMethodOpen(true)} />
          </div>
          <div className="bottom-grid">
            <PostsTable model={viewModel.postsTable} rows={viewModel.postsTable.rows} selectedIds={selectedPostIds} onSelectionChange={setSelectedPostIds} onOpenPost={openPost} onSort={changeSort} tableFilters={tableFilters} onTableFiltersChange={changeTableFilters} onExcelDownload={handleExcelDownload} downloadState={downloadState} />
            <AnalysisOverview overview={viewModel.analysisOverview} onTabChange={setSelectedOverviewTab} />
          </div>
          <footer className="dashboard-footer"><span>OHORA Nail Intelligence · {viewModel.meta.hosted ? 'Authorized analysis snapshot' : 'Local analysis snapshot'}</span><span>Dates and filter boundaries use {DISPLAY_TIME_ZONE}</span></footer>
        </main>
      </div>
      <DetailsDialog selection={detailSelection} posts={snapshot.posts} slides={slides} onClose={() => setDetailSelection(null)} />
      {rankedOpen && <RankedCombinationsDialog combinations={filteredRanked} onClose={() => setRankedOpen(false)} onSelect={(item) => openDesignCard({ ...item, representativeImage: null })} />}
      {methodOpen && <CombinationMethodDialog model={viewModel.combinationTrends} onClose={() => setMethodOpen(false)} />}
    </div>
  );
}
