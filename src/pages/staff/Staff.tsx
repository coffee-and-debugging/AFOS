import { useCallback, useState, type FormEvent } from 'react';
import { api, getAuthUser } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import PasswordInput from '../../components/PasswordInput';
import Stat from '../../components/Stat';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import { toDateInput } from '../../lib/dates';
import { downloadCsv, formatDate } from '../../lib/format';
import type { CategoryColor, PayrollMethod, StaffCategory, StaffMember, StaffPayment, StaffRole } from '../../types';

const ROLE_LABEL: Record<StaffRole, string> = { admin: 'Manager', cashier: 'Cashier', chef: 'Kitchen', staff: 'Staff' };
const ROLE_HINT: Record<StaffRole, string> = {
  admin: 'Full access',
  cashier: 'POS, orders and tables',
  chef: 'Kitchen and inventory',
  staff: 'Payroll only, no sign-in',
};
const METHOD_LABEL: Record<PayrollMethod, string> = { cash: 'Cash', bank: 'Bank transfer', esewa: 'eSewa', khalti: 'Khalti' };

const thisMonth = () => toDateInput(new Date()).slice(0, 7);
const monthLabel = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
};
const round2 = (n: number) => Math.round(n * 100) / 100;

// New cashier/kitchen accounts start in the matching department when it exists
const ROLE_CATEGORY: Partial<Record<StaffRole, string>> = { admin: 'management', cashier: 'front of house', chef: 'kitchen' };
function defaultCategoryFor(role: StaffRole | undefined, categories: StaffCategory[]) {
  const name = role && ROLE_CATEGORY[role];
  return name ? categories.find((c) => c.name.toLowerCase() === name)?.id : undefined;
}

const COLORS: CategoryColor[] = ['red', 'orange', 'amber', 'green', 'blue', 'purple', 'gray'];
type CategoryFilter = 'all' | 'none' | number;

function CategoryBadge({ category }: { category: Pick<StaffCategory, 'name' | 'color'> | null | undefined }) {
  if (!category) return <span className="muted">—</span>;
  return <span className={`badge cat-${category.color}`}>{category.name}</span>;
}

