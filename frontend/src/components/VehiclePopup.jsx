import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { BILLING_BASIS_OPTIONS, MACHINERY_CATEGORIES, MACHINERY_HIRE_OPTIONS, VEHICLE_CATEGORY_OPTIONS, getBasisUnit } from '../utils/constants';
import { idOf, todayInput } from '../utils/format';
import { meterUnitOf } from '../utils/meter';
import FormPopup from './FormPopup';
import FormSection, { AddLink } from './FormSection';
import PartyPopup from './PartyPopup';
import RouteRateFields from './RouteRateFields';
import { OptionSelect, PartySelect } from './Pickers';
import { Field, MoneyInput } from './ui';

const METER_UNITS = [
  { value: 'km', label: 'KM', hint: 'Odometer counts kilometres' },
  { value: 'hrs', label: 'Hours', hint: 'Hour meter (JCB, machines)' },
];

const WORK_TYPES = [
  { value: false, label: 'Vehicle', hint: 'Runs trips from one place to another' },
  { value: true, label: 'Machinery', hint: 'JCB, tractor, crane: works at one site' },
];

const OWNERSHIP = [
  { value: 'own', label: 'My Vehicle', hint: 'I own it. I can run trips or give it on monthly rent.' },
  { value: 'hired', label: 'Hired Vehicle', hint: "Another party's vehicle I hire per trip / km / ton or monthly" },
];

const EMPTY = {
  vehicleNo: '', category: 'truck', isMachinery: false, ownership: 'own', ownerPartyId: '', hireBasis: '', hireRate: '', routeRates: [],
  meterUnit: 'km', capacityTons: '', openingKm: '', status: 'active', notes: '',
};

// A service reminder: every N km (or hours on an hour meter) and / or every N days
const EMPTY_REMINDER = { title: 'Service', intervalKm: '', intervalDays: '' };
// Warn a little before it falls due: a tenth of the gap, at most 500 km (or 50 hrs)
const warnBefore = (interval, unit) => Math.min(unit === 'hrs' ? 50 : 500, Math.round(Number(interval || 0) / 10));
const sameReminder = (a, b) => a.title.trim() === String(b.title || '').trim()
  && Number(a.intervalKm || 0) === Number(b.intervalKm || 0) && Number(a.intervalDays || 0) === Number(b.intervalDays || 0);

