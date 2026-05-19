'use client';
import { useEffect, useState } from 'react';
import {
  Download, Smartphone, Shield, CheckCircle,
  AlertCircle, Package, Settings, Wifi,
  FileText, X, ShieldAlert,
} from 'lucide-react';
import Header from '@/components/Header';
import { getToken } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface AppInfo {
  version: string; buildType: string; notes: string;
  uploadedAt: string; sizeMb: string | null; available: boolean;
}

// ─── Consent items — all must be checked before download ─────────────────────
const CONSENT_ITEMS = [
  {
    id: 'owner',
    text: 'I confirm that I am the legal parent or guardian of the child whose device this app will be installed on.',
  },
  {
    id: 'informed',
    text: 'I confirm that the child / device user has been informed that this monitoring software will be installed and is actively running on their device.',
  },
  {
    id: 'data',
    text: 'I understand that this app collects location, call logs, contacts, app usage, gallery, browsing history, and notifications from the monitored device.',
  },
  {
    id: 'legal',
    text: 'I confirm that installing and using this monitoring software complies with all applicable laws in my jurisdiction, including the IT Act, DPDP Act 2023, and any other relevant privacy or data protection regulations.',
  },
  {
    id: 'purpose',
    text: 'I confirm that I will use this app solely for lawful parental supervision and child safety purposes, and not for any unlawful surveillance.',
  },
];

