import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import { EXPENSE_KIND_OPTIONS } from '../utils/constants';
import FormPopup from './FormPopup';
import FormSection from './FormSection';
import { Field } from './ui';

/**
 * Add or change an expense type: its name and what kind of spend it is (vehicle, trip or office).
 * onSaved gets the saved type, so a form can pick it straight away.
 */
export default function ExpenseTypePopup({ type = null, defaultKind = 'vehicle', onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ name: type?.name || '', kind: type?.kind || defaultKind }));
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const saved = type ? await apiClient.put(`/expense-types/${type._id}`, form) : await apiClient.post('/expense-types', form);
      toast.success(type ? 'Expense type updated' : 'Expense type added');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPopup title={type ? 'Edit Expense Type' : 'Add Expense Type'} subtitle="A type of spend you pick when adding an expense" maxWidth="max-w-md" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
      <FormSection number={1} title="Expense Type" tone="rose">
        <Field label="Name" required htmlFor="expense-type-name">
          <input id="expense-type-name" className="input" value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="e.g. Toll, Tyre, Office Rent" maxLength={40} required autoFocus />
        </Field>
        <Field label="Type of Expense" required>
          <div className="grid gap-2">
            {EXPENSE_KIND_OPTIONS.map((option) => (
              <label key={option.value} className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 ring-1 transition ${form.kind === option.value ? 'bg-white ring-rose-400' : 'bg-white/60 ring-slate-200 hover:ring-slate-300'}`}>
                <input type="radio" name="expense-type-kind" className="mt-0.5 h-4 w-4 shrink-0 accent-rose-600" checked={form.kind === option.value} onChange={() => set('kind', option.value)} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">{option.label}</span>
                  <span className="block text-[11px] text-slate-500">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </Field>
      </FormSection>
    </FormPopup>
  );
}