export default function Staff() {
  const { money } = useRestaurant();
  const toast = useToast();
  const [period, setPeriod] = useState(thisMonth);
  const [tab, setTab] = useState<'directory' | 'payroll'>('directory');
  const [showInactive, setShowInactive] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [managing, setManaging] = useState(false);
  // 'new' opens a blank form; a role opens it ready to create that kind of sign-in account
  const [editing, setEditing] = useState<StaffMember | 'new' | StaffRole | null>(null);
  const [paying, setPaying] = useState<StaffMember | null>(null);
  const [history, setHistory] = useState<StaffMember | null>(null);

  const load = useCallback(
    () => Promise.all([api.staff.list(period), api.staff.allPayments({ period }), api.staff.categories.list()]),
    [period],
  );
  const { data, error, loading, retry, reload } = usePolling(load);

  if (loading && !data) return <LoadingState label="Loading staff…" />;
  if (!data) return <ErrorState error={error} onRetry={retry} />;

  const [staff, payments, categories] = data;
  const active = staff.filter((s) => s.active);
  const inCategory = (categoryId: number | null | undefined) =>
    category === 'all' || (category === 'none' ? categoryId == null : categoryId === category);
  const salaryBill = active.reduce((s, x) => s + x.baseSalary, 0);
  const paid = payments.reduce((s, p) => s + p.netAmount, 0);
  const unpaid = active.filter((s) => s.baseSalary > 0 && s.paymentsThisPeriod === 0);
  const visible = (showInactive ? staff : active).filter((s) => inCategory(s.categoryId));
  const visiblePayments = payments.filter((p) => inCategory(p.user?.category?.id));
  const uncategorised = active.filter((s) => s.categoryId == null).length;

  async function toggleActive(member: StaffMember) {
    const verb = member.active ? 'Deactivate' : 'Reactivate';
    if (member.active && !confirm(`Deactivate ${member.name}? They will be signed out and can no longer log in. Their payment history is kept.`)) return;
    try {
      await api.staff.setActive(member.id, !member.active);
      toast.success(`${member.name} ${member.active ? 'deactivated' : 'reactivated'}`);
      reload();
    } catch (err) {
      toast.error(`${verb} failed: ${(err as Error).message}`);
    }
  }

  function exportCsv() {
    downloadCsv(`payroll-${period}.csv`, [
      ['Paid on', 'Staff', 'Category', 'Role', 'Period', 'Base', 'Bonus', 'OT hours', 'OT amount', 'Deductions', 'Net', 'Method', 'Note', 'Recorded by'],
      ...visiblePayments.map((p) => [
        formatDate(p.paidAt), p.user?.name ?? '', p.user?.category?.name ?? '', p.user ? ROLE_LABEL[p.user.role] : '', p.period, p.baseAmount, p.bonus,
        p.overtimeHours, p.overtimeAmount, p.deductions, p.netAmount, METHOD_LABEL[p.method] ?? p.method, p.note, p.recordedBy,
      ]),
    ]);
  }

  return (
    <>
      <PageHeader
        icon="user"
        title="Staff & Payroll"
        actions={<>
          <button className="btn btn-secondary" onClick={() => setManaging(true)}><Icon name="settings" size={16} /> Categories</button>
          <button className="btn btn-secondary" onClick={() => setEditing('cashier')}><Icon name="pos" size={16} /> Add cashier</button>
          <button className="btn btn-secondary" onClick={() => setEditing('chef')}><Icon name="kitchen" size={16} /> Add kitchen staff</button>
          <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Add staff</button>
        </>}
      />

      <div className="stats-grid">
        <Stat label="Active staff" value={active.length} hint={`${staff.length - active.length} inactive`} tone="primary" />
        <Stat label="Monthly salaries" value={money(salaryBill)} tone="accent" />
        <Stat label={`Paid · ${monthLabel(period)}`} value={money(round2(paid))} hint={`${payments.length} payment${payments.length === 1 ? '' : 's'}`} tone="success" />
        <Stat label="Not yet paid" value={unpaid.length} hint={unpaid.length ? unpaid.slice(0, 3).map((s) => s.name).join(', ') : 'Everyone is paid'} tone={unpaid.length ? 'warning' : 'success'} />
      </div>

      <div className="segmented category-chips" role="tablist" aria-label="Filter by category">
        <button role="tab" aria-selected={category === 'all'} className="segmented-item" onClick={() => setCategory('all')}>
          All <span className="segmented-count">{active.length}</span>
        </button>
        {categories.map((c) => (
          <button key={c.id} role="tab" aria-selected={category === c.id} className="segmented-item" onClick={() => setCategory(c.id)}>
            <span className={`cat-dot cat-${c.color}`} aria-hidden="true" /> {c.name} <span className="segmented-count">{c.activeStaff}</span>
          </button>
        ))}
        {uncategorised > 0 && (
          <button role="tab" aria-selected={category === 'none'} className="segmented-item" onClick={() => setCategory('none')}>
            Uncategorised <span className="segmented-count">{uncategorised}</span>
          </button>
        )}
        <button className="segmented-item" onClick={() => setManaging(true)} title="Add or edit categories">
          <Icon name="plus" size={14} /> New
        </button>
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="segmented" role="tablist">
            <button role="tab" aria-selected={tab === 'directory'} className="segmented-item" onClick={() => setTab('directory')}>Directory <span className="segmented-count">{visible.length}</span></button>
            <button role="tab" aria-selected={tab === 'payroll'} className="segmented-item" onClick={() => setTab('payroll')}>Payments <span className="segmented-count">{visiblePayments.length}</span></button>
          </div>
          <div className="row" style={{ gap: 'var(--space-2)', marginLeft: 'auto' }}>
            {tab === 'directory' && (
              <label className="row subtle" style={{ gap: 'var(--space-1)' }}>
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
              </label>
            )}
            {tab === 'payroll' && visiblePayments.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={exportCsv}><Icon name="download" size={14} /> CSV</button>
            )}
            <input className="input input-sm" type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} aria-label="Payroll month" />
          </div>
        </div>

        {tab === 'directory' ? (
          visible.length === 0 ? (
            <EmptyState
              icon="user"
              title={staff.length ? 'Nobody here' : 'No staff yet'}
              text={staff.length ? 'No staff in this category.' : 'Add your team to manage their access and pay.'}
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Category</th><th>Role</th><th>Sign-in</th><th>Phone</th><th className="num">Base salary</th><th className="num">Paid {monthLabel(period)}</th><th /></tr>
                </thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.id} className={s.active ? undefined : 'is-muted'}>
                      <td>
                        <strong>{s.name}</strong>
                        {!s.active && <span className="badge badge-cancelled" style={{ marginLeft: 'var(--space-2)' }}>Inactive</span>}
                        {s.position && <div className="muted cell-sub">{s.position}</div>}
                      </td>
                      <td><CategoryBadge category={s.category} /></td>
                      <td><span className={`badge role-${s.role}`}>{ROLE_LABEL[s.role]}</span></td>
                      <td className="muted">{s.canLogin ? s.username : 'No login'}</td>
                      <td className="muted">{s.phone || '—'}</td>
                      <td className="num">{money(s.baseSalary)}</td>
                      <td className="num">
                        {s.paymentsThisPeriod ? money(s.paidThisPeriod) : <span className="muted">—</span>}
                        {s.lastPayment && <div className="muted cell-sub">Last: {formatDate(s.lastPayment.paidAt)}</div>}
                      </td>
                      <td>
                        <div className="row-actions">
                          {s.active && <button className="btn btn-secondary btn-sm" onClick={() => setPaying(s)}><Icon name="cash" size={14} /> Pay</button>}
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setHistory(s)} aria-label={`Payments for ${s.name}`} title="Payment history"><Icon name="history" size={14} /></button>
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`} title="Edit"><Icon name="edit" size={14} /></button>
                          {s.id !== getAuthUser()?.id && (
                            <button className={`btn btn-sm ${s.active ? 'btn-danger' : 'btn-secondary'}`} onClick={() => toggleActive(s)}>
                              {s.active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <>
            {category === 'all' && payments.length > 0 && <CategoryBreakdown payments={payments} categories={categories} />}
            <PaymentsTable payments={visiblePayments} onChanged={reload} showStaff />
          </>
        )}
      </section>

      {editing && (
        <StaffForm
          member={typeof editing === 'string' ? null : editing}
          initialRole={typeof editing === 'string' && editing !== 'new' ? editing : undefined}
          categories={categories}
          defaultCategoryId={typeof category === 'number' ? category : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
      {managing && (
        <CategoryManager
          categories={categories}
          onClose={() => setManaging(false)}
          onChanged={(removedId) => {
            if (removedId !== undefined && category === removedId) setCategory('all');
            reload();
          }}
        />
      )}
      {paying && <PayForm member={paying} period={period} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); reload(); }} />}
      {history && <History member={history} onClose={() => setHistory(null)} onChanged={reload} />}
    </>
  );
}

function PaymentsTable({ payments, onChanged, showStaff }: { payments: StaffPayment[]; onChanged: () => void; showStaff?: boolean }) {
  const { money } = useRestaurant();
  const toast = useToast();

  async function remove(p: StaffPayment) {
    if (!confirm(`Delete this ${money(p.netAmount)} payment? Only do this for an entry recorded by mistake.`)) return;
    try {
      await api.staff.deletePayment(p.id);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (payments.length === 0) return <EmptyState icon="cash" title="No payments recorded" />;

  const sum = (k: keyof StaffPayment) => round2(payments.reduce((s, p) => s + (p[k] as number), 0));

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Paid on</th>{showStaff && <th>Staff</th>}<th>Period</th>
            <th className="num">Base</th><th className="num">Bonus</th><th className="num">Overtime</th><th className="num">Deductions</th><th className="num">Net paid</th>
            <th>Method</th><th />
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="nowrap">{formatDate(p.paidAt)}{p.note && <div className="muted cell-sub">{p.note}</div>}</td>
              {showStaff && <td>{p.user?.name}{p.user?.category && <div className="muted cell-sub">{p.user.category.name}</div>}</td>}
              <td className="muted nowrap">{monthLabel(p.period)}</td>
              <td className="num">{money(p.baseAmount)}</td>
              <td className="num">{p.bonus ? money(p.bonus) : '—'}</td>
              <td className="num">{p.overtimeAmount ? <>{money(p.overtimeAmount)}<div className="muted cell-sub">{p.overtimeHours} h × {money(p.overtimeRate)}</div></> : '—'}</td>
              <td className="num danger-text">{p.deductions ? `−${money(p.deductions)}` : ''}</td>
              <td className="num"><strong>{money(p.netAmount)}</strong></td>
              <td className="muted">{METHOD_LABEL[p.method] ?? p.method}</td>
              <td>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => remove(p)} aria-label="Delete payment" title={`Recorded by ${p.recordedBy || 'unknown'}`}>
                  <Icon name="trash" size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={showStaff ? 3 : 2}>Total</th>
            <th className="num">{money(sum('baseAmount'))}</th><th className="num">{money(sum('bonus'))}</th><th className="num">{money(sum('overtimeAmount'))}</th>
            <th className="num">{money(sum('deductions'))}</th><th className="num">{money(sum('netAmount'))}</th><th colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function StaffForm({ member, initialRole, categories: initialCategories, defaultCategoryId, onClose, onSaved }: {
  member: StaffMember | null;
  initialRole?: StaffRole;
  categories: StaffCategory[];
  defaultCategoryId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [categories, setCategories] = useState(initialCategories);
  const [newCategory, setNewCategory] = useState<string | null>(null); // non-null while typing a new one
  const [form, setForm] = useState({
    name: member?.name ?? '',
    categoryId: member
      ? (member.categoryId == null ? '' : String(member.categoryId))
      : String(defaultCategoryId ?? defaultCategoryFor(initialRole, initialCategories) ?? ''),
    role: (member?.role ?? initialRole ?? 'cashier') as StaffRole,
    position: member?.position ?? '',
    phone: member?.phone ?? '',
    username: member?.username ?? '',
    password: '',
    baseSalary: member ? String(member.baseSalary) : '',
    overtimeRate: member ? String(member.overtimeRate) : '',
    joinedAt: member ? toDateInput(new Date(member.joinedAt)) : toDateInput(new Date()),
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const canLogin = form.role !== 'staff';
  const needsPassword = canLogin && !member?.canLogin;
  const isSelf = member?.id === getAuthUser()?.id;

  async function addCategory() {
    const name = (newCategory ?? '').trim();
    if (!name) return;
    try {
      const created = await api.staff.categories.create({ name });
      setCategories((prev) => [...prev, created]);
      setForm((f) => ({ ...f, categoryId: String(created.id) }));
      setNewCategory(null);
      toast.success(`Category "${created.name}" added`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (newCategory !== null) return toast.error('Add or cancel the new category first');
    setSaving(true);
    const [y, m, d] = form.joinedAt.split('-').map(Number);
    const data = {
      name: form.name,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      role: form.role,
      position: form.position,
      phone: form.phone,
      username: canLogin ? form.username : null,
      ...(form.password && { password: form.password }),
      baseSalary: Number(form.baseSalary) || 0,
      overtimeRate: Number(form.overtimeRate) || 0,
      joinedAt: new Date(y, m - 1, d, 12).toISOString(),
    };
    try {
      if (member) await api.staff.update(member.id, data);
      else await api.staff.create(data);
      toast.success(`${form.name} saved`);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={member ? `Edit ${member.name}` : initialRole === 'cashier' ? 'New cashier account' : initialRole === 'chef' ? 'New kitchen account' : 'Add staff member'}
      onClose={onClose}
      wide
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="staff-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}
    >
      <form id="staff-form" onSubmit={submit}>
        <div className="grid-3">
          <label className="field"><span className="field-label">Full name</span><input className="input" value={form.name} onChange={set('name')} required autoFocus /></label>
          <label className="field"><span className="field-label">Job title</span><input className="input" value={form.position} onChange={set('position')} placeholder="e.g. Head chef, Waiter" /></label>
          <label className="field"><span className="field-label">Phone</span><input className="input" type="tel" value={form.phone} onChange={set('phone')} /></label>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field-label" htmlFor="staff-category">Category</label>
            {newCategory === null ? (
              <select
                id="staff-category"
                className="input"
                value={form.categoryId}
                onChange={(e) => (e.target.value === '__new' ? setNewCategory('') : setForm({ ...form, categoryId: e.target.value }))}
              >
                <option value="">— Uncategorised —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new">+ New category…</option>
              </select>
            ) : (
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <input
                  id="staff-category"
                  className="input"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
                  placeholder="e.g. Delivery, Security"
                  maxLength={40}
                  autoFocus
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={addCategory} disabled={!newCategory.trim()}>Add</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewCategory(null)}>Cancel</button>
              </div>
            )}
          </div>
          <label className="field">
            <span className="field-label">Role &amp; access</span>
            <select className="input" value={form.role} onChange={set('role')} disabled={isSelf}>
              {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <span className="field-hint">{isSelf ? 'You cannot change your own role.' : ROLE_HINT[form.role]}</span>
          </label>
        </div>

        {canLogin && (
          <div className="grid-2">
            <label className="field">
              <span className="field-label">Username</span>
              <input className="input" value={form.username} onChange={set('username')} required autoComplete="off" pattern="[A-Za-z0-9._\-]{3,32}" title="3–32 letters, numbers, dot, dash or underscore" />
            </label>
            <label className="field">
              <span className="field-label">{needsPassword ? 'Password' : 'New password'}</span>
              <PasswordInput value={form.password} onChange={set('password')} required={needsPassword} minLength={6} autoComplete="new-password" placeholder={needsPassword ? 'At least 6 characters' : 'Leave blank to keep current'} />
            </label>
          </div>
        )}

        <div className="grid-3">
          <label className="field"><span className="field-label">Monthly base salary</span><input className="input" type="number" step="any" min="0" value={form.baseSalary} onChange={set('baseSalary')} /></label>
          <label className="field"><span className="field-label">Overtime rate / hour</span><input className="input" type="number" step="any" min="0" value={form.overtimeRate} onChange={set('overtimeRate')} /></label>
          <label className="field"><span className="field-label">Joined on</span><input className="input" type="date" value={form.joinedAt} onChange={set('joinedAt')} required /></label>
        </div>
      </form>
    </Modal>
  );
}

function PayForm({ member, period: initialPeriod, onClose, onSaved }: { member: StaffMember; period: string; onClose: () => void; onSaved: () => void }) {
  const { money } = useRestaurant();
  const toast = useToast();
  const [form, setForm] = useState({
    period: initialPeriod,
    baseAmount: String(member.baseSalary),
    bonus: '',
    overtimeHours: '',
    overtimeRate: String(member.overtimeRate),
    deductions: '',
    method: 'cash' as PayrollMethod,
    paidAt: toDateInput(new Date()),
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const n = (v: string) => Number(v) || 0;
  const overtime = round2(n(form.overtimeHours) * n(form.overtimeRate));
  const gross = round2(n(form.baseAmount) + n(form.bonus) + overtime);
  const net = round2(gross - n(form.deductions));
  const alreadyPaid = form.period === member.period && member.paymentsThisPeriod > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (net < 0) return toast.error('Deductions cannot exceed the total pay');
    setSaving(true);
    const [y, m, d] = form.paidAt.split('-').map(Number);
    try {
      await api.staff.pay(member.id, {
        period: form.period,
        baseAmount: n(form.baseAmount),
        bonus: n(form.bonus),
        overtimeHours: n(form.overtimeHours),
        overtimeRate: n(form.overtimeRate),
        deductions: n(form.deductions),
        method: form.method,
        paidAt: new Date(y, m - 1, d, 12).toISOString(),
        note: form.note,
      });
      toast.success(`Paid ${member.name} ${money(net)}`);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Pay ${member.name}`}
      onClose={onClose}
      wide
      footer={<>
        <span className="spacer price">Net pay {money(net)}</span>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="pay-form" disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</button>
      </>}
    >
      <form id="pay-form" onSubmit={submit}>
        {alreadyPaid && (
          <p className="alert alert-warning">
            {member.name} already has {member.paymentsThisPeriod} payment{member.paymentsThisPeriod === 1 ? '' : 's'} ({money(member.paidThisPeriod)}) for {monthLabel(form.period)}.
          </p>
        )}
        <div className="grid-3">
          <label className="field"><span className="field-label">For month</span><input className="input" type="month" value={form.period} onChange={set('period')} required /></label>
          <label className="field"><span className="field-label">Paid on</span><input className="input" type="date" value={form.paidAt} onChange={set('paidAt')} required /></label>
          <label className="field">
            <span className="field-label">Method</span>
            <select className="input" value={form.method} onChange={set('method')}>
              {(Object.keys(METHOD_LABEL) as PayrollMethod[]).map((k) => <option key={k} value={k}>{METHOD_LABEL[k]}</option>)}
            </select>
          </label>
        </div>
        <div className="grid-3">
          <label className="field"><span className="field-label">Base salary</span><input className="input" type="number" step="any" min="0" value={form.baseAmount} onChange={set('baseAmount')} /></label>
          <label className="field"><span className="field-label">Bonus</span><input className="input" type="number" step="any" min="0" value={form.bonus} onChange={set('bonus')} placeholder="0" /></label>
          <label className="field"><span className="field-label">Deductions</span><input className="input" type="number" step="any" min="0" value={form.deductions} onChange={set('deductions')} placeholder="Advances, absences…" /></label>
        </div>
        <div className="grid-3">
          <label className="field"><span className="field-label">Overtime hours</span><input className="input" type="number" step="any" min="0" value={form.overtimeHours} onChange={set('overtimeHours')} placeholder="0" /></label>
          <label className="field"><span className="field-label">Overtime rate / hour</span><input className="input" type="number" step="any" min="0" value={form.overtimeRate} onChange={set('overtimeRate')} /></label>
          <label className="field"><span className="field-label">Note</span><input className="input" value={form.note} onChange={set('note')} placeholder="Optional" /></label>
        </div>
        <ul className="line-items">
          <li><span>Base + bonus</span><span>{money(round2(n(form.baseAmount) + n(form.bonus)))}</span></li>
          <li><span>Overtime ({n(form.overtimeHours)} h)</span><span>{money(overtime)}</span></li>
          <li><span>Deductions</span><span className="danger-text">−{money(n(form.deductions))}</span></li>
          <li><strong>Net pay</strong><strong className={net < 0 ? 'danger-text' : undefined}>{money(net)}</strong></li>
        </ul>
      </form>
    </Modal>
  );
}

