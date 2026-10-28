import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import Icon from '../../components/Icon';
import Stat from '../../components/Stat';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useAmountMask, useLiveReload, usePolling } from '../../hooks';
import { presetRange } from '../../lib/dates';
import { billLabel, formatQty, formatTime, orderPlace, STATUS_LABEL } from '../../lib/format';
import { CHART } from '../../lib/chart';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  // Every amount on this page goes through `money`, so one toggle masks them all
  const { show: money, hidden, toggle } = useAmountMask();

  // Ranges are recomputed on each poll so "today" rolls over at midnight
  const load = useCallback(() => Promise.all([
    api.reports.summary(presetRange('today')),
    api.reports.summary(presetRange('7d')),
    api.orders.list({ ...presetRange('today'), limit: 300 }),
    api.tables.getAll(),
  ]), []);
  const { data, error, loading, retry, reload } = usePolling(load, 60_000);
  // Sales, kitchen and stock figures refresh the moment something happens
  useLiveReload(reload, ['order.created', 'order.updated', 'stock.low'], 1500);

  if (loading && !data) return <LoadingState label="Loading dashboard…" />;
  if (!data) return <ErrorState error={error} onRetry={retry} />;

  const [today, week, todaysOrders, tables] = data;
  const recent = todaysOrders.slice(0, 8);
  const t = today.totals;
  const occupied = tables.filter((x) => x.openOrders > 0).length;
  const openAmount = tables.reduce((s, x) => s + x.openAmount, 0);
  const inKitchen = todaysOrders.filter((o) => !o.parentId && (o.status === 'pending' || o.status === 'cooking')).length;

  return (
    <>
      <PageHeader
        icon="dashboard"
        title="Dashboard"
        subtitle={new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={toggle}
              aria-pressed={hidden}
              title={hidden ? 'Show amounts' : 'Hide amounts (e.g. when guests can see the screen)'}
            >
              <Icon name={hidden ? 'eye' : 'eyeOff'} size={16} /> {hidden ? 'Show amounts' : 'Hide amounts'}
            </button>
            <Link to="/pos" className="btn btn-flame"><Icon name="plus" size={16} /> New order</Link>
          </>
        }
      />

      <section className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-kicker">{greeting()}</div>
          <div className="hero-title">Today's sales</div>
          <div className="hero-amount">{money(t.netSales)}</div>
          <p className="hero-sub">
            {t.orders} orders · {t.itemsSold} items sold{t.cancelled ? ` · ${t.cancelled} cancelled` : ''}
          </p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><div className="hero-stat-label">Collected</div><div className="hero-stat-value">{money(t.collected)}</div></div>
          <div className="hero-stat"><div className="hero-stat-label">Average bill</div><div className="hero-stat-value">{money(t.averageTicket)}</div></div>
          <div className="hero-stat"><div className="hero-stat-label">Gross profit</div><div className="hero-stat-value">{money(t.grossProfit)}</div></div>
          <div className="hero-stat"><div className="hero-stat-label">Discounts</div><div className="hero-stat-value">{money(t.discounts)}</div></div>
        </div>
      </section>

      <div className="stats-grid">
        <Stat label="Open bills" value={money(openAmount)} hint={`${occupied} table${occupied === 1 ? '' : 's'} waiting to pay`} tone="primary" />
        <Stat label="Tables occupied" value={`${occupied} / ${tables.length}`} tone="accent" />
        <Stat label="In the kitchen" value={inKitchen} tone="warning" />
        <Stat label="Low inventory items" value={today.stock.lowStock.length} hint={`Inventory value ${money(today.stock.value)}`} tone={today.stock.lowStock.length ? 'primary' : 'success'} />
      </div>

      <div className="chart-grid">
        <section className="card span-2">
          <div className="card-header"><h2 className="card-title">Last 7 days</h2><Link to="/reports" className="subtle">Full reports →</Link></div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={week.byDay.map((d) => ({ ...d, label: new Date(d.date + 'T00:00').toLocaleDateString([], { weekday: 'short' }) }))} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" tick={CHART.tick} axisLine={false} tickLine={false} />
              <YAxis tick={CHART.tick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => (hidden ? '•••' : String(v))} />
              <Tooltip cursor={{ fill: CHART.cursor }} formatter={(v) => money(Number(v))} />
              <Bar dataKey="sales" name="Sales" fill={CHART.primary} radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card">
          <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Top sellers today</h2>
          {today.topItems.length === 0 ? (
            <EmptyState icon="burger" title="No sales yet" />
          ) : (
            <ol className="rank-list">
              {today.topItems.slice(0, 6).map((i) => (
                <li key={i.name}>
                  <span className="spacer">{i.name}</span>
                  <span className="badge badge-accent">× {i.quantity}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="chart-grid">
        <section className="card span-2">
          <div className="card-header"><h2 className="card-title">Recent orders</h2><Link to="/orders" className="subtle">All orders →</Link></div>
          {recent.length === 0 ? (
            <EmptyState icon="orders" title="No orders yet today" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Bill</th><th>Where</th><th>Time</th><th>Status</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.id} className={o.status === 'cancelled' ? 'is-muted' : undefined}>
                      <td className="bill-no">{billLabel(o)}</td>
                      <td>{orderPlace(o)}</td>
                      <td className="muted">{formatTime(o.createdAt)}</td>
                      <td><span className={`badge badge-${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                      <td className="num">{money(o.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Low inventory</h2><Link to="/inventory" className="subtle">Inventory →</Link></div>
          {today.stock.lowStock.length === 0 ? (
            <EmptyState icon="stock" title="Inventory is all good" />
          ) : (
            <ul className="line-items">
              {today.stock.lowStock.slice(0, 8).map((s) => (
                <li key={s.id}>
                  <span><Icon name="alert" size={14} /> {s.name}</span>
                  <span className="danger-text nowrap">{formatQty(s.quantity)} {s.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