export default function VehiclePopup({ vehicle = null, onClose, onSaved }) {
  const { parties, reload: reloadParties } = useMasters();
  const [form, setForm] = useState(() => (vehicle ? { ...EMPTY, ...vehicle, ownerPartyId: idOf(vehicle.ownerPartyId) } : EMPTY));
  const [addingParty, setAddingParty] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  // Service reminders of this vehicle: a new vehicle starts with one row to fill; an edit loads its schedules
  const [reminders, setReminders] = useState(() => (vehicle ? [] : [EMPTY_REMINDER]));
  const [savedReminders, setSavedReminders] = useState([]);
  useEffect(() => {
    if (!vehicle) return;
    apiClient.get('/maintenance', { params: { vehicleId: vehicle._id } })
      .then((list) => {
        const rows = Array.isArray(list) ? list : [];
        setSavedReminders(rows);
        setReminders(rows.map((row) => ({ _id: row._id, title: row.title, intervalKm: row.intervalKm || '', intervalDays: row.intervalDays || '' })));
      })
      .catch(() => {});
  }, [vehicle]);
  const setReminder = (index, field, value) => setReminders((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  // A row counts once it has a name and an interval
  const filledReminder = (row) => row.title.trim() && (Number(row.intervalKm) > 0 || Number(row.intervalDays) > 0);
  const isHired = form.ownership === 'hired';
  const unit = meterUnitOf(form);
  const isMachinery = Boolean(form.isMachinery);
  // A machine works at one site, so it has no route rates; its owner is paid per hour / day
  const hireOptions = isMachinery ? MACHINERY_HIRE_OPTIONS : BILLING_BASIS_OPTIONS;
  // Switching to machinery (or back) drops route rates and an owner pay that no longer fits
  const setMachinery = (value) => setForm((prev) => {
    const options = value ? MACHINERY_HIRE_OPTIONS : BILLING_BASIS_OPTIONS;
    return {
      ...prev,
      isMachinery: value,
      ...(value ? { routeRates: [] } : {}),
      ...(prev.hireBasis && !options.some((option) => option.value === prev.hireBasis) ? { hireBasis: '', hireRate: '' } : {}),
      ...(!vehicle && value ? { meterUnit: 'hrs' } : {}),
    };
  });

  const handleSubmit = async () => {
    setSaving(true);
    const payload = { ...form, isMachinery };
    delete payload.openingKm;
    delete payload.currentKm;
    try {
      const saved = vehicle ? await apiClient.put(`/vehicles/${vehicle._id}`, payload) : await apiClient.post('/vehicles', payload);
      // The starting odometer is kept as the first meter reading
      if (!vehicle && Number(form.openingKm) > 0) {
        await apiClient.post('/meter-readings', { vehicleId: saved._id, date: todayInput(), openingReading: form.openingKm, closingReading: form.openingKm, notes: 'Meter when added' });
      }
      // Service reminders: new ones count from the meter now; changed ones are updated; removed ones deleted
      const meterNow = vehicle ? Number(vehicle.currentKm || 0) : Number(form.openingKm || 0);
      const kept = reminders.filter(filledReminder);
      await Promise.all([
        ...kept.map((row) => {
          const body = {
            vehicleId: saved._id, title: row.title.trim(), intervalKm: Number(row.intervalKm) || 0, intervalDays: Number(row.intervalDays) || 0,
            alertBeforeKm: warnBefore(row.intervalKm, unit), alertBeforeDays: Number(row.intervalDays) > 0 ? Math.min(7, Math.round(Number(row.intervalDays) / 10) || 1) : 7,
          };
          const before = savedReminders.find((item) => item._id === row._id);
          if (!before) return apiClient.post('/maintenance', { ...body, lastDoneKm: meterNow, lastDoneDate: todayInput() });
          return sameReminder(row, before) ? null : apiClient.put(`/maintenance/${row._id}`, { ...body, lastDoneKm: before.lastDoneKm, lastDoneDate: before.lastDoneDate });
        }),
        ...savedReminders.filter((item) => !kept.some((row) => row._id === item._id)).map((item) => apiClient.delete(`/maintenance/${item._id}`)),
      ]);
      toast.success(vehicle ? 'Vehicle updated' : 'Vehicle added');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormPopup title={vehicle ? 'Edit Vehicle' : 'Add Vehicle'} subtitle="Your own truck or machine, or a hired one" maxWidth="max-w-2xl" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
        <FormSection number={1} title="Vehicle" tone="blue">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Field label="Vehicle Number" required htmlFor="veh-no">
              <input id="veh-no" className="input font-mono uppercase" value={form.vehicleNo} onChange={(event) => set('vehicleNo', event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} maxLength={10} placeholder="CG04AB1234" required autoFocus />
            </Field>
            <Field label="Type" htmlFor="veh-cat">
              <OptionSelect id="veh-cat" options={VEHICLE_CATEGORY_OPTIONS} value={form.category} onChange={(category) => {
                set('category', category);
                // JCB, tractor and crane are machinery; picking another type on a new entry makes it a vehicle again
                if (!vehicle || MACHINERY_CATEGORIES.includes(category)) setMachinery(MACHINERY_CATEGORIES.includes(category));
              }} />
            </Field>
          </div>
          {/* Vehicle runs A → B; machinery works at one site, so its trips ask one location */}
          <Field label="Works As" hint={WORK_TYPES.find((option) => option.value === isMachinery)?.hint}>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/70 p-1 ring-1 ring-slate-200">
              {WORK_TYPES.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setMachinery(option.value)}
                  aria-pressed={isMachinery === option.value}
                  className={`cursor-pointer rounded-lg px-2 py-2 text-sm font-semibold transition ${isMachinery === option.value ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>
          <div className={`grid grid-cols-2 gap-3 md:gap-4 ${vehicle ? '' : 'md:grid-cols-3'}`}>
            <Field label="Vehicle Is" required htmlFor="veh-own" hint={OWNERSHIP.find((option) => option.value === form.ownership)?.hint}>
              <OptionSelect id="veh-own" options={OWNERSHIP} value={form.ownership} onChange={(value) => set('ownership', value)} />
            </Field>
            <Field label="Meter Reading In" required htmlFor="veh-meter" hint={METER_UNITS.find((option) => option.value === unit)?.hint}>
              <OptionSelect id="veh-meter" options={METER_UNITS} value={unit} onChange={(value) => set('meterUnit', value)} />
            </Field>
            {/* Where the meter stands today; saved as the vehicle's first meter reading */}
            {!vehicle && (
              <Field label={unit === 'hrs' ? 'Opening Hour Meter' : 'Opening Odometer'} hint="Optional. Meter today, saved as the first reading">
                <MoneyInput prefix="" suffix={unit} value={form.openingKm} onChange={(value) => set('openingKm', value)} placeholder="Optional" />
              </Field>
            )}
          </div>
        </FormSection>

        {isHired && (
          <FormSection number={2} title="Hired From" tone="amber" hint="For monthly rent, leave the rate empty and add it in Monthly Hire.">
            {/* Owner, how they are paid and the rate, side by side */}
            <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 ${form.hireBasis ? 'md:grid-cols-3' : ''}`}>
              <Field label="Vehicle Owner" required action={<AddLink onClick={() => setAddingParty(true)}>New Owner</AddLink>}>
                <PartySelect parties={parties} value={form.ownerPartyId} onChange={(value) => set('ownerPartyId', value)} prefer={['supplier']} required />
              </Field>
              <Field label="Pay Owner">
                <OptionSelect options={hireOptions} value={form.hireBasis} onChange={(value) => set('hireBasis', value)} allowEmpty emptyLabel="No fixed rate" />
              </Field>
              {form.hireBasis && (
                <Field label="Rate">
                  <MoneyInput value={form.hireRate} onChange={(value) => set('hireRate', value)} suffix={getBasisUnit(form.hireBasis) ? `/${getBasisUnit(form.hireBasis)}` : ''} />
                </Field>
              )}
            </div>
          </FormSection>
        )}

        {!isMachinery && (
        <FormSection
          number={isHired ? 3 : 2}
          title="Route Rates"
          tone="emerald"
          hint={isHired
            ? 'Agreed rate for each route, per trip, per km or per ton: what you bill the party and what you pay the owner. Filled in automatically on a trip.'
            : 'Agreed rate for each route this vehicle runs, per trip, per km or per ton. Filled in automatically when you add a trip.'}
        >
          <RouteRateFields routes={form.routeRates} isHired={isHired} onChange={(routeRates) => set('routeRates', routeRates)} />
        </FormSection>
        )}

        {/* Service reminders: an alert every N km / hours or N days, starting from the meter now */}
        <FormSection
          number={(isHired ? 3 : 2) + (isMachinery ? 0 : 1)}
          title="Service Reminder"
          tone="amber"
          hint={`Get an alert every so many ${unit === 'hrs' ? 'hours' : 'km'} or days, e.g. every ${unit === 'hrs' ? '200 hrs' : '5000 km'}. Mark it Serviced from Alerts and it starts again.`}
          action={<AddLink onClick={() => setReminders((prev) => [...prev, { ...EMPTY_REMINDER, title: '' }])}>Add Reminder</AddLink>}
        >
          {reminders.length === 0 ? (
            <button type="button" onClick={() => setReminders([EMPTY_REMINDER])} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-white/60 px-3 py-2.5 text-sm font-semibold text-amber-700 hover:bg-white">
              <Plus size={15} /> Add a service reminder
            </button>
          ) : (
            <div className="space-y-2">
              {reminders.map((row, index) => (
                <div key={row._id || `new-${index}`} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Field label="Service" className="col-span-2 sm:col-span-1">
                    <input className="input" value={row.title} onChange={(event) => setReminder(index, 'title', event.target.value)} placeholder="Service, Oil change, Greasing…" maxLength={60} />
                  </Field>
                  <Field label="Every">
                    <MoneyInput prefix="" suffix={unit} value={row.intervalKm} onChange={(value) => setReminder(index, 'intervalKm', value)} placeholder={unit === 'hrs' ? '200' : '5000'} />
                  </Field>
                  <Field label="Or every">
                    <MoneyInput prefix="" suffix="days" value={row.intervalDays} onChange={(value) => setReminder(index, 'intervalDays', value)} placeholder="Optional" />
                  </Field>
                  <button
                    type="button"
                    onClick={() => setReminders((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="Remove reminder"
                    className="col-span-2 mb-0.5 flex h-10 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 sm:col-span-1 sm:w-10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <p className="text-[11px] text-slate-500">
                {vehicle ? 'A new reminder counts from the meter now' : 'Counts from the opening meter above'}; you get a warning a little before it is due.
              </p>
            </div>
          )}
        </FormSection>

        <FormSection number={(isHired ? 4 : 3) + (isMachinery ? 0 : 1)} title="Details" tone="slate">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {!isMachinery && (
              <Field label="Capacity">
                <MoneyInput prefix="" suffix="ton" value={form.capacityTons} onChange={(value) => set('capacityTons', value)} />
              </Field>
            )}
            <Field label="Expected Mileage" hint={unit === 'hrs' ? 'Diesel per hour it should use. Flagged when it uses over 10% more.' : 'Km per litre it should give. Flagged when over 10% lower.'}>
              <MoneyInput prefix="" suffix={unit === 'hrs' ? 'ltr/hr' : 'km/l'} value={form.expectedMileage || ''} onChange={(value) => set('expectedMileage', value)} placeholder="Optional" />
            </Field>
            {vehicle && (
              <Field label="Status">
                <OptionSelect options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'sold', label: 'Sold / Returned' }]} value={form.status} onChange={(value) => set('status', value)} />
              </Field>
            )}
          </div>
          <Field label="Notes" htmlFor="veh-notes">
            <textarea id="veh-notes" rows={2} className="input resize-none" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Any additional notes…" />
          </Field>
        </FormSection>
      </FormPopup>

      {addingParty && (
        <PartyPopup
          defaultType="supplier"
          onClose={() => setAddingParty(false)}
          onSaved={async (party) => {
            await reloadParties();
            set('ownerPartyId', party._id);
          }}
        />
      )}
    </>
  );
}