function History({ member, onClose, onChanged }: { member: StaffMember; onClose: () => void; onChanged: () => void }) {
  const { money } = useRestaurant();
  const load = useCallback(() => api.staff.payments(member.id), [member.id]);
  const { data, error, loading, retry, reload } = usePolling(load);
  const total = (data ?? []).reduce((s, p) => s + p.netAmount, 0);

  return (
    <Modal title={`${member.name} · payment history`} wide onClose={onClose}>
      <p className="subtle" style={{ marginTop: 0 }}>
        {ROLE_LABEL[member.role]}{member.position && ` · ${member.position}`} · joined {formatDate(member.joinedAt)}
        {data && data.length > 0 && <> · {money(round2(total))} paid in total</>}
      </p>
      {loading && !data ? <LoadingState /> : !data ? <ErrorState error={error} onRetry={retry} /> : (
        <PaymentsTable payments={data} onChanged={() => { reload(); onChanged(); }} />
      )}
    </Modal>
  );
}

/** Paid totals per category for the selected month. */
function CategoryBreakdown({ payments, categories }: { payments: StaffPayment[]; categories: StaffCategory[] }) {
  const { money } = useRestaurant();
  const totals = new Map<number | null, number>();
  for (const p of payments) {
    const key = p.user?.category?.id ?? null;
    totals.set(key, (totals.get(key) || 0) + p.netAmount);
  }
  const all = payments.reduce((s, p) => s + p.netAmount, 0) || 1;
  const rows = [
    ...categories.filter((c) => totals.has(c.id)).map((c) => ({ key: String(c.id), name: c.name, color: c.color, amount: totals.get(c.id)! })),
    ...(totals.has(null) ? [{ key: 'none', name: 'Uncategorised', color: 'gray' as CategoryColor, amount: totals.get(null)! }] : []),
  ];

  return (
    <ul className="category-breakdown">
      {rows.map((r) => (
        <li key={r.key}>
          <span className="row" style={{ gap: 'var(--space-2)' }}><span className={`cat-dot cat-${r.color}`} aria-hidden="true" />{r.name}</span>
          <span className="category-bar" aria-hidden="true"><span className={`cat-${r.color}`} style={{ width: `${(r.amount / all) * 100}%` }} /></span>
          <strong className="num">{money(round2(r.amount))}</strong>
        </li>
      ))}
    </ul>
  );
}

