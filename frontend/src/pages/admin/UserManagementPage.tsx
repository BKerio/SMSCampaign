import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, UserPen, ChevronLeft as CaretLeft, ChevronRight as CaretRight,
  Pencil as PencilSimple, Trash2, Users, Power, IdCard, KeyRound, ShieldCheck,
} from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';
import FormModal, { ChoiceCards, FieldLabel, FormSection } from '@/components/shared/FormModal';
import api from '@/api/client';
import { PaginatedResponse, Role, User, positionLabel } from '@/types/api';
import PositionCards from '@/components/shared/PositionCards';
import { confirmDialog } from '@/lib/alert';
import PageLoader from '@/components/shared/PageLoader';

const ROLES: Role[] = ['STAFF', 'ADMIN', 'SUPER_ADMIN'];
const positionSchema = z.enum(['CHAIRMAN', 'VICE_CHAIRMAN', 'SECRETARY', 'TREASURER', 'CATECHIST']).nullable();

const createSchema = z.object({
  email: z.string().email('Invalid email'),
  passwordRaw: z.string().min(8, 'At least 8 characters'),
  name: z.string().min(2, 'Name is required'),
  role: z.enum(['STAFF', 'ADMIN', 'SUPER_ADMIN']),
  position: positionSchema,
  phone: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  role: z.enum(['STAFF', 'ADMIN', 'SUPER_ADMIN']),
  position: positionSchema,
  password: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

function roleLabel(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase().replace('_', ' ');
}

/** Operators are the accounts that sign into this platform to onboard members and send campaigns (as opposed to Members, the SMS recipients). */
function UserManagementPage() {
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const { addNotification } = useNotificationStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, roleFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 15 };
      if (roleFilter !== 'ALL') params.role = roleFilter;
      const res = await api.get<PaginatedResponse<User>>('/admin/users', { params });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateForm) => api.post('/admin/users', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setCreateOpen(false);
      addNotification({ type: 'success', title: 'Operator created', message: 'The account is ready to sign in.' });
    },
    onError: (err: any) => addNotification({ type: 'error', title: 'Failed to create operator', message: err?.response?.data?.message || 'Please try again.' }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<EditForm> }) => api.patch(`/admin/users/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditing(null);
      addNotification({ type: 'success', title: 'Operator updated', message: 'Changes have been saved.' });
    },
    onError: (err: any) => addNotification({ type: 'error', title: 'Update failed', message: err?.response?.data?.message || 'Please try again.' }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/admin/users/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      addNotification({ type: 'success', title: 'Operator updated', message: 'Account status changed.' });
    },
    onError: (err: any) => addNotification({ type: 'error', title: 'Update failed', message: err?.response?.data?.message || 'Please try again.' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      addNotification({ type: 'success', title: 'Operator deleted', message: 'The account has been removed.' });
    },
    onError: (err: any) => addNotification({ type: 'error', title: 'Delete failed', message: err?.response?.data?.message || 'Please try again.' }),
  });

  const handleDelete = async (user: User) => {
    const confirmed = await confirmDialog({
      title: 'Delete operator',
      text: `Delete ${user.name} (${user.email})? This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (confirmed) deleteMutation.mutate(user.id);
  };

  const users = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 15, totalPages: 0 };

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Management</p>
          <h2 className="text-2xl font-bold mt-1" style={{ color: 'var(--ink)' }}>Operators</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{meta.total} people with access to this platform</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          <UserPlus size={16} /> Add Operator
        </button>
      </div>

      <div className="card card-pad">
        <select className="eoc-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as Role | 'ALL'); setPage(1); }} style={{ maxWidth: 220 }}>
          <option value="ALL">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="card-pad"><PageLoader height={240} /></div>
        ) : users.length === 0 ? (
          <div className="card-pad flex flex-col items-center text-center" style={{ gap: 8, padding: '48px 20px' }}>
            <Users size={32} style={{ color: 'var(--red)' }} />
            <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>No operators found</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {['Name', 'Email', 'Phone', 'Position', 'Role', 'Members onboarded', 'Campaigns sent', 'Status', ''].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="strong">{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.phone || '-'}</td>
                    <td>{u.position ? positionLabel(u.position) : '-'}</td>
                    <td><span className="pill pill-blue">{roleLabel(u.role)}</span></td>
                    <td>{u._count?.membersOnboarded ?? 0}</td>
                    <td>{u._count?.campaignsCreated ?? 0}</td>
                    <td>
                      <span className={`pill ${u.isActive ? 'pill-green' : 'pill-gray'}`}>{u.isActive ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="icon-btn" title="Edit" onClick={() => setEditing(u)}><PencilSimple size={14} /></button>
                      <button
                        className="icon-btn"
                        title={u.isActive ? 'Deactivate' : 'Activate'}
                        onClick={() => toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })}
                      >
                        <Power size={14} />
                      </button>
                      <button className="icon-btn" title="Delete" onClick={() => handleDelete(u)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between card-pad" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Page {meta.page} of {meta.totalPages}</span>
            <div className="flex gap-2">
              <button className="btn btn-soft btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><CaretLeft size={14} /></button>
              <button className="btn btn-soft btn-sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}><CaretRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          submitting={createMutation.isPending}
          onSubmit={async (values) => { await createMutation.mutateAsync(values); }}
        />
      )}

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          submitting={editMutation.isPending}
          onSubmit={async (values) => { await editMutation.mutateAsync({ id: editing.id, values }); }}
        />
      )}
    </div>
  );
}

const ROLE_OPTIONS = [
  { value: 'STAFF', label: 'Staff', sub: 'Onboards members, sends campaigns', tile: 'ST' },
  { value: 'ADMIN', label: 'Admin', sub: 'Manages everything except operators', tile: 'AD' },
  { value: 'SUPER_ADMIN', label: 'Super admin', sub: 'Full access, incl. operators & settings', tile: 'SA' },
];

