import { toNumber } from './format';

// Same lists as backend/models/Breakdown.js
export const BREAKDOWN_CATEGORIES = [
  { value: 'engine', label: 'Engine' },
  { value: 'tyre', label: 'Tyre / Puncture' },
  { value: 'brake', label: 'Brake' },
  { value: 'clutch_gearbox', label: 'Clutch / Gearbox' },
  { value: 'electrical', label: 'Electrical / Battery' },
  { value: 'suspension', label: 'Suspension / Spring' },
  { value: 'cooling', label: 'Radiator / Cooling' },
  { value: 'fuel_system', label: 'Fuel System' },
  { value: 'hydraulic', label: 'Hydraulic' },
  { value: 'accident', label: 'Accident' },
  { value: 'other', label: 'Other' },
];
export const COST_HEADS = [
  { value: 'parts', label: 'Parts' },
  { value: 'labour', label: 'Labour' },
  { value: 'towing', label: 'Towing' },
  { value: 'crane', label: 'Crane' },
  { value: 'other', label: 'Other' },
];
export const BREAKDOWN_STATUS = {
  open: { label: 'Standing', className: 'badge-red' },
  under_repair: { label: 'Under Repair', className: 'badge-orange' },
  resolved: { label: 'Repaired', className: 'badge-green' },
};

export const getBreakdownCategory = (value) => BREAKDOWN_CATEGORIES.find((row) => row.value === value)?.label || 'Other';

// A day plus an optional "HH:mm" as a time; no time counts as the start of the day
const at = (day, time) => {
  if (!day) return null;
  const base = new Date(day);
  const [hours, minutes] = /^\d{2}:\d{2}$/.test(time || '') ? time.split(':').map(Number) : [0, 0];
  return base.getTime() + (hours * 60 + minutes) * 60000;
};

// Hours the vehicle stood: from the breakdown until it was repaired (still standing: until now)
export const downtimeHours = (row) => {
  const start = at(row.date, row.time);
  if (start === null) return 0;
  const end = row.status === 'resolved' ? at(row.resolvedDate, row.resolvedTime) : Date.now();
  return Math.max(0, (toNumber(end) - start) / 3600000);
};

export const formatDowntime = (hours) => {
  const total = Math.round(toNumber(hours));
  if (total < 1) return 'Same day';
  const days = Math.floor(total / 24);
  const rest = total % 24;
  if (!days) return `${rest} hr`;
  return rest ? `${days} d ${rest} hr` : `${days} day${days > 1 ? 's' : ''}`;
};

// Count, cost, downtime and the most common cause of a list of breakdowns
export const summarizeBreakdowns = (rows) => {
  const list = rows || [];
  const byCategory = {};
  list.forEach((row) => {
    const key = row.category || 'other';
    byCategory[key] = byCategory[key] || { count: 0, cost: 0 };
    byCategory[key].count += 1;
    byCategory[key].cost += toNumber(row.totalCost);
  });
  const causes = Object.entries(byCategory).sort((a, b) => b[1].count - a[1].count || b[1].cost - a[1].cost);
  return {
    count: list.length,
    cost: list.reduce((total, row) => total + toNumber(row.totalCost), 0),
    due: list.reduce((total, row) => total + Math.max(0, toNumber(row.totalCost) - toNumber(row.paidAmount)), 0),
    hours: list.reduce((total, row) => total + downtimeHours(row), 0),
    open: list.filter((row) => row.status !== 'resolved').length,
    onTrip: list.filter((row) => row.onTrip).length,
    topCause: causes[0] ? getBreakdownCategory(causes[0][0]) : '',
    causes: causes.map(([key, value]) => ({ key, label: getBreakdownCategory(key), ...value })),
  };
};
