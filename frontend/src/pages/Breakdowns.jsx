import { useState } from 'react';
import { AlertTriangle, Clock, IndianRupee, Plus, Wrench } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import useMasters from '../utils/useMasters';
import { currentMonthInput, formatRupees, monthBounds } from '../utils/format';
import { BREAKDOWN_CATEGORIES, formatDowntime, summarizeBreakdowns } from '../utils/breakdown';
import StatCard from '../components/StatCard';
import MonthFilter from '../components/MonthFilter';
import Segmented from '../components/Segmented';
import BreakdownPopup from '../components/BreakdownPopup';
import BreakdownTable from '../components/BreakdownTable';
import { OptionSelect, VehicleSelect } from '../components/Pickers';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader } from '../components/ui';

const STATUS_FILTERS = [
  { value: '', label: 'Any status' },
  { value: 'open', label: 'Standing' },
  { value: 'under_repair', label: 'Under Repair' },
  { value: 'resolved', label: 'Repaired' },
];

// Breakdown ledger: every breakdown with its cause, trip, downtime and repair cost
export default function Breakdowns() {
  const [period, setPeriod] = useState('month');
  const [month, setMonth] = useState(currentMonthInput());
  const [vehicleId, setVehicleId] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [onTrip, setOnTrip] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const { vehicles } = useMasters();
  const params = { ...(period === 'month' ? monthBounds(month) : {}), vehicleId, status, category, onTrip, search };
  const { data, loading, error, reload } = useFetch('/breakdowns', params, []);

  const list = data || [];
  const summary = summarizeBreakdowns(list);

  // Which vehicles break down most, by cost
  const byVehicle = Object.values(list.reduce((acc, row) => {
    const key = row.vehicleId?._id || 'none';
    acc[key] = acc[key] || { vehicleNo: row.vehicleId?.vehicleNo || '—', count: 0, cost: 0 };
    acc[key].count += 1;
    acc[key].cost += row.totalCost || 0;
    return acc;
  }, {})).sort((a, b) => b.cost - a.cost);

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete breakdown ${row.breakdownNo}? Its repair expenses are deleted too.`)) return;
    try {
      await apiClient.delete(`/breakdowns/${row._id}`);
      toast.success('Breakdown deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page>
      <PageHeader title="Breakdowns" subtitle="Breakdown ledger: cause, trip, downtime and repair cost of every vehicle">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}><Plus size={18} /> Add Breakdown</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Wrench} tone="amber" label="Breakdowns" value={summary.count} hint={`${summary.onTrip} on a trip`} />
        <StatCard compact icon={IndianRupee} tone="rose" label="Repair Cost" value={formatRupees(summary.cost)} hint={summary.due > 0 ? `${formatRupees(summary.due)} due to workshops` : 'All paid'} />
        <StatCard compact icon={Clock} tone="indigo" label="Downtime" value={formatDowntime(summary.hours)} hint="Vehicle off the road" />
        <StatCard compact icon={AlertTriangle} tone={summary.open ? 'rose' : 'emerald'} label="Not Repaired" value={summary.open} hint={summary.topCause ? `Most common: ${summary.topCause}` : ''} />
      </section>

      {(summary.causes.length > 0 || byVehicle.length > 1) && (
        <div className="space-y-2">
          {summary.causes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {summary.causes.map((cause) => (
                <button
                  key={cause.key}
                  type="button"
                  onClick={() => setCategory(category === cause.key ? '' : cause.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${category === cause.key ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white text-slate-700 ring-slate-200'}`}
                >
                  {cause.label} × {cause.count} <span className={category === cause.key ? '' : 'text-rose-700'}>{formatRupees(cause.cost)}</span>
                </button>
              ))}
            </div>
          )}
          {byVehicle.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {byVehicle.slice(0, 8).map((row) => (
                <span key={row.vehicleNo} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  <span className="font-mono">{row.vehicleNo}</span> × {row.count} <span className="text-rose-700">{formatRupees(row.cost)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <section className="panel">
        <PanelHeader title="Breakdown Ledger" count={list.length} search={search} onSearch={setSearch} searchPlaceholder="Search no, reason, place" onRefresh={reload} loading={loading}>
          <div className="w-44"><VehicleSelect vehicles={vehicles} value={vehicleId} onChange={setVehicleId} allowEmpty emptyLabel="All vehicles" includeSold /></div>
          <div className="w-40"><OptionSelect options={[{ value: '', label: 'Any cause' }, ...BREAKDOWN_CATEGORIES]} value={category} onChange={setCategory} ariaLabel="Cause" /></div>
          <div className="w-36"><OptionSelect options={STATUS_FILTERS} value={status} onChange={setStatus} ariaLabel="Status" /></div>
          <div className="w-36"><OptionSelect options={[{ value: '', label: 'Trip or not' }, { value: 'true', label: 'On a trip' }, { value: 'false', label: 'Not on a trip' }]} value={onTrip} onChange={setOnTrip} ariaLabel="On a trip" /></div>
          <Segmented value={period} onChange={setPeriod} options={[{ key: 'month', label: 'Month' }, { key: 'all', label: 'All time' }]} />
          {period === 'month' && <MonthFilter value={month} onChange={setMonth} />}
        </PanelHeader>
        {loading && !list.length ? <Loading /> : list.length === 0 ? <EmptyState title="No breakdowns" hint="Record a breakdown when a vehicle stops on the road" /> : (
          <BreakdownTable rows={list} onEdit={setEditing} onDelete={handleDelete} />
        )}
      </section>

      {editing && <BreakdownPopup breakdown={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={reload} />}
    </Page>
  );
}
