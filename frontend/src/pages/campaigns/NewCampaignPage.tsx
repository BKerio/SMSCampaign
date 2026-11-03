import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Users, Search, Megaphone, Tag, MessageSquareText, ListChecks } from 'lucide-react';
import AppLoader from '@/components/shared/AppLoader';
import FormModal, { ChoiceCards, ChoicePills, FieldLabel, FormSection } from '@/components/shared/FormModal';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { createCampaign, previewCampaign } from '@/api/campaigns';
import { listGroups } from '@/api/groups';
import { listMembers } from '@/api/members';
import type { CampaignAudience } from '@/types/api';
import PageLoader from '@/components/shared/PageLoader';

interface NavState {
  audience?: CampaignAudience;
  groupId?: string;
  groupName?: string;
  memberIds?: string[];
  memberNames?: string[];
}

interface PickedMember {
  id: string;
  name: string;
}

function NewCampaignPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  const user = useAuthStore((s) => s.user);
  const incoming = (location.state ?? {}) as NavState;

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<CampaignAudience>(incoming.audience ?? 'ALL_MEMBERS');
  const [groupId, setGroupId] = useState(incoming.groupId ?? '');
  // Pre-populated when arriving from "Members" with a bulk selection already
  // made there; otherwise the operator picks members right here via MemberPicker.
  const [selectedMembers, setSelectedMembers] = useState<PickedMember[]>(() => {
    const ids = incoming.memberIds ?? [];
    const names = incoming.memberNames ?? [];
    return ids.map((id, i) => ({ id, name: names[i] ?? id }));
  });
  const memberIds = useMemo(() => selectedMembers.map((m) => m.id), [selectedMembers]);

  const toggleMember = (m: PickedMember) => {
    setSelectedMembers((prev) => (prev.some((x) => x.id === m.id) ? prev.filter((x) => x.id !== m.id) : [...prev, m]));
  };

  const { data: groups = [] } = useQuery({ queryKey: ['groups'], queryFn: listGroups });

  const audienceValid = audience === 'ALL_MEMBERS' || (audience === 'GROUP' && !!groupId) || (audience === 'SELECTED' && memberIds.length > 0);

  const previewInput = useMemo(() => ({
    audience,
    groupId: audience === 'GROUP' ? groupId : undefined,
    memberIds: audience === 'SELECTED' ? memberIds : undefined,
    message: message.trim() || ' ',
  }), [audience, groupId, memberIds, message]);

  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ['campaigns', 'preview', previewInput],
    queryFn: () => previewCampaign(previewInput),
    enabled: audienceValid,
  });

  const sendMutation = useMutation({
    mutationFn: () => createCampaign({
      name,
      message,
      audience,
      groupId: audience === 'GROUP' ? groupId : undefined,
      memberIds: audience === 'SELECTED' ? memberIds : undefined,
    }),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      addNotification({ type: 'success', title: 'Campaign sending', message: `"${campaign.name}" is on its way to ${campaign.totalRecipients} recipient(s).` });
      navigate(`/campaigns/${campaign.id}`);
    },
    onError: (err: any) => addNotification({ type: 'error', title: 'Could not send campaign', message: err?.response?.data?.message || 'Please try again.' }),
  });

  const canSend = name.trim().length >= 2 && message.trim().length > 0 && audienceValid && !sendMutation.isPending;

  // Most operators type a generic "Dear member" greeting without knowing
  // about the {{name}} merge tag - so once they leave the field, silently
  // swap the standalone word "member" (not "members", the audience as a
  // whole) for the tag that actually gets personalized per recipient.
  // Skipped once {{name}} is already present, so it never fights manual edits.
  const handleMessageBlur = () => {
    setMessage((m) => (/\{\{\s*name\s*\}\}/i.test(m) ? m : m.replace(/\bmember\b/gi, '{{name}}')));
  };

  const groupOptions = groups.map((g) => ({
    value: g.id,
    label: g.name,
    sub: `${g._count.members} member${g._count.members === 1 ? '' : 's'}`,
  }));

  return (
    <div style={{ maxWidth: 820 }}>
      <FormModal
        variant="page"
        icon={Megaphone}
        title="New campaign"
        subtitle="Write a message and choose who receives it."
        steps={[
          { id: 'campaign', label: 'Campaign', done: name.trim().length >= 2 },
          { id: 'message', label: 'Message', done: message.trim().length > 0 },
          { id: 'audience', label: 'Audience', done: audienceValid },
          { id: 'review', label: 'Review', done: !!preview && preview.recipientCount > 0 && message.trim().length > 0 },
        ]}
        statusLabel="New campaign"
        statusDetail={name}
        submitLabel={`Send to ${preview?.recipientCount ?? 0}`}
        submittingLabel="Sending…"
        submitIcon={Send}
        submitDisabled={!canSend}
        submitting={sendMutation.isPending}
        onClose={() => navigate('/campaigns')}
        onSubmit={(e) => { e.preventDefault(); if (canSend) sendMutation.mutate(); }}
      >
        <FormSection id="campaign" icon={Tag} title="Campaign">
          <div className="field">
            <FieldLabel htmlFor="campaign-name" required>Campaign name</FieldLabel>
            <input id="campaign-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Harambee reminder - August" />
            <p className="fm-note">Only operators see this name - it isn't sent to members.</p>
          </div>
        </FormSection>

        <FormSection id="message" icon={MessageSquareText} title="Message">
          <div className="field">
            <FieldLabel
              htmlFor="campaign-message"
              required
              hint={preview ? `${preview.length} chars · ${preview.segments || 0} SMS (${preview.encoding})` : `${message.length} characters`}
            >
              Message
            </FieldLabel>
            <textarea
              id="campaign-message"
              className="eoc-textarea"
              style={{ minHeight: 140 }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onBlur={handleMessageBlur}
              placeholder="Hi {{name}}, …"
              maxLength={2000}
            />
            <p className="fm-note">
              Use <code className="kbd">{'{{name}}'}</code> to personalize with each recipient's name - typing "member" is turned into this automatically.
            </p>
            <p className="fm-note">
              Your position and name are added to the end of every message (e.g. "- Chairman, {user?.name ?? 'your name'}") - no need to type them.
            </p>
          </div>
        </FormSection>

        <FormSection id="audience" icon={Users} title="Audience">
          <div className="field">
            <FieldLabel required>Send to</FieldLabel>
            <ChoicePills
              label="Audience"
              value={audience}
              onChange={setAudience}
              options={[
                { value: 'ALL_MEMBERS', label: 'All members' },
                { value: 'GROUP', label: 'A group' },
                { value: 'SELECTED', label: `Selected members (${memberIds.length})` },
              ]}
            />
          </div>

          {audience === 'GROUP' && (
            <div className="field">
              <FieldLabel required>Group</FieldLabel>
              {groupOptions.length === 0 ? (
                <p className="fm-note">No groups yet - create one on the Groups page first.</p>
              ) : (
                <div className="fm-cards-scroll scroll-thin">
                  <ChoiceCards label="Group" columns={3} options={groupOptions} selected={groupId ? [groupId] : []} onToggle={setGroupId} />
                </div>
              )}
            </div>
          )}

          {audience === 'SELECTED' && (
            <div className="field">
              <FieldLabel required hint={`${memberIds.length} selected`}>Members</FieldLabel>
              <MemberPicker selected={selectedMembers} onToggle={toggleMember} />
            </div>
          )}
        </FormSection>

        <FormSection id="review" icon={ListChecks} title="Review">
          <div className="fm-summary">
            {previewLoading ? (
              <><AppLoader size={18} /> Calculating recipients…</>
            ) : preview ? (
              <span><b>{preview.recipientCount}</b> recipient{preview.recipientCount === 1 ? '' : 's'} will receive this message</span>
            ) : (
              <span style={{ color: 'var(--muted)' }}>Choose an audience and write a message to preview recipients.</span>
            )}
          </div>
          {preview && preview.recipientCount === 0 && !previewLoading && (
            <p className="fm-note" style={{ color: 'var(--red)' }}>No subscribed members match this audience.</p>
          )}
          {preview?.sample && preview.recipientCount > 0 && (
            <div className="field">
              <FieldLabel>Preview</FieldLabel>
              <p className="fm-note" style={{ color: 'var(--ink-2)', fontSize: 14, whiteSpace: 'pre-line' }}>"{preview.sample}"</p>
            </div>
          )}
        </FormSection>
      </FormModal>
    </div>
  );
}