/** Add, rename, recolour, reorder and remove staff categories. */
function CategoryManager({ categories, onClose, onChanged }: {
  categories: StaffCategory[];
  onClose: () => void;
  onChanged: (removedId?: number) => void;
}) {
  const toast = useToast();
  const { money } = useRestaurant();
  const [list, setList] = useState(categories);
  const [draft, setDraft] = useState({ name: '', color: 'blue' as CategoryColor, description: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState({ name: '', color: 'gray' as CategoryColor, description: '' });
  const [removing, setRemoving] = useState<StaffCategory | null>(null);
  const [moveTo, setMoveTo] = useState<string>('none');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const add = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const created = await api.staff.categories.create(draft);
      setList((l) => [...l, created]);
      setDraft({ name: '', color: draft.color, description: '' });
      onChanged();
    });
  };

  const save = (c: StaffCategory) => run(async () => {
    const updated = await api.staff.categories.update(c.id, edit);
    setList((l) => l.map((x) => (x.id === c.id ? { ...x, ...updated } : x)));
    setEditingId(null);
    onChanged();
  });

  const move = (index: number, delta: number) => run(async () => {
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setList(next);
    await api.staff.categories.reorder(next.map((c) => c.id));
    onChanged();
  });

  const remove = (c: StaffCategory) => run(async () => {
    // Always say where members go: inactive staff aren't counted in activeStaff but still need a home
    const res = await api.staff.categories.delete(c.id, moveTo === 'none' ? 'none' : Number(moveTo));
    setList((l) => l.filter((x) => x.id !== c.id));
    setRemoving(null);
    toast.success(res.moved ? `Removed ${c.name}; ${res.moved} staff moved` : `Removed ${c.name}`);
    onChanged(c.id);
  });

  return (
    <Modal title="Staff categories" wide onClose={onClose} footer={<button className="btn btn-secondary" onClick={onClose}>Done</button>}>
      <form className="category-add" onSubmit={add}>
        <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="New category, e.g. Delivery" maxLength={40} required aria-label="Category name" />
        <input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description (optional)" maxLength={120} aria-label="Description" />
        <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
        <button className="btn btn-primary" disabled={busy || !draft.name.trim()}><Icon name="plus" size={16} /> Add</button>
      </form>

      {list.length === 0 ? (
        <EmptyState icon="user" title="No categories yet" />
      ) : (
        <ul className="category-list">
          {list.map((c, i) => (
            <li key={c.id}>
              {editingId === c.id ? (
                <div className="category-add" style={{ margin: 0, flex: 1 }}>
                  <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={40} aria-label="Category name" autoFocus />
                  <input className="input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="Description" maxLength={120} aria-label="Description" />
                  <ColorPicker value={edit.color} onChange={(color) => setEdit({ ...edit, color })} />
                  <div className="row" style={{ gap: 'var(--space-1)' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => save(c)} disabled={busy || !edit.name.trim()}>Save</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className={`cat-dot cat-${c.color}`} aria-hidden="true" />
                  <div className="spacer" style={{ minWidth: 0 }}>
                    <strong>{c.name}</strong>
                    <div className="muted cell-sub">
                      {c.activeStaff} active · {money(c.salaryBill)} / month{c.description && ` · ${c.description}`}
                    </div>
                  </div>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label={`Move ${c.name} up`}>↑</button>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => move(i, 1)} disabled={busy || i === list.length - 1} aria-label={`Move ${c.name} down`}>↓</button>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setEditingId(c.id); setEdit({ name: c.name, color: c.color, description: c.description }); }} aria-label={`Edit ${c.name}`}><Icon name="edit" size={14} /></button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => { setRemoving(c); setMoveTo('none'); }} aria-label={`Remove ${c.name}`}><Icon name="trash" size={14} /></button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {removing && (
        <Modal
          title={`Remove ${removing.name}?`}
          onClose={() => setRemoving(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setRemoving(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => remove(removing)} disabled={busy}>Remove category</button>
          </>}
        >
          {removing.activeStaff > 0 ? (
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Move its {removing.activeStaff} staff member{removing.activeStaff === 1 ? '' : 's'} to</span>
              <select className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="none">— Uncategorised —</option>
                {list.filter((c) => c.id !== removing.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          ) : (
            <p style={{ margin: 0 }}>No active staff in this category.</p>
          )}
        </Modal>
      )}
    </Modal>
  );
}

function ColorPicker({ value, onChange }: { value: CategoryColor; onChange: (c: CategoryColor) => void }) {
  return (
    <div className="color-picker" role="radiogroup" aria-label="Colour">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          className={`cat-dot cat-${c}${value === c ? ' is-selected' : ''}`}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}