function RoleCards({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <div className="field">
      <FieldLabel required>Role</FieldLabel>
      <ChoiceCards label="Role" columns={3} options={ROLE_OPTIONS} selected={[value]} onToggle={(v) => onChange(v as Role)} />
    </div>
  );
}


function CreateUserModal({ onClose, onSubmit, submitting }: {
  onClose: () => void;
  onSubmit: (values: CreateForm) => Promise<void> | void;
  submitting?: boolean;
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', email: '', passwordRaw: '', phone: '', role: 'STAFF', position: null },
  });
  const [name = '', email = '', passwordRaw = '', role, position = null] = watch(['name', 'email', 'passwordRaw', 'role', 'position']);

  return (
    <FormModal
      icon={UserPlus}
      title="Add an operator"
      subtitle="Give a staff member access to send campaigns."
      steps={[
        { id: 'profile', label: 'Profile', done: createSchema.shape.name.safeParse(name).success },
        { id: 'login', label: 'Login', done: createSchema.shape.email.safeParse(email).success && createSchema.shape.passwordRaw.safeParse(passwordRaw).success },
        { id: 'access', label: 'Access', done: !!role },
      ]}
      statusLabel="New operator"
      statusDetail={name}
      submitLabel="Create operator"
      submittingLabel="Creating…"
      submitting={submitting}
      onClose={onClose}
      onSubmit={handleSubmit(async (v) => onSubmit(v))}
    >
      <FormSection id="profile" icon={IdCard} title="Profile">
        <div className="fm-grid-2">
          <div className="field">
            <FieldLabel htmlFor="new-name" required>Full name</FieldLabel>
            <input id="new-name" className="input" placeholder="e.g. Peter Otieno" autoFocus {...register('name')} />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </div>
          <div className="field">
            <FieldLabel htmlFor="new-phone">Phone</FieldLabel>
            <input id="new-phone" className="input" type="tel" placeholder="0712 345 678" {...register('phone')} />
          </div>
        </div>
      </FormSection>

      <FormSection id="login" icon={KeyRound} title="Login">
        <div className="fm-grid-2">
          <div className="field">
            <FieldLabel htmlFor="new-email" required>Email</FieldLabel>
            <input id="new-email" className="input" type="email" placeholder="e.g. peter@example.com" {...register('email')} />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </div>
          <div className="field">
            <FieldLabel htmlFor="new-password" required hint={`${passwordRaw.length}/8+`}>Temporary password</FieldLabel>
            <input id="new-password" className="input" type="text" autoComplete="off" placeholder="Minimum 8 characters" {...register('passwordRaw')} />
            {errors.passwordRaw && <span className="field-error">{errors.passwordRaw.message}</span>}
          </div>
        </div>
        <p className="fm-note">Share this password with them privately - they can change it from their profile.</p>
      </FormSection>

      <FormSection id="access" icon={ShieldCheck} title="Access">
        <PositionCards value={position} onChange={(p) => setValue('position', p, { shouldDirty: true })} />
        <RoleCards value={role} onChange={(r) => setValue('role', r, { shouldDirty: true })} />
      </FormSection>
    </FormModal>
  );
}

function EditUserModal({ user, onClose, onSubmit, submitting }: {
  user: User;
  onClose: () => void;
  onSubmit: (values: Partial<EditForm>) => Promise<void> | void;
  submitting?: boolean;
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      role: user.role as CreateForm['role'],
      position: user.position ?? null,
      password: '',
    },
  });
  const [name = '', email = '', role, position = null] = watch(['name', 'email', 'role', 'position']);

  return (
    <FormModal
      icon={UserPen}
      title="Edit operator"
      subtitle="Update this operator's details, role or password."
      steps={[
        { id: 'profile', label: 'Profile', done: editSchema.shape.name.safeParse(name).success },
        { id: 'login', label: 'Login', done: editSchema.shape.email.safeParse(email).success },
        { id: 'access', label: 'Access', done: !!role },
      ]}
      statusLabel="Editing operator"
      statusDetail={name}
      submitLabel="Save changes"
      submitting={submitting}
      onClose={onClose}
      onSubmit={handleSubmit(async (v) => onSubmit({ ...v, password: v.password || undefined }))}
    >
      <FormSection id="profile" icon={IdCard} title="Profile">
        <div className="fm-grid-2">
          <div className="field">
            <FieldLabel htmlFor="edit-name" required>Full name</FieldLabel>
            <input id="edit-name" className="input" {...register('name')} />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </div>
          <div className="field">
            <FieldLabel htmlFor="edit-phone">Phone</FieldLabel>
            <input id="edit-phone" className="input" type="tel" {...register('phone')} />
          </div>
        </div>
      </FormSection>

      <FormSection id="login" icon={KeyRound} title="Login">
        <div className="fm-grid-2">
          <div className="field">
            <FieldLabel htmlFor="edit-email" required>Email</FieldLabel>
            <input id="edit-email" className="input" type="email" {...register('email')} />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </div>
          <div className="field">
            <FieldLabel htmlFor="edit-password">Reset password</FieldLabel>
            <input id="edit-password" className="input" type="text" autoComplete="off" placeholder="Leave blank to keep current" {...register('password')} />
          </div>
        </div>
      </FormSection>

      <FormSection id="access" icon={ShieldCheck} title="Access">
        <PositionCards value={position} onChange={(p) => setValue('position', p, { shouldDirty: true })} />
        <RoleCards value={role} onChange={(r) => setValue('role', r, { shouldDirty: true })} />
      </FormSection>
    </FormModal>
  );
}

export default UserManagementPage;
