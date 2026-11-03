interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * Brand mark: a two-tone paper plane with speed dashes, drawn in
 * `currentColor`. public/favicon.svg uses the same paths on a filled tile -
 * keep the two in sync.
 */
function BrandMark({ size = 32, className }: BrandMarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 2 L2 10.5 L9.5 13.5 Z" />
      <path d="M22 2 L9.5 13.5 L13.5 21.5 Z" opacity=".72" />
      <path d="M9.5 13.5 L9.5 19.5 L12.4 16.4 Z" opacity=".45" />
      <rect x="1.6" y="15.2" width="4.6" height="1.7" rx=".85" transform="rotate(-24 3.9 16)" opacity=".6" />
      <rect x="3.4" y="19.2" width="3.4" height="1.7" rx=".85" transform="rotate(-24 5.1 20)" opacity=".4" />
    </svg>
  );
}

export default BrandMark;
