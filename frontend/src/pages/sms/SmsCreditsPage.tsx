import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, RefreshCw, TriangleAlert, CheckCircle2, Send } from 'lucide-react';
import { getSmsBalance } from '@/api/sms';
import { listCampaigns } from '@/api/campaigns';
import { fmtDateTime } from '@/lib/datetime';
import PageLoader from '@/components/shared/PageLoader';

function SmsCreditsPage() {
  const queryClient = useQueryClient();

  const { data: balance, isLoading, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['sms-balance'],
    queryFn: getSmsBalance,
    refetchInterval: 5 * 60 * 1000,
  });

  // Reuses the same "recent campaigns" fetch OverviewDashboard uses, just to
  // total up how much of that balance has actually gone out recently.
  const { data: campaignsPage, isLoading: usageLoading } = useQuery({
    queryKey: ['campaigns', 'recent'],
    queryFn: () => listCampaigns({ page: 1, limit: 50 }),
  });

  const campaigns = campaignsPage?.data ?? [];
  const now = new Date();
  const thisMonth = campaigns.filter((c) => {
    const d = new Date(c.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const sentThisMonth = thisMonth.reduce((sum, c) => sum + c.sentCount, 0);
  const failedThisMonth = thisMonth.reduce((sum, c) => sum + c.failedCount, 0);

  return (
    <div className="col" style={{ gap: 20, maxWidth: 780 }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Sending</p>
          <h2 className="text-2xl font-bold mt-1" style={{ color: 'var(--ink)' }}>SMS Credits</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Your Advanta gateway balance and recent usage</p>
        </div>
        <button
          className="btn btn-soft btn-sm"
          disabled={isFetching}
          onClick={() => queryClient.invalidateQueries({ queryKey: ['sms-balance'] })}
        >
          <RefreshCw size={14} className={isFetching ? 'spin' : undefined} /> Refresh
        </button>
      </div>

      <div className="card card-pad">
        {isLoading ? (
          <PageLoader height={100} />
        ) : !balance?.enabled ? (
          <div className="flex items-start gap-3">
            <div className="stat-ico" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}><TriangleAlert /></div>
            <div>
              <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>SMS gateway not configured</p>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Set <code className="kbd">ADVANTA_SMS_URL</code>, <code className="kbd">ADVANTA_API_KEY</code>, <code className="kbd">ADVANTA_PARTNER_ID</code> and <code className="kbd">ADVANTA_SHORTCODE</code>
                {' '}in the backend environment to enable sending and see a live balance here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="stat-ico" style={{ background: 'var(--gold-soft)', color: 'var(--gold)' }}><Coins /></div>
              <div>
                <p className="stat-label">Remaining balance</p>
                <p className="stat-val" style={{ margin: '4px 0' }}>
                  {balance.credit !== null ? balance.credit.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                </p>
                <p className="stat-foot">
                  {balance.credit === null ? 'Could not reach the gateway - try refreshing.' : `SMS credit${balance.credit === 1 ? '' : 's'} left to send`}
                </p>
              </div>
            </div>
            <div className="col items-end" style={{ gap: 6 }}>
              <span className="pill pill-green"><CheckCircle2 size={12} /> Gateway configured</span>
              {balance.shortcode && <span className="tag-soft">Sender ID: {balance.shortcode}</span>}
              {dataUpdatedAt > 0 && <span className="text-xs" style={{ color: 'var(--muted)' }}>Updated {fmtDateTime(dataUpdatedAt)}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="flex items-center gap-2 mb-3">
          <Send size={16} style={{ color: 'var(--muted)' }} />
          <span className="section-title">This month's usage</span>
        </div>
        {usageLoading ? (
          <PageLoader height={60} />
        ) : (
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat">
              <div className="stat-label">Campaigns sent</div>
              <div className="stat-val">{thisMonth.length}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Messages delivered</div>
              <div className="stat-val" style={{ color: 'var(--green)' }}>{sentThisMonth}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Messages failed</div>
              <div className="stat-val" style={{ color: failedThisMonth > 0 ? 'var(--red)' : undefined }}>{failedThisMonth}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SmsCreditsPage;
