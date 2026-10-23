import { useCallback, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, type DateRange } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import Icon from '../../components/Icon';
import RangePicker from '../../components/RangePicker';
import Stat from '../../components/Stat';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant } from '../../hooks';
import { CHART } from '../../lib/chart';
import { presetRange, RANGE_LABEL, type RangePreset } from '../../lib/dates';
import { downloadCsv, ORDER_TYPE_LABEL, PAYMENT_LABEL } from '../../lib/format';
import type { OrderType, PaymentMethod } from '../../types';

export default function Reports() {
  const { money, restaurant } = useRestaurant();
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [range, setRange] = useState<DateRange>(() => presetRange('7d'));

  const load = useCallback(() => api.reports.summary(range), [range]);
  const { data: report, error, loading, retry } = usePolling(load, 60_000);

  const header = (
    <PageHeader
      icon="reports"
      title="Reports"
      subtitle="Sales, profit, payments and best sellers for any period"
      actions={report && (
        <>
          <button className="btn btn-secondary" onClick={() => downloadCsv(`sales-${report.byDay[0]?.date}-to-${report.byDay.at(-1)?.date}.csv`, [
            ['Date', 'Orders', `Sales (${restaurant.currency})`],
            ...report.byDay.map((d) => [d.date, d.orders, d.sales]),
          ])}>
            <Icon name="download" size={16} /> Daily sales CSV
          </button>
          <button className="btn btn-secondary" onClick={() => downloadCsv('top-items.csv', [
            ['Item', 'Quantity', `Revenue (${restaurant.currency})`],
            ...report.topItems.map((i) => [i.name, i.quantity, i.revenue]),
          ])}>
            <Icon name="download" size={16} /> Items CSV
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}><Icon name="print" size={16} /> Print</button>
        </>
      )}
    />
  );

  const picker = (
    <div className="toolbar">
      <RangePicker preset={preset} onChange={(p, r) => { setPreset(p); setRange(r); }} />
    </div>
  );

  if (loading && !report) return <>{header}{picker}<LoadingState label="Crunching numbers…" /></>;
  if (!report) return <>{header}{picker}<ErrorState error={error} onRetry={retry} /></>;

  const t = report.totals;
  const dayLabel = (date: string) => new Date(date + 'T00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
  const busyHours = report.byHour.filter((h) => h.orders > 0);

  return (
    <div className="print-area">
      {header}
      {picker}

      <section className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-kicker">{preset === 'custom' ? 'Custom period' : RANGE_LABEL[preset]}</div>
          <div className="hero-title">Net sales</div>
          <div className="hero-amount">{money(t.netSales)}</div>
          <p className="hero-sub">{t.orders} orders · {t.itemsSold} items · average bill {money(t.averageTicket)}</p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><div className="hero-stat-label">Gross profit</div><div className="hero-stat-value">{money(t.grossProfit)}</div></div>
          <div className="hero-stat"><div className="hero-stat-label">Cost of goods</div><div className="hero-stat-value">{money(t.costOfGoods)}</div></div>
          <div className="hero-stat"><div className="hero-stat-label">Collected</div><div className="hero-stat-value">{money(t.collected)}</div></div>
          <div className="hero-stat"><div className="hero-stat-label">Outstanding</div><div className="hero-stat-value">{money(t.outstanding)}</div></div>
        </div>
      </section>

      <div className="stats-grid">
        <Stat label="Gross sales" value={money(t.grossSales)} hint="Before discounts and charges" tone="primary" />
        <Stat label="Discounts" value={money(t.discounts)} tone="warning" />
        <Stat label="Service charge" value={money(t.serviceCharge)} tone="accent" />
        <Stat label="VAT collected" value={money(t.tax)} tone="accent" />
        <Stat label="Purchases" value={money(t.purchases)} hint={t.purchasesUnpaid ? `${money(t.purchasesUnpaid)} unpaid` : 'All paid'} tone="primary" />
        <Stat label="Cancelled orders" value={t.cancelled} tone={t.cancelled ? 'warning' : 'success'} />
      </div>

      {t.orders === 0 ? (
        <div className="card"><EmptyState icon="reports" title="No sales in this period" text="Pick another date range to see results." /></div>
      ) : (
        <>
          <div className="chart-grid">
            <section className="card span-2">
              <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Sales by day</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={report.byDay.map((d) => ({ ...d, label: dayLabel(d.date) }))} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="label" tick={CHART.tick} axisLine={false} tickLine={false} minTickGap={12} />
                  <YAxis tick={CHART.tick} axisLine={false} tickLine={false} width={60} />
                  <Tooltip cursor={{ fill: CHART.cursor }} formatter={(v, name) => (name === 'Sales' ? money(Number(v)) : v)} />
                  <Bar dataKey="sales" name="Sales" fill={CHART.primary} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="card">
              <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Payment methods</h2>
              {report.byPayment.length === 0 ? <EmptyState icon="cash" title="Nothing collected yet" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={report.byPayment.map((p) => ({ name: PAYMENT_LABEL[p.method as PaymentMethod] ?? p.method, value: p.amount }))}
                      dataKey="value" innerRadius={58} outerRadius={90} paddingAngle={report.byPayment.length > 1 ? 3 : 0} isAnimationActive={false}
                    >
                      {report.byPayment.map((p, i) => <Cell key={p.method} fill={CHART.series[i % CHART.series.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => money(Number(v))} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>

          <div className="chart-grid">
            <section className="card">
              <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Sales by category</h2>
              <ResponsiveContainer width="100%" height={Math.max(160, report.byCategory.length * 36)}>
                <BarChart data={report.byCategory} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={CHART.tick} axisLine={false} tickLine={false} width={90} />
                  <Tooltip cursor={{ fill: CHART.cursor }} formatter={(v) => money(Number(v))} />
                  <Bar dataKey="amount" name="Sales" fill={CHART.orange} radius={[0, 6, 6, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="card">
              <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Busiest hours</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={report.byHour.slice(Math.min(...busyHours.map((h) => h.hour)), Math.max(...busyHours.map((h) => h.hour)) + 1)
                    .map((h) => ({ ...h, label: `${String(h.hour).padStart(2, '0')}:00` }))}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                >
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="label" tick={CHART.tick} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART.tick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: CHART.cursor }} />
                  <Bar dataKey="orders" name="Orders" fill={CHART.accent} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="card">
              <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Dine-in vs takeaway</h2>
              <ul className="line-items">
                {report.byType.map((x) => (
                  <li key={x.type}>
                    <span>{ORDER_TYPE_LABEL[x.type as OrderType] ?? x.type}</span>
                    <strong>{money(x.amount)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="card">
            <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Top selling items</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Item</th><th className="num">Qty sold</th><th className="num">Revenue</th><th className="num">Share</th></tr></thead>
                <tbody>
                  {report.topItems.map((i, idx) => (
                    <tr key={i.name}>
                      <td className="bill-no">{idx + 1}</td>
                      <td><strong>{i.name}</strong></td>
                      <td className="num">{i.quantity}</td>
                      <td className="num">{money(i.revenue)}</td>
                      <td className="num muted">{t.grossSales ? Math.round((i.revenue / t.grossSales) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
