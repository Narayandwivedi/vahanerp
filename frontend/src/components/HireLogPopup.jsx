import { useMemo, useState } from 'react';
import { CalendarOff, Fuel, Gauge, Pencil, PlayCircle, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import { addDays, formatDate, formatNumber, formatRupees, round2, toDayInput, todayInput, toNumber } from '../utils/format';
import FormPopup from './FormPopup';
import FormSection from './FormSection';
import Segmented from './Segmented';
import MonthFilter from './MonthFilter';
import { Field, MoneyInput, RowAction, TD, TH } from './ui';

const daysInMonth = (month) => {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 0)).getUTCDate();
};

const blankEntry = (date) => ({ date, status: 'running', odometer: '', fuelLitres: '', fuelAmount: '', notes: '' });

/**
 * Day by day log of one monthly hire: whether the vehicle ran or was off, its odometer, and the fuel given.
 * An "off" day comes out of the rent (monthly rent × off days ÷ days in that month) everywhere: list, ledger, reports.
 */
export default function HireLogPopup({ contract, month: startMonth, onClose, onChanged }) {
  const [log, setLog] = useState(contract.dailyLog || []);
  const [month, setMonth] = useState(startMonth);
  const [editingId, setEditingId] = useState('');
  const [saving, setSaving] = useState(false);

  // The next day to log: the day after the last entry (not past today), or today
  const nextDay = (entries) => {
    const today = todayInput();
    const last = entries.map((entry) => toDayInput(entry.date)).sort().pop();
    const next = last ? addDays(last, 1) : toDayInput(contract.startDate);
    const end = contract.endDate ? toDayInput(contract.endDate) : today;
    const cap = end < today ? end : today;
    return next > cap ? cap : next;
  };
  const [form, setForm] = useState(() => blankEntry(nextDay(contract.dailyLog || [])));
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // Every entry with the km run since the last odometer reading before it
  const rows = useMemo(() => {
    const sorted = [...log].sort((a, b) => toDayInput(a.date).localeCompare(toDayInput(b.date)));
    let lastReading = 0;
    return sorted.map((entry) => {
      const km = entry.odometer > 0 && lastReading > 0 ? entry.odometer - lastReading : null;
      if (entry.odometer > 0) lastReading = entry.odometer;
      return { ...entry, km };
    });
  }, [log]);

  const monthRows = rows.filter((entry) => toDayInput(entry.date).startsWith(month));
  const offDays = monthRows.filter((entry) => entry.status === 'off').length;
  const runDays = monthRows.length - offDays;
  const km = monthRows.reduce((total, entry) => total + (entry.km || 0), 0);
  const litres = round2(monthRows.reduce((total, entry) => total + toNumber(entry.fuelLitres), 0));
  const fuelAmount = round2(monthRows.reduce((total, entry) => total + toNumber(entry.fuelAmount), 0));
  const offAmount = round2((toNumber(contract.monthlyRate) * offDays) / daysInMonth(month));
  const lastReading = [...rows].reverse().find((entry) => entry.odometer > 0)?.odometer;

  const isHireIn = contract.direction === 'hire_in';

  const afterSave = (dailyLog, message) => {
    setLog(dailyLog);
    setEditingId('');
    setForm(blankEntry(nextDay(dailyLog)));
    toast.success(message);
    onChanged?.();
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const response = editingId
        ? await apiClient.put(`/contracts/${contract._id}/logs/${editingId}`, form)
        : await apiClient.post(`/contracts/${contract._id}/logs`, form);
      afterSave(response.dailyLog, editingId ? 'Day updated' : 'Day added');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      date: toDayInput(entry.date),
      status: entry.status,
      odometer: entry.odometer || '',
      fuelLitres: entry.fuelLitres || '',
      fuelAmount: entry.fuelAmount || '',
      notes: entry.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditingId('');
    setForm(blankEntry(nextDay(log)));
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Remove ${formatDate(entry.date)} from the log?`)) return;
    try {
      const response = await apiClient.delete(`/contracts/${contract._id}/logs/${entry._id}`);
      if (editingId === entry._id) setEditingId('');
      afterSave(response.dailyLog, 'Removed');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const minDay = toDayInput(contract.startDate);
  const maxDay = contract.endDate && toDayInput(contract.endDate) < todayInput() ? toDayInput(contract.endDate) : todayInput();

  return (
    <FormPopup
      title={`Daily Log · ${contract.vehicleId?.vehicleNo || contract.contractNo}`}
      subtitle={`${contract.contractNo} · ${isHireIn ? 'Hired from' : 'Given to'} ${contract.partyId?.name || ''} · ${formatRupees(contract.monthlyRate)}/month`}
      maxWidth="max-w-4xl"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={editingId ? 'Save Day' : 'Add Day'}
      submitDisabled={saving}
      footerExtra={editingId ? (
        <button type="button" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800" onClick={cancelEdit}><X size={14} /> Stop editing</button>
      ) : null}
    >
      <FormSection number={1} title={editingId ? `Edit ${formatDate(form.date)}` : 'Add a Day'} tone={form.status === 'off' ? 'rose' : 'blue'} hint="An off day is taken out of the rent">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          <Field label="Date" required htmlFor="hl-date">
            <input id="hl-date" type="date" className="input" value={form.date} min={minDay} max={maxDay} onChange={(event) => set('date', event.target.value)} required />
          </Field>
          <Field label="Vehicle">
            <Segmented
              className="w-full self-stretch"
              value={form.status}
              onChange={(value) => set('status', value)}
              options={[{ key: 'running', label: 'Running', icon: PlayCircle }, { key: 'off', label: 'Off (not run)', shortLabel: 'Off', icon: CalendarOff }]}
            />
          </Field>
          <Field label="Odometer" hint={lastReading ? `Last reading: ${formatNumber(lastReading, 0)} km` : 'Reading at the end of the day'}>
            <MoneyInput prefix="" suffix="km" value={form.odometer} onChange={(value) => set('odometer', value)} />
          </Field>
          <Field label="Fuel Given (Diesel / Petrol)">
            <MoneyInput prefix="" suffix="litres" value={form.fuelLitres} onChange={(value) => set('fuelLitres', value)} />
          </Field>
          <Field label="Fuel Amount">
            <MoneyInput value={form.fuelAmount} onChange={(value) => set('fuelAmount', value)} />
          </Field>
          <Field label="Notes" htmlFor="hl-notes">
            <input id="hl-notes" className="input" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder={form.status === 'off' ? 'Why off: breakdown, holiday…' : 'Site, work done…'} />
          </Field>
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800">Log for the month</h3>
        <MonthFilter value={month} onChange={setMonth} />
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Tile label="Running Days" value={runDays} />
        <Tile label="Off Days" value={offDays} hint={offDays ? `−${formatRupees(offAmount)} rent` : 'No cut'} tone={offDays ? 'text-rose-700' : ''} />
        <Tile icon={Gauge} label="Km Run" value={`${formatNumber(km, 0)} km`} />
        <Tile icon={Fuel} label="Fuel" value={`${formatNumber(litres)} L`} hint={formatRupees(fuelAmount)} />
        <Tile label="Mileage" value={litres > 0 && km > 0 ? `${formatNumber(km / litres)} km/L` : '—'} />
      </div>

      {monthRows.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">Nothing logged in this month yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr>
                <th className={TH}>Date</th>
                <th className={TH}>Vehicle</th>
                <th className={`${TH} text-right`}>Odometer</th>
                <th className={`${TH} text-right`}>Km</th>
                <th className={`${TH} text-right`}>Fuel</th>
                <th className={TH}>Notes</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {monthRows.map((entry) => (
                <tr key={entry._id} className={`tbl-row ${editingId === entry._id ? 'bg-blue-50/60' : ''}`}>
                  <td className={`${TD} whitespace-nowrap`}>{formatDate(entry.date)}</td>
                  <td className={TD}>{entry.status === 'off' ? <span className="badge-red">Off</span> : <span className="badge-green">Running</span>}</td>
                  <td className={`${TD} text-right font-mono`}>{entry.odometer > 0 ? formatNumber(entry.odometer, 0) : '—'}</td>
                  <td className={`${TD} text-right`}>{entry.km !== null ? formatNumber(entry.km, 0) : '—'}</td>
                  <td className={`${TD} whitespace-nowrap text-right`}>
                    {entry.fuelLitres > 0 || entry.fuelAmount > 0 ? (
                      <>
                        <p>{formatNumber(entry.fuelLitres)} L</p>
                        {entry.fuelAmount > 0 && <p className="text-xs text-slate-500">{formatRupees(entry.fuelAmount)}</p>}
                      </>
                    ) : '—'}
                  </td>
                  <td className={`${TD} text-xs text-slate-600`}>{entry.notes}</td>
                  <td className={TD}>
                    <div className="flex justify-end">
                      <RowAction title="Edit" icon={Pencil} onClick={() => startEdit(entry)} />
                      <RowAction title="Remove" icon={Trash2} tone="rose" onClick={() => handleDelete(entry)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FormPopup>
  );
}

function Tile({ icon: Icon, label, value, hint, tone = '' }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{Icon && <Icon size={12} />} {label}</p>
      <p className={`text-base font-bold ${tone || 'text-slate-900'}`}>{value}</p>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
