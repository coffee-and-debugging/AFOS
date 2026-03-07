import { useState, useEffect, type FormEvent } from 'react';
import AdminLayout from './AdminLayout';
import { api } from '../../api/client';
import type { MenuItem } from '../../types';

const EMPTY_FORM: { name: string; description: string; price: string; category: 'tea' | 'food'; available: boolean } = {
  name: '', description: '', price: '', category: 'tea', available: true,
};

export default function MenuManagement() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.menu.getAll().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(item: MenuItem) {
    setEditItem(item);
    setForm({ name: item.name, description: item.description, price: String(item.price), category: item.category, available: item.available });
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, price: parseFloat(form.price) };
      if (editItem) {
        const updated = await api.menu.update(editItem.id, payload);
        setItems((prev) => prev.map((m) => (m.id === editItem.id ? updated : m)));
      } else {
        const created = await api.menu.create(payload);
        setItems((prev) => [...prev, created]);
      }
      setShowModal(false);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this menu item?')) return;
    try {
      await api.menu.delete(id);
      setItems((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function toggleAvailable(item: MenuItem) {
    const updated = await api.menu.update(item.id, { available: !item.available });
    setItems((prev) => prev.map((m) => (m.id === item.id ? updated : m)));
  }

  const teas = items.filter((m) => m.category === 'tea');
  const foods = items.filter((m) => m.category === 'food');

  return (
    <AdminLayout>
      <div className="page-header">
        <h1>Menu Management</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Item</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="spinner" />
      ) : (
        <>
          {([['Teas', teas], ['Food', foods]] as [string, MenuItem[]][]).map(([label, list]) => (
            <div key={label} className="card" style={{ marginBottom: '1rem' }}>
              <h2 style={{ marginBottom: '1rem' }}>{label}</h2>
              {list.length === 0 ? (
                <p className="text-muted">No items.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Price</th>
                        <th>Available</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((item) => (
                        <tr key={item.id}>
                          <td><strong>{item.name}</strong></td>
                          <td className="text-muted">{item.description}</td>
                          <td>${item.price.toFixed(2)}</td>
                          <td>
                            <button
                              className={`btn btn-sm ${item.available ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => toggleAvailable(item)}
                            >
                              {item.available ? 'Yes' : 'No'}
                            </button>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editItem ? 'Edit Item' : 'Add Menu Item'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Price ($)</label>
                <input type="number" step="0.01" min="0" className="form-control" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select className="form-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as 'tea' | 'food' })}>
                  <option value="tea">Tea</option>
                  <option value="food">Food</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
