import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, LogOut, Monitor, Moon, Save, Sun } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getStoredTheme, setStoredTheme } from '../utils/theme';
import FormSection from '../components/FormSection';
import ExpenseTypeSettings from '../components/ExpenseTypeSettings';
import StaffSettings from '../components/StaffSettings';
import Segmented from '../components/Segmented';
import { Field, MoneyInput, Page, PageHeader } from '../components/ui';
import usePwaInstall from '../hooks/usePwaInstall';
import { isAppInstalled } from '../utils/pwaInstall';

// Steps to install by hand, for when the browser has not offered (or no longer offers) its install popup
const manualInstallSteps = () => {
  const agent = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos) {
    return ['Open this page in Safari', 'Tap the Share button (square with an arrow)', 'Tap "Add to Home Screen", then "Add"'];
  }
  if (/Android/i.test(agent)) {
    return ['Open this page in Chrome', 'Tap the ⋮ menu at the top right', 'Tap "Install app" or "Add to Home screen"'];
  }
  return ['Open this page in Chrome or Edge', 'Click the install icon at the right end of the address bar, or open the ⋮ / … menu', 'Choose "Install VahanERP" (in Edge: Apps → Install this site as an app)'];
};

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getStoredTheme());
  const [form, setForm] = useState(() => ({
    name: user?.name || '',
    companyName: user?.companyName || '',
    mobile: user?.mobile || '',
    email: user?.email || '',
    address: user?.address || '',
    gstin: user?.gstin || '',
    quotationTerms: user?.quotationTerms || '',
    documentReminderDays: user?.documentReminderDays ?? 15,
    currentPassword: '',
    newPassword: '',
  }));
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const { installable, install } = usePwaInstall();
  const [installed, setInstalled] = useState(isAppInstalled);
  const [showInstallSteps, setShowInstallSteps] = useState(false);

  const handleInstallApp = async () => {
    if (!installable) {
      setShowInstallSteps(true);
      return;
    }
    if (await install()) setInstalled(true);
  };

  const changeTheme = (value) => {
    setTheme(value);
    setStoredTheme(value);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiClient.put('/auth/me', form);
      setUser(response.user);
      setForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
      toast.success('Settings saved');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Page>
      <PageHeader title="Settings" subtitle="Company details, staff logins, alerts and appearance">
        <button type="button" className="btn-secondary" onClick={signOut}><LogOut size={16} /> Sign Out</button>
      </PageHeader>

      <form onSubmit={save} className="grid max-w-5xl gap-3 lg:grid-cols-2">
        <FormSection number={1} title="Company" tone="blue" hint="Printed on the top of every quotation">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Your Name" htmlFor="set-name"><input id="set-name" className="input" value={form.name} onChange={(event) => set('name', event.target.value)} required /></Field>
            <Field label="Company Name" htmlFor="set-company"><input id="set-company" className="input" value={form.companyName} onChange={(event) => set('companyName', event.target.value)} /></Field>
            <Field label="Mobile" htmlFor="set-mobile"><input id="set-mobile" className="input" value={form.mobile} onChange={(event) => set('mobile', event.target.value)} /></Field>
            <Field label="Email" htmlFor="set-email"><input id="set-email" type="email" className="input" value={form.email} onChange={(event) => set('email', event.target.value)} /></Field>
            <Field label="GSTIN" htmlFor="set-gstin" className="col-span-2"><input id="set-gstin" className="input uppercase" value={form.gstin} onChange={(event) => set('gstin', event.target.value)} /></Field>
          </div>
          <Field label="Address" htmlFor="set-address"><textarea id="set-address" className="input min-h-[70px]" value={form.address} onChange={(event) => set('address', event.target.value)} /></Field>
        </FormSection>

        <div className="space-y-3">
          <FormSection number={2} title="Alerts" tone="amber">
            <Field label="Warn about a document this many days before it expires">
              <MoneyInput prefix="" suffix="days" value={form.documentReminderDays} onChange={(value) => set('documentReminderDays', value)} />
            </Field>
          </FormSection>

          <FormSection number={3} title="Appearance" tone="slate" hint="Kept on this device">
            <Segmented
              value={theme}
              onChange={changeTheme}
              options={[{ key: 'light', label: 'Light', icon: Sun }, { key: 'soft', label: 'Soft', icon: Monitor }, { key: 'dark', label: 'Dark', icon: Moon }]}
            />
          </FormSection>

          <FormSection number={4} title="Change Password" tone="indigo">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Current" htmlFor="set-cur"><input id="set-cur" type="password" className="input" value={form.currentPassword} onChange={(event) => set('currentPassword', event.target.value)} autoComplete="current-password" /></Field>
              <Field label="New" htmlFor="set-new"><input id="set-new" type="password" className="input" value={form.newPassword} onChange={(event) => set('newPassword', event.target.value)} minLength={6} autoComplete="new-password" /></Field>
            </div>
          </FormSection>
        </div>

        <FormSection number={5} title="Default Quotation Terms" tone="emerald">
          <textarea className="input min-h-[130px]" value={form.quotationTerms} onChange={(event) => set('quotationTerms', event.target.value)} />
        </FormSection>

        <div className="flex items-end justify-end lg:col-span-2">
          <button type="submit" className="btn-primary px-8" disabled={saving}><Save size={16} /> Save Settings</button>
        </div>
      </form>

      {/* Install App: for when the browser's own install popup was missed or closed */}
      <section className="card mt-3 max-w-5xl">
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl object-contain" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900">Install App</h2>
            <p className="text-xs text-slate-500">Open VahanERP from your home screen or desktop like an app.</p>
          </div>
          {installed ? (
            <span className="badge-green inline-flex shrink-0 items-center gap-1"><CheckCircle2 size={13} /> Installed</span>
          ) : (
            <button type="button" className="btn-primary inline-flex shrink-0 items-center gap-1.5 px-4" onClick={handleInstallApp}>
              <Download size={15} /> Download App
            </button>
          )}
        </div>
        {!installed && showInstallSteps && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-slate-700">This browser did not open its install popup. Install it by hand:</p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-xs text-slate-600">
              {manualInstallSteps().map((step) => <li key={step}>{step}</li>)}
            </ol>
            <p className="mt-1.5 text-[11px] text-slate-400">If VahanERP is already installed on this device, open it from your home screen or apps list.</p>
          </div>
        )}
      </section>

      {/* The owner's expense types: vehicle, trip or office spends */}
      <ExpenseTypeSettings />

      {/* Staff logins: separate sign-in, only the add buttons, with "save on approval" */}
      <StaffSettings />
    </Page>
  );
}
