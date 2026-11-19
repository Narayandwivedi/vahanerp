import { Pencil, Trash2 } from 'lucide-react';
import { formatDate, formatRupees, toNumber } from '../utils/format';
import { BREAKDOWN_STATUS, downtimeHours, formatDowntime, getBreakdownCategory } from '../utils/breakdown';
import { RowAction, TD, TH } from './ui';

// The breakdown ledger rows: one line per breakdown, newest first
export default function BreakdownTable({ rows, showVehicle = true, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left">
        <thead>
          <tr>
            <th className={TH}>No / Date</th>
            {showVehicle && <th className={TH}>Vehicle</th>}
            <th className={TH}>Cause</th>
            <th className={TH}>On Trip</th>
            <th className={TH}>Location / Workshop</th>
            <th className={TH}>Status</th>
            <th className={`${TH} text-right`}>Downtime</th>
            <th className={`${TH} text-right`}>Cost</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = BREAKDOWN_STATUS[row.status] || BREAKDOWN_STATUS.open;
            const due = Math.max(0, toNumber(row.totalCost) - toNumber(row.paidAmount));
            return (
              <tr key={row._id} className="tbl-row cursor-pointer" onClick={() => onEdit?.(row)}>
                <td className={`${TD} whitespace-nowrap`}>
                  <p className="font-mono text-xs font-semibold">{row.breakdownNo}</p>
                  <p className="text-xs text-slate-500">{formatDate(row.date)}{row.time ? ` · ${row.time}` : ''}</p>
                </td>
                {showVehicle && <td className={`${TD} whitespace-nowrap font-mono font-semibold`}>{row.vehicleId?.vehicleNo || '—'}</td>}
                <td className={TD}>
                  <p className="font-semibold text-slate-800">
                    {getBreakdownCategory(row.category)}
                    {row.severity === 'major' && <span className="badge-red ml-1">Major</span>}
                  </p>
                  <p className="max-w-[260px] truncate text-xs text-slate-500" title={row.reason}>{row.reason}</p>
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {row.onTrip
                    ? <span className="badge-blue">{row.tripId?.tripNo || 'On trip'}</span>
                    : <span className="text-xs text-slate-400">No</span>}
                  {row.driverId?.name && <p className="text-xs text-slate-500">{row.driverId.name}</p>}
                </td>
                <td className={TD}>
                  <p>{row.location || '—'}</p>
                  {(row.workshopPartyId?.name || row.repairedBy) && <p className="text-xs text-slate-500">{row.workshopPartyId?.name || row.repairedBy}</p>}
                </td>
                <td className={TD}>
                  <span className={status.className}>{status.label}</span>
                  {row.resolvedDate && <p className="text-xs text-slate-500">{formatDate(row.resolvedDate)}</p>}
                </td>
                <td className={`${TD} whitespace-nowrap text-right`}>{formatDowntime(downtimeHours(row))}</td>
                <td className={`${TD} whitespace-nowrap text-right`}>
                  <p className="font-semibold text-rose-700">{formatRupees(row.totalCost)}</p>
                  {due > 0 && <p className="text-xs text-amber-700">{formatRupees(due)} due</p>}
                </td>
                <td className={TD} onClick={(event) => event.stopPropagation()}>
                  <div className="flex justify-end">
                    <RowAction title="Edit" icon={Pencil} onClick={() => onEdit?.(row)} />
                    {onDelete && <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => onDelete(row)} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
