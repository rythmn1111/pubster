'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { TableDTO, UpdateTableRequest } from '@pubster/shared';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api-client';

export default function TablesPage() {
  const { user } = useAuth();
  const pubId = user?.pubId ?? null;

  const [tables, setTables] = useState<TableDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add-table form state.
  const [seats, setSeats] = useState('4');
  const [label, setLabel] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!pubId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.listTables(pubId);
      list.sort((a, b) => a.seats - b.seats || (a.label ?? '').localeCompare(b.label ?? ''));
      setTables(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load tables.');
    } finally {
      setLoading(false);
    }
  }, [pubId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const active = tables.filter((t) => t.isActive);
    const capacity = active.reduce((sum, t) => sum + t.seats, 0);
    return { count: tables.length, activeCount: active.length, capacity };
  }, [tables]);

  const onAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pubId) return;
    const seatsNum = Number(seats);
    const qtyNum = Number(quantity);
    if (!Number.isInteger(seatsNum) || seatsNum < 1) {
      setError('Seats must be a whole number of at least 1.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const list = await api.createTables(pubId, {
        seats: seatsNum,
        label: label.trim() ? label.trim() : undefined,
        quantity: Number.isInteger(qtyNum) && qtyNum >= 1 ? qtyNum : 1,
      });
      list.sort((a, b) => a.seats - b.seats || (a.label ?? '').localeCompare(b.label ?? ''));
      setTables(list);
      setLabel('');
      setQuantity('1');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add tables.');
    } finally {
      setAdding(false);
    }
  };

  const onSaveEdit = async (id: string, patch: UpdateTableRequest) => {
    setBusyId(id);
    setError(null);
    try {
      const updated = await api.updateTable(id, patch);
      setTables((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update table.');
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('Delete this table? This reduces the pub’s inventory.')) return;
    setBusyId(id);
    setError(null);
    try {
      await api.deleteTable(id);
      setTables((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete table.');
    } finally {
      setBusyId(null);
    }
  };

  if (!pubId) {
    return (
      <>
        <div className="page-header">
          <h1>Tables</h1>
        </div>
        <div className="card card-pad empty-state">
          Your account isn’t assigned to a pub, so there’s no table inventory to manage.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Table inventory</h1>
          <p className="page-subtitle">Add, edit, and remove tables from the pool.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Tables</div>
          <div className="stat-value">{summary.count}</div>
          <div className="stat-hint">{summary.activeCount} active</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total capacity</div>
          <div className="stat-value">{summary.capacity}</div>
          <div className="stat-hint">seats across active tables</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <h2 className="section-title">Add tables</h2>
        <form className="form-row" onSubmit={onAdd}>
          <div className="field" style={{ width: 110 }}>
            <label htmlFor="seats">Seats</label>
            <input
              id="seats"
              className="input"
              type="number"
              min={1}
              max={50}
              required
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
            />
          </div>
          <div className="field" style={{ width: 130 }}>
            <label htmlFor="quantity">Quantity</label>
            <input
              id="quantity"
              className="input"
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor="label">Label (optional)</label>
            <input
              id="label"
              className="input"
              type="text"
              maxLength={120}
              placeholder="e.g. Window booth"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={adding}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
      </div>

      <div className="card">
        {loading && tables.length === 0 ? (
          <div className="empty-state">Loading tables…</div>
        ) : tables.length === 0 ? (
          <div className="empty-state">No tables yet. Add your first table above.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Seats</th>
                <th>Label</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) =>
                editingId === t.id ? (
                  <EditRow
                    key={t.id}
                    table={t}
                    busy={busyId === t.id}
                    onSave={(patch) => onSaveEdit(t.id, patch)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <tr key={t.id}>
                    <td>{t.seats}</td>
                    <td>{t.label ?? <span className="muted">—</span>}</td>
                    <td>
                      <span className={t.isActive ? 'badge badge-success' : 'badge badge-neutral'}>
                        {t.isActive ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn-sm"
                          disabled={busyId === t.id}
                          onClick={() => setEditingId(t.id)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={busyId === t.id}
                          onClick={() => void onDelete(t.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function EditRow({
  table,
  busy,
  onSave,
  onCancel,
}: {
  table: TableDTO;
  busy: boolean;
  onSave: (patch: UpdateTableRequest) => void;
  onCancel: () => void;
}) {
  const [seats, setSeats] = useState(String(table.seats));
  const [label, setLabel] = useState(table.label ?? '');
  const [isActive, setIsActive] = useState(table.isActive);

  const save = () => {
    const seatsNum = Number(seats);
    const patch: UpdateTableRequest = {};
    if (Number.isInteger(seatsNum) && seatsNum >= 1 && seatsNum !== table.seats) {
      patch.seats = seatsNum;
    }
    const trimmed = label.trim();
    const nextLabel = trimmed ? trimmed : null;
    if (nextLabel !== table.label) patch.label = nextLabel;
    if (isActive !== table.isActive) patch.isActive = isActive;

    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }
    onSave(patch);
  };

  return (
    <tr>
      <td>
        <input
          className="input"
          type="number"
          min={1}
          max={50}
          style={{ width: 80 }}
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
        />
      </td>
      <td>
        <input
          className="input"
          type="text"
          maxLength={120}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="—"
        />
      </td>
      <td>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </td>
      <td>
        <div className="row-actions">
          <button className="btn btn-sm btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button className="btn btn-sm" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}