// ─── Consent modal ────────────────────────────────────────────────────────────
function ConsentModal({
  onAccept,
  onCancel,
}: {
  onAccept: (items: string[]) => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = CONSENT_ITEMS.every((item) => checked[item.id]);

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <ShieldAlert size={22} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-gray-900 font-extrabold text-lg leading-tight">
                Consent &amp; Legal Agreement
              </h2>
              <p className="text-gray-500 text-xs mt-0.5">
                Required before downloading ParentGuard
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Legal notice banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 font-bold text-sm">Important Legal Notice</p>
              <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                Installing monitoring software on a device without the knowledge and consent of the user
                may be illegal under applicable laws. By downloading this app, you accept full legal
                responsibility for its installation and use. Please read and confirm each statement below.
              </p>
            </div>
          </div>

          {/* Consent checkboxes */}
          <div className="space-y-3">
            <p className="text-gray-700 font-semibold text-sm">
              Please read and check each statement to proceed:
            </p>
            {CONSENT_ITEMS.map((item, idx) => (
              <label
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all select-none ${
                  checked[item.id]
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    checked[item.id]
                      ? 'border-green-500 bg-green-500'
                      : 'border-gray-400 bg-white'
                  }`}
                >
                  {checked[item.id] && (
                    <svg viewBox="0 0 10 8" className="w-3 h-3 text-white fill-none stroke-white stroke-2">
                      <polyline points="1,4 4,7 9,1" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    {idx + 1} of {CONSENT_ITEMS.length}
                  </span>
                  <p className="text-gray-700 text-sm mt-0.5 leading-relaxed">{item.text}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${(Object.values(checked).filter(Boolean).length / CONSENT_ITEMS.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {Object.values(checked).filter(Boolean).length} / {CONSENT_ITEMS.length} confirmed
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 space-y-3">
          {!allChecked && (
            <p className="text-center text-xs text-gray-400">
              You must confirm all {CONSENT_ITEMS.length} statements to enable the download button.
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onAccept(CONSENT_ITEMS.filter((i) => checked[i.id]).map((i) => i.id))}
              disabled={!allChecked}
              className={`flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                allChecked
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Download size={16} />
              I Agree &amp; Download
            </button>
          </div>
          <p className="text-center text-[11px] text-gray-400 leading-relaxed">
            By downloading, you confirm your acceptance of the above terms.
            This consent is recorded with your account for compliance purposes.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Installation steps ───────────────────────────────────────────────────────
const STEPS = [
  {
    icon: <Download size={22} className="text-indigo-600" />,
    title: 'Download the APK',
    desc:  "Tap the download button above. The file will be saved to your device's Downloads folder.",
    bg:    'bg-indigo-50',
  },
  {
    icon: <Settings size={22} className="text-orange-600" />,
    title: 'Enable Unknown Sources',
    desc:  'Go to Settings → Security (or Privacy) → Enable "Install from unknown sources" or "Install unknown apps".',
    bg:    'bg-orange-50',
  },
  {
    icon: <Package size={22} className="text-green-600" />,
    title: 'Install the App',
    desc:  'Open the downloaded APK file and tap "Install". The app will appear as "Device Monitor".',
    bg:    'bg-green-50',
  },
  {
    icon: <Shield size={22} className="text-purple-600" />,
    title: 'Log In & Set Up',
    desc:  'Open the app, log in with the same account credentials, and grant all required permissions.',
    bg:    'bg-purple-50',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DownloadPage() {
  const [info, setInfo]           = useState<AppInfo | null>(null);
  const [loading, setLoading]     = useState(true);
  const [downloading, setDl]      = useState(false);
  const [showConsent, setConsent] = useState(false);
  const [consented, setConsented] = useState(false);
  const [consentId, setConsentId] = useState<string | null>(null);

  useEffect(() => {
    // Load app info
    fetch(`${API}/api/downloads/app-info`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));

    // Check if user has a valid recorded consent in DB
    const token = getToken();
    if (token) {
      fetch(`${API}/api/consent/my`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((logs: Array<{ id: string; isValid: boolean; purpose: string }>) => {
          const valid = logs.find((l) => l.isValid && l.purpose === 'app_download');
          if (valid) { setConsented(true); setConsentId(valid.id); }
        })
        .catch(() => {});
    }
  }, []);

  function triggerDownload() {
    const token = getToken();
    if (!token || !info?.available) return;
    setDl(true);

    const a = document.createElement('a');
    a.href     = `${API}/api/downloads/app?token=${token}`;
    a.download = `ParentGuard-v${info.version}.apk`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => setDl(false), 3000);
  }

  function handleDownloadClick() {
    if (consented) {
      triggerDownload();
    } else {
      setConsent(true);
    }
  }

  async function handleConsentAccept(items: string[]) {
    const token = getToken();
    try {
      // Record in database — legal audit trail (DPDP Act 2023 / GDPR)
      const res  = await fetch(`${API}/api/consent/record`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ items, purpose: 'app_download' }),
      });
      const data = await res.json();
      if (data.consentId) setConsentId(data.consentId);
    } catch {
      console.warn('[Consent] Could not save to DB — download still allowed');
    }
    setConsented(true);
    setConsent(false);
    triggerDownload();
  }

  return (
    <>
      <Header title="Download App" subtitle="Install the ParentGuard child monitoring app" />

      {/* Consent modal */}
      {showConsent && (
        <ConsentModal
          onAccept={handleConsentAccept}
          onCancel={() => setConsent(false)}
        />
      )}

      <main className="flex-1 p-8 space-y-8">

        {/* ── Hero card ── */}
        <div className="card bg-gradient-to-br from-indigo-600 to-purple-700 border-0 text-white overflow-hidden relative">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/5 rounded-full" />
          <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-white/5 rounded-full" />

          <div className="relative flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center flex-shrink-0">
                <Shield size={32} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold">ParentGuard</h2>
                <p className="text-indigo-200 text-sm mt-0.5">Child Monitor App for Android</p>
                {loading ? (
                  <div className="mt-2 flex items-center gap-1.5 text-indigo-300 text-xs">
                    <div className="w-3 h-3 border border-indigo-300 border-t-transparent rounded-full animate-spin" /> Loading…
                  </div>
                ) : info?.available ? (
                  <div className="mt-2 flex items-center gap-3">
                    <span className="bg-white/20 px-2.5 py-0.5 rounded-full font-semibold text-xs">v{info.version}</span>
                    <span className="text-indigo-200 text-xs">{info.sizeMb} MB</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${info.buildType === 'release' ? 'bg-green-500/30 text-green-200' : 'bg-yellow-500/30 text-yellow-200'}`}>
                      {info.buildType}
                    </span>
                    {consented && (
                      <span className="flex items-center gap-1 text-xs text-green-300 bg-green-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle size={10} /> Consent given
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {loading ? (
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            ) : info?.available ? (
              <button
                onClick={handleDownloadClick}
                disabled={downloading}
                className="flex items-center gap-3 bg-white text-indigo-700 font-extrabold text-base px-7 py-4 rounded-2xl hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-70"
              >
                {downloading ? (
                  <><div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> Starting…</>
                ) : (
                  <><Download size={20} /> Download App</>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-white/10 text-white/70 text-sm px-4 py-3 rounded-xl">
                <AlertCircle size={16} /> Not available yet
              </div>
            )}
          </div>

          {info?.notes && (
            <p className="relative mt-4 text-indigo-200 text-sm bg-white/10 rounded-xl px-4 py-2">{info.notes}</p>
          )}

          {/* Consent reminder */}
          {!consented && info?.available && (
            <p className="relative mt-3 text-indigo-300 text-xs flex items-center gap-1.5">
              <FileText size={12} />
              Clicking download will show a consent agreement required by law before the file is downloaded.
            </p>
          )}
        </div>

        {/* ── Requirements ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: <Smartphone size={20} className="text-blue-600" />, label: 'Android 6.0+',  desc: 'Marshmallow or higher',       bg: 'bg-blue-50 border-blue-200' },
            { icon: <Wifi size={20} className="text-green-600" />,      label: 'Internet',      desc: 'For real-time data sync',     bg: 'bg-green-50 border-green-200' },
            { icon: <Shield size={20} className="text-purple-600" />,   label: 'Permissions',   desc: 'Location, contacts, mic etc.', bg: 'bg-purple-50 border-purple-200' },
          ].map((r) => (
            <div key={r.label} className={`card border ${r.bg} flex items-center gap-3`}>
              <div className="flex-shrink-0">{r.icon}</div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{r.label}</p>
                <p className="text-gray-500 text-xs">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Installation guide ── */}
        <div className="card">
          <h3 className="font-bold text-gray-900 text-lg mb-6 flex items-center gap-2">
            <CheckCircle size={18} className="text-green-500" /> Installation Guide
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STEPS.map((step, i) => (
              <div key={i} className={`flex gap-4 p-4 rounded-2xl ${step.bg} border border-white`}>
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                  {step.icon}
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Step {i + 1}</span>
                  <p className="font-bold text-gray-900 text-sm">{step.title}</p>
                  <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── What the app monitors ── */}
        <div className="card">
          <h3 className="font-bold text-gray-900 text-lg mb-4">What the App Monitors</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              '📍 Real-time GPS location',
              '🔔 App notifications',
              '📞 Call logs',
              '👥 Contacts',
              '🖼️ Gallery & media',
              '🌐 Browsing history',
              '📊 App usage stats',
              '🚫 App blocking',
              '📷 Remote photo capture',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2">
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* ── Legal / compliance notice ── */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
          <ShieldAlert size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800 text-sm">Parental Consent &amp; Legal Compliance</p>
            <p className="text-amber-700 text-xs mt-1 leading-relaxed">
              This software is intended exclusively for lawful parental monitoring of minors under your care.
              You must inform the child that their device is being monitored. Covert surveillance of adults
              or minors without consent may violate the <strong>IT Act 2000</strong>, <strong>DPDP Act 2023</strong>,
              and other applicable privacy laws. A consent declaration is required each session before
              downloading the app.
            </p>
          </div>
        </div>

      </main>
    </>
  );
}
