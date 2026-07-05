import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hashPin, uid, type Role, type User } from '../db';
import { useI18n } from '../i18n';
import { Empty, Modal, useToast } from '../components/shared';

export default function Users({ currentUser }: { currentUser: User }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const users = useLiveQuery(() => db.users.toArray(), []) ?? [];
  const [edit, setEdit] = useState<(Partial<User> & { newPin?: string }) | null>(null);

  const save = async () => {
    if (!edit?.name?.trim()) return toast(t('required'), 'info');
    const isNew = !edit.id;
    if (isNew && (edit.newPin ?? '').length !== 4) return toast(t('pin'), 'info');
    if (edit.newPin && edit.newPin.length !== 4) return toast(t('pin'), 'info');

    const base = {
      name: edit.name.trim(),
      role: (edit.role ?? 'cashier') as Role,
      active: edit.active ?? true,
    };
    if (isNew) {
      await db.users.add({ ...base, id: uid(), pinHash: await hashPin(edit.newPin!) } as User);
    } else {
      const patch: Partial<User> = { ...base };
      if (edit.newPin) patch.pinHash = await hashPin(edit.newPin);
      // never lock out the last active admin
      if (edit.id === currentUser.id || edit.role !== 'admin' || !base.active) {
        const admins = users.filter((u) => u.role === 'admin' && u.active && u.id !== edit.id);
        const stillAdmin = base.role === 'admin' && base.active;
        if (admins.length === 0 && !stillAdmin) return toast(t('lastAdmin'), 'info');
      }
      await db.users.update(edit.id!, patch);
    }
    setEdit(null);
    toast(t('settingsSaved'));
  };

  const remove = async (u: User) => {
    const admins = users.filter((x) => x.role === 'admin' && x.active && x.id !== u.id);
    if (u.role === 'admin' && admins.length === 0) return toast(t('lastAdmin'), 'info');
    if (confirm(t('confirmDelete'))) await db.users.delete(u.id!);
  };

  return (
    <div>
      <div className="page-head">
        <h2>👥 {t('navUsers')}</h2>
        <button className="btn btn-primary" onClick={() => setEdit({ role: 'cashier', active: true })}>＋ {t('newUser')}</button>
      </div>

      <div className="card table-wrap">
        {users.length === 0 ? (
          <Empty icon="👥" />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('role')}</th>
                <th>{t('active')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong> {u.id === currentUser.id && '⭐'}</td>
                  <td><span className={`badge ${u.role === 'admin' ? 'red' : u.role === 'manager' ? 'amber' : 'green'}`}>{t(u.role)}</span></td>
                  <td>{u.active ? '✅' : '⛔'}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...u, newPin: '' })}>✏️</button>{' '}
                    {u.id !== currentUser.id && (
                      <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <Modal
          title={edit.id ? `✏️ ${t('edit')}` : `＋ ${t('newUser')}`}
          onClose={() => setEdit(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEdit(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={save}>{t('save')}</button>
            </>
          }
        >
          <div className="field">
            <label>{t('name')} *</label>
            <input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('role')}</label>
            <select value={edit.role ?? 'cashier'} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
              <option value="admin">{t('admin')}</option>
              <option value="manager">{t('manager')}</option>
              <option value="cashier">{t('cashier')}</option>
            </select>
          </div>
          <div className="field">
            <label>{t('pin')} {edit.id ? `— ${t('pinKeepEmpty')}` : '*'}</label>
            <input
              inputMode="numeric"
              type="password"
              maxLength={4}
              value={edit.newPin ?? ''}
              onChange={(e) => setEdit({ ...edit, newPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            />
          </div>
          <div className="switch-row">
            <label style={{ margin: 0 }}>{t('active')}</label>
            <span className="seg">
              <button className={edit.active !== false ? 'on' : ''} onClick={() => setEdit({ ...edit, active: true })}>{t('yes')}</button>
              <button className={edit.active === false ? 'on' : ''} onClick={() => setEdit({ ...edit, active: false })}>{t('no')}</button>
            </span>
          </div>
        </Modal>
      )}
    </div>
  );
}
