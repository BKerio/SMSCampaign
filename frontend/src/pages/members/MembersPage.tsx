import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, UserPen, Upload, ChevronLeft as CaretLeft, ChevronRight as CaretRight,
  Pencil as PencilSimple, Trash2, Users, Send, Search, FileDown, FileSpreadsheet,
  IdCard, Mail, Phone, Layers, Plus, Check, ListChecks,
} from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';
import AppLoader from '@/components/shared/AppLoader';
import FormModal, { ChoiceCards, FieldLabel, FormSection } from '@/components/shared/FormModal';
import { confirmDialog } from '@/lib/alert';
import { createMember, deleteMember, importMembersFile, listAllMembers, listMembers, updateMember } from '@/api/members';
import { createGroup, listGroups } from '@/api/groups';
import type { Group, GroupRef, ImportResult, Member } from '@/types/api';
import { GROUP_POSITION_LABELS, positionLabel } from '@/types/api';
import PositionCards from '@/components/shared/PositionCards';
import PageLoader from '@/components/shared/PageLoader';

const memberSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(6, 'Enter a valid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  notes: z.string().optional(),
  position: z.enum(['CHAIRMAN', 'VICE_CHAIRMAN', 'SECRETARY', 'TREASURER', 'CATECHIST']).nullable(),
});
type MemberForm = z.infer<typeof memberSchema>;

function MembersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const { addNotification } = useNotificationStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['members', page, search, groupFilter],
    queryFn: () => listMembers({ page, limit: 20, search: search || undefined, groupId: groupFilter || undefined }),
  });
  const { data: groups = [] } = useQuery({ queryKey: ['groups'], queryFn: listGroups });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['members'] });

  const createMutation = useMutation({
    mutationFn: (values: MemberForm & { groupIds: string[] }) => createMember({ ...values, email: values.email || undefined }),
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      addNotification({ type: 'success', title: 'Member added', message: 'They can now be included in campaigns.' });
    },
    onError: (err: any) => addNotification({ type: 'error', title: 'Failed to add member', message: err?.response?.data?.message || 'Please try again.' }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: MemberForm & { groupIds: string[] } }) =>
      updateMember(id, { ...values, email: values.email || undefined }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      addNotification({ type: 'success', title: 'Member updated', message: 'Changes have been saved.' });
    },
    onError: (err: any) => addNotification({ type: 'error', title: 'Update failed', message: err?.response?.data?.message || 'Please try again.' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMember(id),
    onSuccess: () => {
      invalidate();
      addNotification({ type: 'success', title: 'Member removed', message: 'They will no longer receive campaigns.' });
    },
    onError: (err: any) => addNotification({ type: 'error', title: 'Delete failed', message: err?.response?.data?.message || 'Please try again.' }),
  });

  const handleDelete = async (member: Member) => {
    const confirmed = await confirmDialog({
      title: 'Remove member',
      text: `Remove ${member.name} (${member.phone})? This can't be undone.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (confirmed) deleteMutation.mutate(member.id);
  };

  const members = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20, totalPages: 0 };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startCampaignWithSelected = () => {
    const chosen = members.filter((m) => selected.has(m.id));
    navigate('/campaigns/new', { state: { audience: 'SELECTED', memberIds: chosen.map((m) => m.id), memberNames: chosen.map((m) => m.name) } });
  };

  // Exports every member matching the current search/group filter (not just
  // the current page) - the heavy libraries are dynamically imported so they
  // only ever load once someone actually clicks one of these buttons.
  const handleExport = async (kind: 'pdf' | 'excel') => {
    setExporting(kind);
    try {
      const all = await listAllMembers({ search: search || undefined, groupId: groupFilter || undefined });
      const groupName = groups.find((g) => g.id === groupFilter)?.name;
      if (kind === 'excel') {
        const { exportMembersToExcel } = await import('@/lib/exportMembersExcel');
        await exportMembersToExcel(all, groupName ? `_${groupName}` : '');
      } else {
        const { exportMembersToPdf } = await import('@/lib/exportMembersPdf');
        await exportMembersToPdf(all, { search: search || undefined, groupName });
      }
    } catch {
      addNotification({ type: 'error', title: 'Export failed', message: `Could not export members to ${kind === 'pdf' ? 'PDF' : 'Excel'}. Please try again.` });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">Audience</p>
          <h2 className="text-2xl font-bold mt-1" style={{ color: 'var(--ink)' }}>Members</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{meta.total} people onboarded</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-soft" disabled={exporting !== null} onClick={() => handleExport('excel')}>
            {exporting === 'excel' ? <AppLoader size={14} /> : <FileSpreadsheet size={16} />} Export Excel
          </button>
          <button className="btn btn-soft" disabled={exporting !== null} onClick={() => handleExport('pdf')}>
            {exporting === 'pdf' ? <AppLoader size={14} /> : <FileDown size={16} />} Export PDF
          </button>
          <button className="btn btn-soft" onClick={() => setImportOpen(true)}><Upload size={16} /> Import</button>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}><UserPlus size={16} /> Add Member</button>
        </div>
      </div>

      <div className="card card-pad flex flex-wrap items-end gap-3">
        <form
          className="field grow"
          style={{ minWidth: 220 }}
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}
        >
          <label className="label">Search</label>
          <div className="input-icon">
            <input className="input" placeholder="Name, phone or email…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            <Search size={16} />
          </div>
        </form>
        <div className="field" style={{ minWidth: 200 }}>
          <label className="label">Group</label>
          <select className="eoc-select" value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}>
            <option value="">All groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { setSearchInput(''); setSearch(''); setGroupFilter(''); setPage(1); }}>Reset</button>
      </div>

      {selected.size > 0 && (
        <div className="card card-pad flex items-center justify-between" style={{ background: 'var(--green-light)' }}>
          <span className="text-sm font-bold" style={{ color: 'var(--green)' }}>{selected.size} member(s) selected</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
            <button className="btn btn-primary btn-sm" onClick={startCampaignWithSelected}><Send size={14} /> New campaign</button>
          </div>
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <div className="card-pad"><PageLoader height={240} /></div>
        ) : members.length === 0 ? (
          <div className="card-pad flex flex-col items-center text-center" style={{ gap: 8, padding: '48px 20px' }}>
            <Users size={32} style={{ color: 'var(--red)' }} />
            <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>No members found</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={members.length > 0 && members.every((m) => selected.has(m.id))}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          members.forEach((m) => (e.target.checked ? next.add(m.id) : next.delete(m.id)));
                          return next;
                        });
                      }}
                    />
                  </th>
                  {['Name', 'Phone', 'Email', 'Position', 'Groups', 'Status', ''].map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td><input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelected(m.id)} /></td>
                    <td className="strong">{m.name}</td>
                    <td className="mono">{m.phone}</td>
                    <td>{m.email || '-'}</td>
                    <td>{m.position ? positionLabel(m.position) : '-'}</td>
                    <td>
                      <div className="wrap-gap" style={{ gap: 4 }}>
                        {m.groups.length === 0 ? <span className="tag-soft">-</span> : m.groups.map((g) => (
                          <span key={g.id} className="tag-soft">{g.name}{g.position ? ` · ${GROUP_POSITION_LABELS[g.position]}` : ''}</span>
                        ))}
                      </div>
                    </td>
                    <td><span className={`pill ${m.isSubscribed ? 'pill-green' : 'pill-gray'}`}>{m.isSubscribed ? 'Subscribed' : 'Opted out'}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="icon-btn" title="Edit" onClick={() => setEditing(m)}><PencilSimple size={14} /></button>
                      <button className="icon-btn" title="Remove" onClick={() => handleDelete(m)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between card-pad" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Page {meta.page} of {meta.totalPages} · {meta.total} members</span>
            <div className="flex gap-2">
              <button className="btn btn-soft btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><CaretLeft size={14} /></button>
              <button className="btn btn-soft btn-sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}><CaretRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {addOpen && (
        <MemberModal
          allGroups={groups}
          submitting={createMutation.isPending}
          onClose={() => setAddOpen(false)}
          onSubmit={async (values, groupIds) => { await createMutation.mutateAsync({ ...values, groupIds }); }}
        />
      )}

      {editing && (
        <MemberModal
          member={editing}
          allGroups={groups}
          submitting={editMutation.isPending}
          onClose={() => setEditing(null)}
          onSubmit={async (values, groupIds) => { await editMutation.mutateAsync({ id: editing.id, values: { ...values, groupIds } }); }}
        />
      )}

      {importOpen && (
        <ImportMembersModal
          onClose={() => setImportOpen(false)}
          onImported={() => { invalidate(); queryClient.invalidateQueries({ queryKey: ['groups'] }); }}
        />
      )}
    </div>
  );
}

function MemberModal({ member, allGroups, onClose, onSubmit, submitting }: {
  member?: Member;
  allGroups: Group[];
  onClose: () => void;
  onSubmit: (values: MemberForm, groupIds: string[]) => Promise<void> | void;
  submitting?: boolean;
}) {
  const [groupIds, setGroupIds] = useState<string[]>(member?.groups.map((g) => g.id) ?? []);
  // Groups created inline here, until the ['groups'] query refetches with them.
  const [createdGroups, setCreatedGroups] = useState<GroupRef[]>([]);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: member?.name ?? '', phone: member?.phone ?? '', email: member?.email ?? '', notes: member?.notes ?? '',
      position: member?.position ?? null,
    },
  });
  const [name = '', phone = '', email = '', notes = '', position = null] = watch(['name', 'phone', 'email', 'notes', 'position']);

  const groupOptions = [
    ...allGroups.map((g) => ({ value: g.id, label: g.name, sub: `${g._count.members} member${g._count.members === 1 ? '' : 's'}` })),
    ...createdGroups.filter((c) => !allGroups.some((g) => g.id === c.id)).map((g) => ({ value: g.id, label: g.name, sub: 'New group' })),
  ];

  const toggleGroup = (id: string) =>
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function addNewGroup() {
    const trimmed = newGroupName.trim();
    if (trimmed.length < 2) return;
    const existing = groupOptions.find((g) => g.label.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (!groupIds.includes(existing.value)) toggleGroup(existing.value);
    } else {
      setCreatingGroup(true);
      try {
        const g = await createGroup({ name: trimmed });
        queryClient.invalidateQueries({ queryKey: ['groups'] });
        setCreatedGroups((prev) => [...prev, { id: g.id, name: g.name }]);
        setGroupIds((prev) => [...prev, g.id]);
      } catch (err: any) {
        addNotification({ type: 'error', title: 'Could not create group', message: err?.response?.data?.message || 'Please try again.' });
        return;
      } finally {
        setCreatingGroup(false);
      }
    }
    setNewGroupName('');
    setNewGroupOpen(false);
  }

  const personalDone = memberSchema.shape.name.safeParse(name).success && memberSchema.shape.phone.safeParse(phone).success;
  const contactDone = (!!email || !!notes) && memberSchema.shape.email.safeParse(email).success;

  return (
    <FormModal
      icon={member ? UserPen : UserPlus}
      title={member ? 'Edit member' : 'Add a member'}
      subtitle={member ? 'Update this person’s details and groups.' : 'Add someone who will receive your SMS campaigns.'}
      steps={[
        { id: 'personal', label: 'Personal', done: personalDone },
        { id: 'contact', label: 'Contact', done: contactDone },
        { id: 'groups', label: 'Groups', done: groupIds.length > 0 },
      ]}
      statusLabel={member ? 'Editing member' : 'New member'}
      statusDetail={name}
      submitLabel={member ? 'Save changes' : 'Add member'}
      submitting={submitting}
      onClose={onClose}
      onSubmit={handleSubmit(async (v) => onSubmit(v, groupIds))}
    >
      <FormSection id="personal" icon={IdCard} title="Personal">
        <div className="fm-grid-2">
          <div className="field">
            <FieldLabel htmlFor="member-name" required>Full name</FieldLabel>
            <input id="member-name" className="input" placeholder="e.g. Jane Wanjiku" autoFocus {...register('name')} />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </div>
          <div className="field">
            <FieldLabel htmlFor="member-phone" required>Phone number</FieldLabel>
            <div className="input-icon">
              <input id="member-phone" className="input" type="tel" placeholder="0712 345 678" {...register('phone')} />
              <Phone size={16} />
            </div>
            {errors.phone && <span className="field-error">{errors.phone.message}</span>}
          </div>
        </div>
        <PositionCards value={position} onChange={(p) => setValue('position', p, { shouldDirty: true })} />
      </FormSection>

      <FormSection id="contact" icon={Mail} title="Contact">
        <div className="field">
          <FieldLabel htmlFor="member-email">Email</FieldLabel>
          <div className="input-icon">
            <input id="member-email" className="input" type="email" placeholder="e.g. jane@example.com" {...register('email')} />
            <Mail size={16} />
          </div>
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </div>
        <div className="field">
          <FieldLabel htmlFor="member-notes" hint={`${notes.length} characters`}>Notes</FieldLabel>
          <textarea id="member-notes" className="eoc-textarea" placeholder="e.g. Choir member, prefers Swahili messages" {...register('notes')} />
        </div>
      </FormSection>

      <FormSection id="groups" icon={Layers} title="Groups">
        <div className="field">
          <FieldLabel hint={`${groupIds.length} selected`}>Add to groups</FieldLabel>
          <div className="fm-cards-scroll scroll-thin">
            <ChoiceCards
              label="Groups"
              multiple
              options={groupOptions}
              selected={groupIds}
              onToggle={toggleGroup}
              extra={
                <button type="button" className="fm-card fm-card-new" onClick={() => setNewGroupOpen((o) => !o)} aria-expanded={newGroupOpen}>
                  <span className="fm-card-tile" aria-hidden="true">+</span>
                  <span className="fm-card-text"><b>New group</b></span>
                </button>
              }
            />
          </div>
        </div>
        {newGroupOpen && (
          <div className="fm-inline-add">
            <input
              className="input"
              placeholder="New group name, e.g. Youth choir"
              value={newGroupName}
              autoFocus
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewGroup(); } }}
              aria-label="New group name"
            />
            <button type="button" className="fm-btn fm-btn-ghost" disabled={creatingGroup || newGroupName.trim().length < 2} onClick={addNewGroup}>
              {creatingGroup ? <AppLoader size={16} /> : <Plus size={16} />} Create
            </button>
          </div>
        )}
      </FormSection>
    </FormModal>
  );
}

function ImportMembersModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { addNotification } = useNotificationStore();

  const importMutation = useMutation({
    mutationFn: (f: File) => importMembersFile(f),
    onSuccess: (data) => {
      setResult(data);
      onImported();
      addNotification({ type: 'success', title: 'Import complete', message: `${data.created} member(s) added.` });
    },
    onError: (err: any) => addNotification({ type: 'error', title: 'Import failed', message: err?.response?.data?.message || 'Please try again.' }),
  });

  return (
    <FormModal
      icon={Upload}
      title="Import members"
      subtitle="Bulk-add members from a spreadsheet."
      steps={[
        { id: 'file', label: 'File', done: !!file },
        { id: 'results', label: 'Results', done: !!result },
      ]}
      statusLabel="Import"
      statusDetail={file?.name ?? 'No file chosen'}
      submitLabel={result ? 'Done' : 'Import members'}
      submittingLabel="Importing…"
      submitIcon={result ? Check : Upload}
      submitDisabled={!file}
      submitting={importMutation.isPending}
      cancelLabel={result ? 'Close' : 'Cancel'}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        if (result) onClose();
        else if (file) importMutation.mutate(file);
      }}
    >
      <FormSection id="file" icon={FileSpreadsheet} title="File">
        <div className="field">
          <FieldLabel htmlFor="import-file" required>Spreadsheet</FieldLabel>
          <label className={`fm-drop${file ? ' has-file' : ''}`}>
            <Upload size={26} aria-hidden="true" />
            <b>{file ? file.name : 'Choose a .csv or .xlsx file'}</b>
            <span>{file ? `${(file.size / 1024).toFixed(1)} KB · click to choose another` : 'Up to 2 MB'}</span>
            <input
              id="import-file"
              type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
            />
          </label>
        </div>
        <p className="fm-note">
          Columns: <code className="kbd">name</code>, <code className="kbd">phone</code>, optionally <code className="kbd">email</code> and{' '}
          <code className="kbd">groups</code> (comma-separated - new groups are created automatically). Duplicate phone numbers are skipped.
        </p>
      </FormSection>

      <FormSection id="results" icon={ListChecks} title="Results">
        {!result ? (
          <p className="fm-note">Results appear here once the import finishes.</p>
        ) : (
          <>
            <div className="fm-summary">
              <span><b>{result.created}</b> added</span>
              <span><b>{result.skipped}</b> skipped</span>
              {result.errors.length > 0 && <span style={{ color: 'var(--red)' }}><b>{result.errors.length}</b> errors</span>}
            </div>
            {result.errors.length > 0 && (
              <div className="col scroll-thin" style={{ gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {result.errors.map((e, i) => (
                  <span key={i} className="text-xs" style={{ color: 'var(--red)' }}>Row {e.row}: {e.reason}</span>
                ))}
              </div>
            )}
          </>
        )}
      </FormSection>
    </FormModal>
  );
}

export default MembersPage;
