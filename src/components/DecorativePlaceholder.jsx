import { getDecorativeAsset } from '../config/decorativeAssets.js';

export function DecorativePlaceholder({ slot, className = '', children }) {
  const asset = getDecorativeAsset(slot);
  const ready = asset?.status === 'ready' && Boolean(asset.src);
  return (
    <div
      className={`decorative-placeholder decorative-placeholder--${slot} ${className}`}
      data-slot-status={asset?.status || 'pending-generation'}
      role={ready || !children ? 'img' : undefined}
      aria-label={ready || !children ? asset?.alt || 'Editorial nail image' : undefined}
      title={`${asset?.fileName || 'Decorative image'} · ${asset?.status || 'pending-generation'}`}
    >
      {ready ? (
        <img className="decorative-asset-image" src={asset.src} alt="" aria-hidden="true" draggable="false" />
      ) : (
        <>
          <div className="placeholder-art" aria-hidden="true">
            <span className="art-hand" />
            <span className="art-nail art-nail--one" />
            <span className="art-nail art-nail--two" />
            <span className="art-nail art-nail--three" />
            <span className="art-pearl art-pearl--one" />
            <span className="art-pearl art-pearl--two" />
          </div>
          <span className="pending-label"><span /> Image pending</span>
          {children}
        </>
      )}
    </div>
  );
}
