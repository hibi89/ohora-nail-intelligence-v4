import { useMemo, useState } from 'react';
import { formatDateRange } from '../utils/dateFormat.js';
import { Icon } from './Icon.jsx';

const chartLeft = 42;
const chartRight = 445;
const chartTop = 15;
const chartBottom = 142;

function dayNumber(value) {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

function TrendChart({ overview }) {
  const [activeDate, setActiveDate] = useState(null);
  const points = overview.trend.points;
  const geometry = useMemo(() => {
    if (!points.length) return null;
    const days = points.map((point) => dayNumber(point.date));
    const minDay = Math.min(...days);
    const maxDay = Math.max(...days);
    const xFor = (point) => points.length === 1 || maxDay === minDay
      ? (chartLeft + chartRight) / 2
      : chartLeft + ((dayNumber(point.date) - minDay) / (maxDay - minDay)) * (chartRight - chartLeft);
    const maxMentions = Math.max(1, ...points.map((point) => point.tagMentionCount));
    const engagementValues = points.map((point) => point.engagementMeanPct).filter((value) => value != null);
    const maxEngagement = Math.max(0.1, ...engagementValues);
    const yMentions = (value) => chartBottom - (value / maxMentions) * (chartBottom - chartTop - 8);
    const yEngagement = (value) => chartBottom - (value / maxEngagement) * (chartBottom - chartTop - 8);
    const engagementSegments = [];
    let segment = [];
    let previousDay = null;
    points.forEach((point) => {
      const currentDay = dayNumber(point.date);
      if (point.engagementMeanPct == null || (previousDay != null && currentDay - previousDay !== 1)) {
        if (segment.length > 1) engagementSegments.push(segment);
        segment = [];
      }
      if (point.engagementMeanPct != null) segment.push({ point, x: xFor(point), y: yEngagement(point.engagementMeanPct) });
      previousDay = currentDay;
    });
    if (segment.length > 1) engagementSegments.push(segment);
    return { xFor, yMentions, yEngagement, maxMentions, maxEngagement, engagementSegments, days, minDay, maxDay };
  }, [points]);

  if (!points.length || !geometry) {
    return <div className="chart-empty"><Icon name="chart" size={22} /><span>No observations in this selection.</span></div>;
  }

  const activePoint = points.find((point) => point.date === activeDate) || null;
  const barWidth = Math.max(7, Math.min(18, (chartRight - chartLeft) / Math.max(1, points.length) * 0.36));
  const yTicks = [0, 0.5, 1];

  return (
    <div className="trend-chart-wrap">
      {activePoint && (
        <div className="chart-tooltip" role="status">
          <strong>{activePoint.date}</strong>
          <span><i className="legend-dot legend-dot--rose" />AI tag mentions · {activePoint.tagMentionCount}</span>
          <span><i className="legend-dot legend-dot--cocoa" />Mean engagement · {activePoint.engagementMeanPct == null ? '—' : `${activePoint.engagementMeanPct.toFixed(2)}%`} ({activePoint.engagementSampleSize} posts)</span>
        </div>
      )}
      <svg className="trend-chart" viewBox="0 0 460 170" role="img" aria-label="Observed AI tag mentions and mean post engagement by observed Seoul calendar date">
        {yTicks.map((ratio) => {
          const y = chartBottom - ratio * (chartBottom - chartTop - 8);
          return <g key={ratio}><line x1={chartLeft} x2={chartRight} y1={y} y2={y} className="chart-gridline" /><text x="34" y={y + 4} textAnchor="end" className="chart-axis-label">{Math.round(geometry.maxMentions * ratio)}</text><text x="452" y={y + 4} textAnchor="start" className="chart-axis-label">{(geometry.maxEngagement * ratio).toFixed(ratio === 0 ? 0 : 1)}%</text></g>;
        })}
        {points.map((point) => {
          const x = geometry.xFor(point);
          const y = geometry.yMentions(point.tagMentionCount);
          return <rect key={`bar-${point.date}`} x={x - barWidth / 2} y={y} width={barWidth} height={chartBottom - y} rx="4" className="chart-mention-bar" onMouseEnter={() => setActiveDate(point.date)} onMouseLeave={() => setActiveDate(null)}><title>{`${point.date}: ${point.tagMentionCount} AI tag mentions`}</title></rect>;
        })}
        {geometry.engagementSegments.map((segment, index) => <polyline key={`engagement-${index}`} points={segment.map(({ x, y }) => `${x},${y}`).join(' ')} className="chart-engagement-line" />)}
        {points.filter((point) => point.engagementMeanPct != null).map((point) => {
          const x = geometry.xFor(point);
          const y = geometry.yEngagement(point.engagementMeanPct);
          return <circle key={`engagement-point-${point.date}`} cx={x} cy={y} r="3.7" className="chart-engagement-point" onMouseEnter={() => setActiveDate(point.date)} onMouseLeave={() => setActiveDate(null)}><title>{`${point.date}: ${point.engagementMeanPct.toFixed(2)}%, n=${point.engagementSampleSize}`}</title></circle>;
        })}
        {points.map((point) => <text key={`label-${point.date}`} x={geometry.xFor(point)} y="163" textAnchor="middle" className="chart-date-label">{point.date.slice(5).replace('-', '/')}</text>)}
      </svg>
    </div>
  );
}

function ColorDistribution({ overview }) {
  const items = overview.colorDistribution;
  const max = Math.max(1, ...items.map((item) => item.count));
  if (!items.length) return <div className="chart-empty">No color labels in this selection.</div>;
  return (
    <div className="distribution-list" aria-label="Color label occurrences">
      {items.map((item, index) => (
        <div className="distribution-row" key={item.label}>
          <span className="distribution-rank">{String(index + 1).padStart(2, '0')}</span>
          <span className="distribution-label" title={item.label}>{item.label}</span>
          <span className="distribution-track"><span style={{ width: `${(item.count / max) * 100}%` }} /></span>
          <strong>{item.count}</strong>
        </div>
      ))}
    </div>
  );
}

function TagCoverage({ overview }) {
  const rows = Object.entries(overview.tagCoverage);
  if (!rows.length || rows.every(([, item]) => !item.totalSlideCount)) {
    return <div className="chart-empty">No analyzed slides in this selection.</div>;
  }
  return (
    <div className="coverage-list">
      {rows.map(([category, item]) => (
        <div className="coverage-row" key={category}>
          <span className="coverage-label">{category}</span>
          <span className="coverage-track"><span style={{ width: `${item.coverageRate * 100}%` }} /></span>
          <strong>{(item.coverageRate * 100).toFixed(0)}%</strong>
          <small>{item.filledSlideCount}/{item.totalSlideCount} slides</small>
        </div>
      ))}
    </div>
  );
}

const TAB_CONTENT = {
  'trend-analysis': TrendChart,
  'color-distribution': ColorDistribution,
  'tag-coverage': TagCoverage,
};

export function AnalysisOverview({ overview, onTabChange }) {
  const Panel = TAB_CONTENT[overview.activeTab] || TrendChart;
  return (
    <section className="panel overview-panel" id="analysis-overview" aria-labelledby="overview-title">
      <div className="panel-heading overview-heading">
        <div className="panel-title-group">
          <Icon name="chart" className="section-icon section-icon--rose" size={19} />
          <h2 id="overview-title">Analysis Overview</h2>
        </div>
        <span className="overview-range">{formatDateRange(overview.dateRange)}</span>
      </div>
      <div className="overview-tabs" role="tablist" aria-label="Analysis overview">
        {overview.tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={overview.activeTab === tab.id}
            aria-controls="overview-tab-panel"
            className={overview.activeTab === tab.id ? 'overview-tab is-active' : 'overview-tab'}
            onClick={() => onTabChange(tab.id)}
          >{tab.label}</button>
        ))}
      </div>
      <div id="overview-tab-panel" className="overview-tab-panel" role="tabpanel" aria-labelledby={`tab-${overview.activeTab}`}>
        {overview.activeTab === 'trend-analysis' && (
          <div className="chart-legend">
            <span><i className="legend-dot legend-dot--rose" />AI tag mentions</span>
            <span><i className="legend-dot legend-dot--cocoa" />Mean engagement</span>
          </div>
        )}
        <Panel overview={overview} />
        <p className="overview-footnote">Observed dates only · {overview.trend.points.length} date buckets · Asia/Seoul</p>
      </div>
    </section>
  );
}
