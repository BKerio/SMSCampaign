import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Coins, TriangleAlert } from 'lucide-react';
import { getSmsBalance } from '@/api/sms';
import AppLoader from '@/components/shared/AppLoader';

const REFRESH_MS = 5 * 60 * 1000; // gateway balance doesn't need to be near-realtime

/** Remaining SMS gateway credit, shown at the bottom of the sidebar nav so it's always in view while sending campaigns. Links through to the full /credits page. */
function SidebarCredits() {
  const { data, isLoading } = useQuery({
    queryKey: ['sms-balance'],
    queryFn: getSmsBalance,
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });

  return (
    <Link to="/credits" className="sidebar-credits">
      {isLoading ? (
        <div className="sidebar-credits-row" style={{ minHeight: 34, justifyContent: 'center' }}>
          <AppLoader size={24} label="Checking SMS credits" />
        </div>
      ) : !data?.enabled ? (
        <div className="sidebar-credits-row" title="Set the ADVANTA_* env vars to enable sending">
          <TriangleAlert size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span className="sidebar-credits-label" style={{ color: 'var(--amber)' }}>SMS gateway not configured</span>
        </div>
      ) : (
        <div className="sidebar-credits-row">
          <Coins size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <div className="col" style={{ gap: 1, minWidth: 0 }}>
            <span className="sidebar-credits-val">
              {data.credit !== null ? data.credit.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
            </span>
            <span className="sidebar-credits-label">SMS credits</span>
          </div>
        </div>
      )}
    </Link>
  );
}

export default SidebarCredits;
