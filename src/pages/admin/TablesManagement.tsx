import { useState, useEffect, type FormEvent } from 'react';
import AdminLayout from './AdminLayout';
import { api } from '../../api/client';

interface TableData {
  id: string;
  number: number;
}

interface QRInfo {
  qrCode: string;
  url: string;
  tableNumber: number;
}

export default function TablesManagement() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [adding, setAdding] = useState(false);
  const [qrModal, setQrModal] = useState<QRInfo | null>(null);
  const [qrLoading, setQrLoading] = useState<string | null>(null);

  useEffect(() => {
    api.tables.getAll().then(setTables).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const table = await api.tables.create(parseInt(newNumber));
      setTables((prev) => [...prev, table].sort((a, b) => a.number - b.number));
      setNewNumber('');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this table?')) return;
    try {
      await api.tables.delete(id);
      setTables((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function showQR(table: TableData) {
    setQrLoading(table.id);
    try {
      const baseUrl = window.location.origin;
      const data = await api.tables.getQR(table.id, baseUrl);
      setQrModal(data);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setQrLoading(null);
    }
  }

  function downloadQR() {
    if (!qrModal) return;
    const a = document.createElement('a');
    a.href = qrModal.qrCode;
    a.download = `table-${qrModal.tableNumber}-qr.png`;
    a.click();
  }

  return (
    <AdminLayout>
      <div className="page-header">
        <h1>Tables &amp; QR Codes</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Add New Table</h2>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <label>Table Number</label>
            <input
              type="number"
              min="1"
              className="form-control"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="e.g. 5"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={adding}>
            {adding ? 'Adding...' : 'Add Table'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>Tables</h2>
        {loading ? (
          <div className="spinner" />
        ) : tables.length === 0 ? (
          <p className="text-muted">No tables created yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Table #</th>
                  <th>ID</th>
                  <th>Customer URL</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tables.sort((a, b) => a.number - b.number).map((table) => (
                  <tr key={table.id}>
                    <td><strong>Table {table.number}</strong></td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{table.id}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      /table/{table.id}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => showQR(table)}
                          disabled={qrLoading === table.id}
                        >
                          {qrLoading === table.id ? '...' : 'QR Code'}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(table.id)}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {qrModal && (
        <div className="modal-overlay" onClick={() => setQrModal(null)}>
          <div className="modal" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>QR Code — Table {qrModal.tableNumber}</h2>
              <button className="modal-close" onClick={() => setQrModal(null)}>&times;</button>
            </div>
            <img src={qrModal.qrCode} alt={`QR for table ${qrModal.tableNumber}`} style={{ width: 240, height: 240, display: 'block', margin: '0 auto 1rem' }} />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all', marginBottom: '1rem' }}>
              {qrModal.url}
            </p>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setQrModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={downloadQR}>Download PNG</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
