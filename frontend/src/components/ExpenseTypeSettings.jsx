import { useState } from 'react';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { EXPENSE_KIND_OPTIONS } from '../utils/constants';
import ExpenseTypePopup from './ExpenseTypePopup';
import { EmptyState, Loading, RowAction } from './ui';

/** Settings → Expense Types: the owner's types, grouped by vehicle, trip and office. */
export default function ExpenseTypeSettings() {
  const { data, loading, reload } = useFetch('/expense-types', {}, null);
  const [editing, setEditing] = useState(null);
  const rows = data || [];

  const remove = async (type) => {
    if (!window.confirm(`Delete the expense type "${type.name}"? Expenses already saved with it stay as they are.`)) return;
    try {
      await apiClient.delete(`/expense-types/${type._id}`);
      toast.success('Expense type deleted');
      reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <section className="panel max-w-5xl">
      <div className="panel-header flex items-center justify-between py-2.5">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><Tags size={16} /> Expense Types</h2>
          <p className="text-xs text-slate-500">Your types of spend. Trip expense types show in Add Trip; all of them show in Add Expense.</p>
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={15} /> Add Type</button>
      </div>
      {loading && !data ? <Loading /> : rows.length === 0 ? (
        <EmptyState icon={Tags} title="No expense types yet" hint="Add types like Toll (trip), Tyre (vehicle) or Office Rent (office)." />
      ) : (
        <div className="grid gap-0 divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
          {EXPENSE_KIND_OPTIONS.map((kind) => {
            const ofKind = rows.filter((row) => (row.kind || 'vehicle') === kind.value);
            return (
              <div key={kind.value} className="px-4 py-3">
                <p className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {kind.label} <span className={kind.badge}>{ofKind.length}</span>
                </p>
                {ofKind.length === 0 ? (
                  <p className="py-1 text-xs text-slate-400">None yet</p>
                ) : ofKind.map((type) => (
                  <div key={type._id} className="flex items-center justify-between gap-2 py-0.5">
                    <span className="min-w-0 truncate text-sm font-medium text-slate-800">{type.name}</span>
                    <span className="flex shrink-0">
                      <RowAction title="Edit" icon={Pencil} onClick={() => setEditing(type)} />
                      <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => remove(type)} />
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {editing && <ExpenseTypePopup type={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={reload} />}
    </section>
  );
}
