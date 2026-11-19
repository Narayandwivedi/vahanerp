import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import useMasters from '../utils/useMasters';
import { formatDate, formatRupees, idOf, round2, toDayInput, todayInput, toNumber } from '../utils/format';
import { meterUnitOf } from '../utils/meter';
import { BREAKDOWN_CATEGORIES, COST_HEADS, downtimeHours, formatDowntime } from '../utils/breakdown';
import FormPopup from './FormPopup';
import PartyPopup from './PartyPopup';
import Segmented from './Segmented';
import FormSection, { AddLink, FieldGrid } from './FormSection';
import { DriverSelect, OptionSelect, PartySelect, SearchableSelect, VehicleSelect } from './Pickers';
import { Field, MoneyInput } from './ui';

const STATUS_OPTIONS = [
  { key: 'open', label: 'Standing' },
  { key: 'under_repair', label: 'Under Repair' },
  { key: 'resolved', label: 'Repaired' },
];
const emptyCost = () => ({ head: 'parts', amount: '', notes: '' });

// A vehicle breakdown: when, where, why, on a trip or not, how long it stood and what the repair cost
export default function BreakdownPopup({ breakdown = null, preset = {}, onClose, onSaved }) {
  const { vehicles, parties, reload: reloadParties } = useMasters();
  const { data: drivers } = useFetch('/payroll/employees', { role: 'driver' }, []);
  const [form, setForm] = useState(() => (breakdown
    ? {
      ...breakdown,
      date: toDayInput(breakdown.date),
      resolvedDate: toDayInput(breakdown.resolvedDate),
      vehicleId: idOf(breakdown.vehicleId),
      tripId: idOf(breakdown.tripId),
      driverId: idOf(breakdown.driverId),
      workshopPartyId: idOf(breakdown.workshopPartyId),
      odometer: breakdown.odometer || '',
      paidAmount: breakdown.workshopPartyId ? breakdown.paidAmount : '',
      costs: breakdown.costs?.length ? breakdown.costs.map((row) => ({ ...row })) : [emptyCost()],
    }
    : {
      date: todayInput(), time: '', vehicleId: '', onTrip: false, tripId: '', driverId: '', location: '', odometer: '',
      category: '', reason: '', severity: 'minor', status: 'open', resolvedDate: '', resolvedTime: '',
      workshopPartyId: '', repairedBy: '', costs: [emptyCost()], paidAmount: '', mode: 'cash', notes: '', ...preset,
    }));
  const [saving, setSaving] = useState(false);
  const [addingParty, setAddingParty] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const setCost = (index, field, value) => setForm((prev) => ({ ...prev, costs: prev.costs.map((row, i) => (i === index ? { ...row, [field]: value } : row)) }));

  const vehicle = vehicles.find((item) => item._id === form.vehicleId);
  // Trips of this vehicle around the breakdown day, to pick the one it broke down on
  const { data: trips } = useFetch(form.vehicleId && form.onTrip ? '/trips' : null, {
    vehicleId: form.vehicleId,
    from: toDayInput(new Date(new Date(form.date || todayInput()).getTime() - 15 * 86400000)),
    to: form.date || todayInput(),
  }, []);
  const tripItems = (trips || []).map((trip) => ({
    value: trip._id,
    label: trip.tripNo,
    tags: [formatDate(trip.date), [trip.from, trip.to].filter(Boolean).join(' → ')].filter(Boolean).join(' · '),
  }));
  // The breakdown's trip may be older than the list above
  if (form.tripId && breakdown?.tripId?._id === form.tripId && !tripItems.some((item) => item.value === form.tripId)) {
    tripItems.unshift({ value: form.tripId, label: breakdown.tripId.tripNo, tags: formatDate(breakdown.tripId.date) });
  }

  const pickVehicle = (value) => setForm((prev) => ({ ...prev, vehicleId: value, tripId: '' }));
  const pickTrip = (value) => {
    const trip = (trips || []).find((item) => item._id === value);
    setForm((prev) => ({
      ...prev,
      tripId: value,
      driverId: prev.driverId || idOf(trip?.driverId),
      location: prev.location || [trip?.from, trip?.to].filter(Boolean).join(' → '),
    }));
  };

  const total = round2((form.costs || []).reduce((sum, row) => sum + toNumber(row.amount), 0));
  const hasParty = Boolean(form.workshopPartyId);
  const due = hasParty ? Math.max(0, round2(total - toNumber(form.paidAmount))) : 0;
  const stood = downtimeHours(form);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        date: form.date, time: form.time, vehicleId: form.vehicleId, onTrip: form.onTrip, tripId: form.onTrip ? form.tripId : '',
        driverId: form.driverId, location: form.location, odometer: form.odometer, category: form.category || 'other',
        reason: form.reason, severity: form.severity, status: form.status, resolvedDate: form.resolvedDate, resolvedTime: form.resolvedTime,
        workshopPartyId: form.workshopPartyId, repairedBy: form.repairedBy, costs: form.costs, paidAmount: form.paidAmount,
        mode: form.mode, notes: form.notes,
      };
      if (breakdown?._id) await apiClient.put(`/breakdowns/${breakdown._id}`, payload);
      else await apiClient.post('/breakdowns', payload);
      toast.success('Breakdown saved');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPopup
      title={breakdown?._id ? `Edit Breakdown ${breakdown.breakdownNo || ''}` : 'Add Breakdown'}
      subtitle="When, why, on a trip or not, and what the repair cost"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={saving}
      maxWidth="max-w-3xl"
      footerExtra={total > 0 && <span className="font-semibold text-slate-700">Total <span className="text-rose-700">{formatRupees(total)}</span>{due > 0 && <span className="ml-2 text-amber-700">· {formatRupees(due)} due</span>}</span>}
    >
      <FormSection number={1} title="Breakdown" tone="rose">
        <FieldGrid cols={2}>
          <Field label="Vehicle" required>
            <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={pickVehicle} required includeSold={Boolean(breakdown)} />
          </Field>
          <FieldGrid cols={2}>
            <Field label="Date" required htmlFor="bd-date">
              <input id="bd-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
            </Field>
            <Field label="Time" htmlFor="bd-time">
              <input id="bd-time" type="time" className="input" value={form.time} onChange={(event) => set('time', event.target.value)} />
            </Field>
          </FieldGrid>
          <Field label="Broke down on a trip?">
            <Segmented
              value={form.onTrip ? 'yes' : 'no'}
              onChange={(value) => setForm((prev) => ({ ...prev, onTrip: value === 'yes', tripId: value === 'yes' ? prev.tripId : '' }))}
              options={[{ key: 'no', label: 'No' }, { key: 'yes', label: 'Yes, on a trip' }]}
            />
          </Field>
          {form.onTrip ? (
            <Field label="Trip" hint={form.vehicleId ? 'Trips of this vehicle in the 15 days before' : 'Pick the vehicle first'}>
              <SearchableSelect items={tripItems} value={form.tripId} onChange={pickTrip} allowEmpty emptyLabel="Trip not listed" searchPlaceholder="Search trip no." />
            </Field>
          ) : <div className="hidden sm:block" />}
          <Field label="Location" htmlFor="bd-loc">
            <input id="bd-loc" className="input" value={form.location} onChange={(event) => set('location', event.target.value)} placeholder="Highway, village, site…" />
          </Field>
          <Field label="Meter Reading" hint="Optional, updates the meter">
            <MoneyInput prefix="" suffix={meterUnitOf(vehicle)} value={form.odometer} onChange={(value) => set('odometer', value)} />
          </Field>
          <Field label="Driver">
            <DriverSelect drivers={drivers || []} value={form.driverId} onChange={(value) => set('driverId', value)} emptyLabel="No driver" />
          </Field>
          <Field label="Severity">
            <Segmented value={form.severity} onChange={(value) => set('severity', value)} options={[{ key: 'minor', label: 'Minor (on the spot)' }, { key: 'major', label: 'Major (towed / workshop)' }]} />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection number={2} title="Reason" tone="amber">
        <Field label="What broke">
          <div className="flex flex-wrap gap-1.5">
            {BREAKDOWN_CATEGORIES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => set('category', option.value)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition ${form.category === option.value ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Reason / Details" required htmlFor="bd-reason">
          <textarea id="bd-reason" rows={2} className="input resize-none" value={form.reason} onChange={(event) => set('reason', event.target.value)} placeholder="e.g. Clutch plate burnt on the ghat, gearbox jammed" required />
        </Field>
      </FormSection>

      <FormSection number={3} title="Repair" tone="blue" hint={form.status === 'resolved' || form.status === 'open' ? `Stood for ${formatDowntime(stood)}${form.status === 'open' ? ' so far' : ''}` : ''}>
        <Segmented value={form.status} onChange={(value) => set('status', value)} options={STATUS_OPTIONS} />
        <FieldGrid cols={2}>
          {form.status === 'resolved' && (
            <FieldGrid cols={2}>
              <Field label="Repaired On" required htmlFor="bd-rdate">
                <input id="bd-rdate" type="date" className="input" value={form.resolvedDate} min={form.date} onChange={(event) => set('resolvedDate', event.target.value)} required />
              </Field>
              <Field label="Time" htmlFor="bd-rtime">
                <input id="bd-rtime" type="time" className="input" value={form.resolvedTime} onChange={(event) => set('resolvedTime', event.target.value)} />
              </Field>
            </FieldGrid>
          )}
          <Field label="Workshop (party)" hint="Pick one to keep the bill in its ledger" actionNextToLabel action={<AddLink onClick={() => setAddingParty(true)}>New Party</AddLink>}>
            <PartySelect parties={parties} prefer={['supplier']} value={form.workshopPartyId} onChange={(value) => set('workshopPartyId', value)} allowEmpty emptyLabel="No party (paid on the spot)" />
          </Field>
          {!hasParty && (
            <Field label="Mechanic / Workshop Name" htmlFor="bd-by">
              <input id="bd-by" className="input" value={form.repairedBy} onChange={(event) => set('repairedBy', event.target.value)} placeholder="Roadside mechanic, garage…" />
            </Field>
          )}
        </FieldGrid>
      </FormSection>

      <FormSection number={4} title="Cost" tone="slate" hint="Each line is also kept as a Breakdown expense on the vehicle" action={<AddLink onClick={() => set('costs', [...form.costs, emptyCost()])}><Plus size={12} className="inline" /> Add Line</AddLink>}>
        <div className="space-y-2">
          {form.costs.map((row, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2 sm:grid-cols-[150px_150px_1fr_auto]">
              <OptionSelect options={COST_HEADS} value={row.head} onChange={(value) => setCost(index, 'head', value)} ariaLabel="Cost head" />
              <MoneyInput value={row.amount} onChange={(value) => setCost(index, 'amount', value)} aria-label="Amount" />
              <input className="input col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" value={row.notes} onChange={(event) => setCost(index, 'notes', event.target.value)} placeholder="Part name, bill no…" />
              <button type="button" className="icon-btn p-2 text-rose-600" aria-label="Remove line" onClick={() => set('costs', form.costs.length > 1 ? form.costs.filter((_, i) => i !== index) : [emptyCost()])}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <FieldGrid cols={2}>
          {hasParty && (
            <Field label="Paid Now" hint={due > 0 ? `${formatRupees(due)} stays due in the party ledger` : ''} action={total > 0 && <AddLink onClick={() => set('paidAmount', String(total))}>Full amount</AddLink>}>
              <MoneyInput value={form.paidAmount} onChange={(value) => set('paidAmount', value)} />
            </Field>
          )}
          <Field label="Paid By">
            <OptionSelect options={[{ value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'bank', label: 'Bank' }]} value={form.mode} onChange={(value) => set('mode', value)} />
          </Field>
          <Field label="Notes" htmlFor="bd-notes" className="sm:col-span-2">
            <textarea id="bd-notes" rows={2} className="input resize-none" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Anything else…" />
          </Field>
        </FieldGrid>
      </FormSection>

      {addingParty && (
        <PartyPopup
          defaultType="supplier"
          onClose={() => setAddingParty(false)}
          onSaved={async (party) => {
            await reloadParties();
            set('workshopPartyId', party._id);
          }}
        />
      )}
    </FormPopup>
  );
}
