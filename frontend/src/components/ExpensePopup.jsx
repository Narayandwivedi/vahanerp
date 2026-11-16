import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import useMasters from '../utils/useMasters';
import { useAuth } from '../context/AuthContext';
import { getExpenseKind } from '../utils/constants';
import { idOf, toDayInput, todayInput } from '../utils/format';
import { meterUnitOf } from '../utils/meter';
import FormPopup from './FormPopup';
import ExpenseTypePopup from './ExpenseTypePopup';
import FormSection, { AddLink, FieldGrid } from './FormSection';
import { OptionSelect, VehicleSelect } from './Pickers';
import { Field, MoneyInput } from './ui';

const QUICK = ['Diesel', 'Tyre', 'Repair & Maintenance', 'Driver Salary', 'Toll', 'Insurance', 'Road Tax', 'EMI'];

// Any spend: on a vehicle (counted in its profit) or general / office (counted in the business profit only)
// approve(payload): opened from the Activity Center to change a staff entry; Save approves it with these changes
export default function ExpensePopup({ expense = null, preset = {}, onClose, onSaved, approve = null }) {
  const { vehicles } = useMasters();
  const { data: categories } = useFetch('/expense-categories', {}, []);
  // The owner's own expense types, each a vehicle, trip or office spend; the usual ones until any are added
  const { data: savedTypes, reload: reloadTypes } = useFetch('/expense-types', {}, []);
  const types = savedTypes || [];
  const { isStaff } = useAuth();
  const [addingType, setAddingType] = useState(false);
  const [form, setForm] = useState(() => (expense
    ? { ...expense, date: toDayInput(expense.date), vehicleId: idOf(expense.vehicleId), odometer: expense.odometer || '' }
    : { date: todayInput(), vehicleId: '', category: '', amount: '', odometer: '', paidTo: '', mode: 'cash', notes: '', ...preset }));
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  // An office / general type has no vehicle
  const pickType = (name, list = types) => setForm((prev) => {
    const type = list.find((item) => item.name.toLowerCase() === String(name).toLowerCase());
    return { ...prev, category: name, ...(type?.kind === 'office' ? { vehicleId: '', odometer: '' } : {}) };
  });
  const pickedType = types.find((item) => item.name.toLowerCase() === String(form.category || '').trim().toLowerCase());

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { date: form.date, vehicleId: form.vehicleId, category: form.category, amount: form.amount, odometer: form.odometer, paidTo: form.paidTo, mode: form.mode, notes: form.notes };
      const saved = approve ? await approve(payload) : expense ? await apiClient.put(`/expenses/${expense._id}`, payload) : await apiClient.post('/expenses', payload);
      // A staff save with "save on approval" waits for the owner
      if (!approve) toast.success(saved?.pendingApproval ? 'Sent to the owner for approval' : 'Expense saved');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPopup submitLabel={approve ? 'Save & Approve' : 'Save'} title={approve ? 'Edit & Approve' : expense ? 'Edit Expense' : 'Add Expense'} subtitle="Diesel, repair, toll, salary… on a vehicle or for the office" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving} maxWidth="max-w-2xl">
      <FormSection number={1} title="Expense" tone="rose">
        <FieldGrid cols={2}>
          <Field label="Date" required htmlFor="exp-date">
            <input id="exp-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
          </Field>
          <Field label="Amount" required>
            <MoneyInput value={form.amount} onChange={(value) => set('amount', value)} required autoFocus />
          </Field>
        </FieldGrid>
        <Field
          label="Expense Type"
          required
          htmlFor="exp-cat"
          hint={pickedType ? `${getExpenseKind(pickedType.kind).label}: ${getExpenseKind(pickedType.kind).hint}` : ''}
          action={!isStaff && <AddLink onClick={() => setAddingType(true)}>New Type</AddLink>}
        >
          <input id="exp-cat" className="input" list="expense-categories" value={form.category} onChange={(event) => pickType(event.target.value)} placeholder="Pick below or type" required />
          <datalist id="expense-categories">
            {(categories || []).map((category) => <option key={category} value={category} />)}
          </datalist>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(types.length ? types.map((type) => type.name) : QUICK).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => pickType(category)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition ${form.category === category ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'}`}
              >
                {category}
              </button>
            ))}
          </div>
        </Field>
      </FormSection>

      {addingType && (
        <ExpenseTypePopup
          onClose={() => setAddingType(false)}
          onSaved={async (saved) => {
            const list = await reloadTypes();
            if (saved?.name) pickType(saved.name, Array.isArray(list) ? list : [...types, saved]);
          }}
        />
      )}

      <FormSection number={2} title="Vehicle" tone="blue" hint="Leave the vehicle empty for an office / general expense">
        <FieldGrid cols={2}>
          <Field label="Vehicle">
            <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={(value) => set('vehicleId', value)} allowEmpty emptyLabel="No vehicle (general expense)" />
          </Field>
          <Field label="Meter Reading" hint="Optional, updates the meter">
            <MoneyInput prefix="" suffix={meterUnitOf(vehicles.find((item) => item._id === form.vehicleId))} value={form.odometer} onChange={(value) => set('odometer', value)} />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection number={3} title="Payment" tone="slate">
        <FieldGrid cols={2}>
          <Field label="Paid By">
            <OptionSelect
              options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank' }, { value: 'upi', label: 'UPI' }, { value: 'credit', label: 'Credit (pay later)' }]}
              value={form.mode}
              onChange={(value) => set('mode', value)}
            />
          </Field>
          <Field label="Paid To" htmlFor="exp-paidto">
            <input id="exp-paidto" className="input" value={form.paidTo} onChange={(event) => set('paidTo', event.target.value)} placeholder="Pump, garage, driver…" />
          </Field>
          <Field label="Notes" htmlFor="exp-notes" className="sm:col-span-2">
            <textarea id="exp-notes" rows={2} className="input resize-none" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Bill no. or any additional notes…" />
          </Field>
        </FieldGrid>
      </FormSection>
    </FormPopup>
  );
}