/** Inline searchable member picker, so an operator can build a one-off recipient list without leaving the New Campaign form. */
function MemberPicker({ selected, onToggle }: { selected: PickedMember[]; onToggle: (m: PickedMember) => void }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['members', 'picker', search, page],
    queryFn: () => listMembers({ search: search || undefined, page, limit: 8 }),
  });
  const members = data?.data ?? [];
  const meta = data?.meta;
  const selectedIds = useMemo(() => new Set(selected.map((m) => m.id)), [selected]);

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="input-icon">
        <input
          className="input"
          placeholder="Search members by name or phone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <Search size={16} />
      </div>

      <div className="col scroll-thin" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', maxHeight: 230, overflowY: 'auto' }}>
        {isLoading ? (
          <PageLoader height={120} />
        ) : members.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)', padding: 16 }}>
            {search ? `No members match "${search}".` : 'No members yet - add some on the Members page first.'}
          </p>
        ) : (
          members.map((m, i) => (
            <label
              key={m.id}
              className="flex items-center gap-2"
              style={{ padding: '9px 12px', cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
            >
              <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => onToggle({ id: m.id, name: m.name })} />
              <span className="text-sm" style={{ color: 'var(--ink)' }}>{m.name}</span>
              <span className="text-xs mono" style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{m.phone}</span>
            </label>
          ))
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-soft btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <button type="button" className="btn btn-soft btn-sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="wrap-gap">
          {selected.map((m) => (
            <span key={m.id} className="tag-soft" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {m.name}
              <button
                type="button"
                onClick={() => onToggle(m)}
                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--muted)', padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default NewCampaignPage;
