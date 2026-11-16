import { toast } from 'react-toastify';
import apiClient from './api';

/**
 * Stop or bring back the alerts of one document / service schedule.
 * kind: 'documents' | 'maintenance'. Returns true when it changed.
 */
export const toggleAlerts = async (kind, row) => {
  const off = !row.alertsOff;
  try {
    await apiClient.post(`/${kind}/${row._id}/alerts`, { off });
    toast.success(off ? 'Alert stopped' : 'Alert switched back on');
    return true;
  } catch (error) {
    toast.error(error.message);
    return false;
  }
};
