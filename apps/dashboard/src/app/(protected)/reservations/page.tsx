'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReservationDTO, ReservationStatus, TableDTO } from '@pubster/shared';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api-client';
import { formatDateLabel, formatTimeUtc, todayUtcDate } from '@/lib/format';

const STATUS_BADGE: Record<ReservationStatus, string> = {
  pending: 'badge-neutral',
  confirmed: 'badge-info',
  seated: 'badge-success',
  completed: 'badge-neutral',
  cancelled: 'badge-danger',
  no_show: 'badge-warning',
};

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: 'pending',
  confirmed: 'confirmed',
  seated: 'seated',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'no show',
};

/** Active statuses that count toward expected covers/occupancy. */
const ACTIVE_STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'seated'];

export default function ReservationsPage() {
  const { user } = useAuth();
  const pubId = user?.pubId ?? null;
  const date = todayUtcDate();

  const [reservations, setReservations] = useState<ReservationDTO[]>([]);
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!pubId) return;
    setLoading(true);
    setError(null);
    try {
      const [res, tbls] = await Promise.all([
        api.listPubReservations(pubId, date),
        api.listTables(pubId),
      ]);
      res.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setReservations(res);
      setTables(tbls);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load reservations.');
    } finally {
      setLoading(false);
    }
  }, [pubId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (id: string, status: 'seated' | 'completed' | 'no_show') => {
    setPendingId(id);
    setError(null);
    try {
      const updated = await api.setReservationStatus(id, { status });
      setReservations((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update reservation.');
    } finally {
      setPendingId(null);
    }
  };

  const summary = useMemo(() => {
    const capacity = tables.filter((t) => t.isActive).reduce((sum, t) => sum + t.seats, 0);
    const active = reservations.filter((r) => ACTIVE_STATUSES.includes(r.status));
    const expectedGuests = active.reduce((sum, r) => sum + r.partyCount, 0);
    const seated = reservations.filter((r) => r.status === 'seated');
    const seatedGuests = seated.reduce((sum, r) => sum + r.partyCount, 0);
    const occupancy = capacity > 0 ? Math.round((seatedGuests / capacity) * 100) : 0;
    return {
      total: reservations.length,
      expectedGuests,
      seatedCount: seated.length,
      seatedGuests,
      capacity,
      occupancy,
    };
  }, [reservations, tables]);

  if (!pubId) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Reservations</h1>
          </div>
        </div>
        <div className="card card-pad empty-state">
          Your account isn’t assigned to a pub, so there are no reservations to show.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Today’s reservations</h1>
          <p className="page-subtitle">{formatDateLabel(date)} · times shown in UTC</p>
        </div>
        <button className="btn" onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Reservations</div>
          <div className="stat-value">{summary.total}</div>
          <div className="stat-hint">booked today</div>
        </div>
        <div className="stat">
          <div className="stat-label">Expected guests</div>
          <div className="stat-value">{summary.expectedGuests}</div>
          <div className="stat-hint">active reservations</div>
        </div>
        <div className="stat">
          <div className="stat-label">Seated now</div>
          <div className="stat-value">{summary.seatedGuests}</div>
          <div className="stat-hint">{summary.seatedCount} reservations</div>
        </div>
        <div className="stat">
          <div className="stat-label">Occupancy</div>
          <div className="stat-value">{summary.occupancy}%</div>
          <div className="stat-hint">
            {summary.seatedGuests}/{summary.capacity} seats
          </div>
        </div>
      </div>

      <div className="card">
        {loading && reservations.length === 0 ? (
          <div className="empty-state">Loading reservations…</div>
        ) : reservations.length === 0 ? (
          <div className="empty-state">No reservations for today.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Party</th>
                <th>Table size</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id}>
                  <td>
                    {formatTimeUtc(r.startTime)}
                    <span className="muted"> – {formatTimeUtc(r.endTime)}</span>
                  </td>
                  <td>
                    {r.partyCount} {r.partyCount === 1 ? 'guest' : 'guests'}
                  </td>
                  <td>{r.seats}-seat</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td>
                    <ReservationActions
                      reservation={r}
                      busy={pendingId === r.id}
                      onChange={changeStatus}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function ReservationActions({
  reservation,
  busy,
  onChange,
}: {
  reservation: ReservationDTO;
  busy: boolean;
  onChange: (id: string, status: 'seated' | 'completed' | 'no_show') => void;
}) {
  const { id, status } = reservation;
  const canSeat = status === 'pending' || status === 'confirmed';
  const canComplete = status === 'seated';
  const canNoShow = status === 'pending' || status === 'confirmed';

  if (!canSeat && !canComplete && !canNoShow) {
    return <span className="muted">—</span>;
  }

  return (
    <div className="row-actions">
      {canSeat && (
        <button
          className="btn btn-sm btn-primary"
          disabled={busy}
          onClick={() => onChange(id, 'seated')}
        >
          Seat
        </button>
      )}
      {canComplete && (
        <button
          className="btn btn-sm btn-primary"
          disabled={busy}
          onClick={() => onChange(id, 'completed')}
        >
          Complete
        </button>
      )}
      {canNoShow && (
        <button
          className="btn btn-sm btn-danger"
          disabled={busy}
          onClick={() => onChange(id, 'no_show')}
        >
          No-show
        </button>
      )}
    </div>
  );
}
