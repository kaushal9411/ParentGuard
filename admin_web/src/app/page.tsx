'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield, MapPin, Phone, MessageSquare, Image, Globe, Lock, Bell,
  BarChart2, Smartphone, ChevronRight, Menu, X, Check, Star,
  Mail, ArrowRight, Users, Zap, Eye, Clock, Award, HeartHandshake,
  Calendar, User, Facebook, Twitter, Instagram, Linkedin,
  Play, Quote, Camera, Mic, FolderOpen, Activity, Wifi,
} from 'lucide-react';

/* ─── Keyframe animations injected once ─────────────────────────────────────── */
const ANIM_CSS = `
@keyframes float      { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-14px)} }
@keyframes float2     { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-9px)}  }
@keyframes ping-ring  { 0%{transform:scale(1);opacity:.8}  100%{transform:scale(2.4);opacity:0} }
@keyframes slide-up   { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
@keyframes slide-right{ from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)} }
@keyframes ticker     { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
@keyframes glow-pulse { 0%,100%{box-shadow:0 0 20px 4px rgba(99,102,241,.35)} 50%{box-shadow:0 0 40px 8px rgba(99,102,241,.6)} }
@keyframes scanline   { 0%{top:-10%} 100%{top:110%} }
@keyframes blink      { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes dash-flow  { to{stroke-dashoffset:-24} }
.anim-float     { animation: float  4s ease-in-out infinite }
.anim-float2    { animation: float2 5s ease-in-out infinite 1s }
.anim-float3    { animation: float  6s ease-in-out infinite 2s }
.anim-slide-up  { animation: slide-up   .7s ease both }
.anim-slide-up2 { animation: slide-up   .7s ease .15s both }
.anim-slide-up3 { animation: slide-up   .7s ease .3s  both }
.anim-glow      { animation: glow-pulse 3s ease-in-out infinite }
.anim-blink     { animation: blink 1.2s step-end infinite }
`;

/* ─── Nav ────────────────────────────────────────────────────────────────────── */
const NAV_LINKS = [
  { id: 'home', label: 'Home' }, { id: 'features', label: 'Features' },
  { id: 'preview', label: 'Preview' }, { id: 'pricing', label: 'Pricing' },
  { id: 'about', label: 'About Us' }, { id: 'blog', label: 'Blog' },
  { id: 'contact', label: 'Contact' },
];

/* ─── Features ───────────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: MapPin,        grad: 'from-orange-400 to-amber-500',  glow: 'shadow-orange-500/30',  title: 'Live GPS Tracking',       desc: 'Real-time location updates every 30 s with precise address.' },
  { icon: Phone,         grad: 'from-green-400 to-emerald-500', glow: 'shadow-green-500/30',   title: 'Call Log Monitoring',     desc: 'All incoming, outgoing & missed calls with duration.' },
  { icon: MessageSquare, grad: 'from-purple-400 to-violet-500', glow: 'shadow-purple-500/30',  title: 'SMS Monitoring',          desc: 'Read sent & received messages to keep your child safe.' },
  { icon: Image,         grad: 'from-pink-400 to-rose-500',     glow: 'shadow-pink-500/30',    title: 'Gallery Access',          desc: 'Remotely view photos & videos on the device.' },
  { icon: Globe,         grad: 'from-blue-400 to-cyan-500',     glow: 'shadow-blue-500/30',    title: 'Browsing History',        desc: 'Every website visited across all browsers.' },
  { icon: Bell,          grad: 'from-red-400 to-rose-500',      glow: 'shadow-red-500/30',     title: 'App Notifications',       desc: 'Capture alerts from all apps including social media.' },
  { icon: BarChart2,     grad: 'from-indigo-400 to-blue-500',   glow: 'shadow-indigo-500/30',  title: 'App Usage Analytics',     desc: 'Detailed daily reports of screen time per app.' },
  { icon: Lock,          grad: 'from-cyan-400 to-teal-500',     glow: 'shadow-cyan-500/30',    title: 'App Blocking',            desc: 'Block distracting or harmful apps instantly.' },
  { icon: Camera,        grad: 'from-violet-400 to-purple-500', glow: 'shadow-violet-500/30',  title: 'Remote Camera',           desc: 'Silently capture photos from front or back camera.' },
  { icon: MapPin,        grad: 'from-amber-400 to-yellow-500',  glow: 'shadow-amber-500/30',   title: 'Geo Fencing',             desc: 'Get instant alerts when child enters/leaves safe zones.' },
  { icon: Users,         grad: 'from-teal-400 to-green-500',    glow: 'shadow-teal-500/30',    title: 'Contact Management',      desc: 'Full address book with unknown contact flagging.' },
  { icon: Smartphone,    grad: 'from-rose-400 to-pink-500',     glow: 'shadow-rose-500/30',    title: 'Multi-Device Support',    desc: 'Monitor multiple children from a single dashboard.' },
];

/* ─── Plan types ─────────────────────────────────────────────────────────────── */
interface PlanFeatures {
  maxDevices: number; location: boolean; notifications: boolean;
  callLogs: boolean; smsLogs: boolean; contacts: boolean; appUsage: boolean;
  gallery: boolean; browsingHistory: boolean; geofencing: boolean;
  appBlocking: boolean; remoteCommands: boolean; historyDays: number;
}
interface ApiPlan {
  id: string; name: string; description: string | null;
  price: number; durationDays: number; sortOrder: number;
  isActive: boolean; features: PlanFeatures;
}
const FEATURE_LABELS: Array<{ key: keyof PlanFeatures; label: string }> = [
  { key: 'location', label: 'Live GPS Tracking' }, { key: 'geofencing', label: 'Geo Fencing' },
  { key: 'notifications', label: 'App Notifications' }, { key: 'callLogs', label: 'Call Logs' },
  { key: 'smsLogs', label: 'SMS Monitoring' }, { key: 'contacts', label: 'Contacts Access' },
  { key: 'appUsage', label: 'App Usage Analytics' }, { key: 'gallery', label: 'Gallery & Media' },
  { key: 'browsingHistory', label: 'Browsing History' }, { key: 'appBlocking', label: 'App Blocking' },
  { key: 'remoteCommands', label: 'Remote Commands' },
];
function planStyle(idx: number, name: string) {
  const n = name.toLowerCase();
  if (n === 'free'     || idx === 0) return { border: 'border-gray-200', ring: false, badge: '',            badgeColor: '', btn: 'bg-gray-100 hover:bg-gray-200 text-gray-800' };
  if (n === 'basic'    || idx === 1) return { border: 'border-blue-500', ring: true,  badge: 'Most Popular', badgeColor: 'bg-blue-600 text-white', btn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg' };
  if (n === 'standard' || idx === 2) return { border: 'border-indigo-400', ring: false, badge: '',           badgeColor: '', btn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md' };
  return                                     { border: 'border-purple-500', ring: false, badge: 'Best Value', badgeColor: 'bg-purple-600 text-white', btn: 'bg-purple-600 hover:bg-purple-700 text-white shadow-md' };
}

/* ─── Blogs ──────────────────────────────────────────────────────────────────── */
const BLOGS = [
  { tag: 'Child Safety',    tagColor: 'bg-blue-100 text-blue-700',   title: '10 Signs Your Child May Be Experiencing Cyberbullying',      desc: 'Learn the warning signs of online harassment and how monitoring tools help you intervene early.', author: 'Dr. Priya Sharma', date: 'May 18, 2026', read: '5 min read', emoji: '🛡️', grad: 'from-blue-600 to-indigo-700' },
  { tag: 'Digital Parenting',tagColor: 'bg-purple-100 text-purple-700',title: 'Setting Healthy Screen Time Limits: A Complete Guide',      desc: 'Science-backed strategies to manage your child\'s device usage without constant battles.',     author: 'Ravi Mehta',      date: 'May 12, 2026', read: '7 min read', emoji: '⏱️', grad: 'from-purple-600 to-pink-600' },
  { tag: 'App Guide',       tagColor: 'bg-green-100 text-green-700', title: 'How to Set Up ParentGard in Under 5 Minutes',              desc: 'Step-by-step walkthrough for installing and configuring ParentGard on your child\'s device.',  author: 'Tech Team',       date: 'May 5, 2026',  read: '3 min read', emoji: '📱', grad: 'from-green-500 to-teal-600' },
];

/* ─── Testimonials ───────────────────────────────────────────────────────────── */
const TESTIMONIALS = [
  { name: 'Sunita Patel', role: 'Mother of 2', text: 'ParentGard gave me complete peace of mind. GPS tracking is incredibly accurate and the dashboard is so easy to use.' },
  { name: 'Rajesh Kumar', role: 'Father of 3', text: 'I caught my son talking to strangers through SMS monitoring. This app literally saved my family from a dangerous situation.' },
  { name: 'Anita Singh',  role: 'Single Parent',text: 'Geo-fencing alerts are a game changer. I\'m notified the moment my daughter leaves school. Can\'t imagine parenting without it.' },
];

const STATS = [
  { value: '50,000+', label: 'Families Protected', icon: Users },
  { value: '1.2M+',   label: 'Devices Monitored',  icon: Smartphone },
  { value: '99.9%',   label: 'Uptime Guarantee',   icon: Activity },
  { value: '4.9★',    label: 'Average Rating',      icon: Star },
];

/* ─── Ticker items ───────────────────────────────────────────────────────────── */
const TICKER = [
  '📍 Location Updated', '📞 Call Detected', '💬 SMS Received', '🔒 App Blocked',
  '📸 Screenshot Taken', '🌐 Website Visited', '🔔 Alert Sent', '📊 Usage Report Ready',
  '📍 Location Updated', '📞 Call Detected', '💬 SMS Received', '🔒 App Blocked',
  '📸 Screenshot Taken', '🌐 Website Visited', '🔔 Alert Sent', '📊 Usage Report Ready',
];

/* ═══════════════════════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [scrolled, setScrolled]         = useState(false);
  const [activeSection, setActive]      = useState('home');
  const [contactForm, setContactForm]   = useState({ name: '', email: '', phone: '', message: '' });
  const [submitted, setSubmitted]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [plans, setPlans]               = useState<ApiPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [alertTick, setAlertTick]       = useState(0);

  // Rotate live-alert demo every 2.5 s
  const LIVE_ALERTS = [
    { icon: '📍', text: 'Rahul reached school', color: 'text-green-400' },
    { icon: '💬', text: 'New SMS from +91 9876…', color: 'text-purple-400' },
    { icon: '🔒', text: 'TikTok blocked (screen time)', color: 'text-red-400' },
    { icon: '📞', text: 'Incoming call: Priya (5m 12s)', color: 'text-blue-400' },
    { icon: '🌐', text: 'youtube.com visited (43 min)', color: 'text-yellow-400' },
  ];
  useEffect(() => {
    const t = setInterval(() => setAlertTick((n) => (n + 1) % LIVE_ALERTS.length), 2500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    fetch(`${API}/api/subscription/plans`)
      .then((r) => r.json())
      .then((d) => setPlans(Array.isArray(d) ? d : []))
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => {
    const fn = () => {
      setScrolled(window.scrollY > 20);
      const secs = NAV_LINKS.map((n) => document.getElementById(n.id));
      const cur  = secs.reverse().find((s) => s && window.scrollY >= s.offsetTop - 120);
      if (cur) setActive(cur.id);
    };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  }

  async function handleContact(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    try {
      await fetch(`${API}/api/inquiries`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      setSubmitted(true);
      setContactForm({ name: '', email: '', phone: '', message: '' });
    } catch { setSubmitted(true); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <style>{ANIM_CSS}</style>

      {/* ════════════════════════════════════════════════════════ NAVBAR ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => scrollTo('home')} className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ParentGard" className="w-9 h-9 object-contain" />
            <span className={`font-extrabold text-lg ${scrolled ? 'text-gray-900' : 'text-white'}`}>ParentGard</span>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((n) => (
              <button key={n.id} onClick={() => scrollTo(n.id)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors
                  ${activeSection === n.id
                    ? scrolled ? 'text-blue-600 bg-blue-50' : 'text-white bg-white/20'
                    : scrolled ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-50' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
                {n.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth/login"
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${scrolled ? 'text-gray-700 hover:text-gray-900' : 'text-white/90 hover:text-white'}`}>
              Log In
            </Link>
            <Link href="/go"
              className="text-sm font-bold px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg">
              Get Started Free
            </Link>
          </div>

          <button onClick={() => setMobileOpen((o) => !o)}
            className={`md:hidden p-2 rounded-lg ${scrolled ? 'text-gray-700' : 'text-white'}`}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-1 shadow-xl">
            {NAV_LINKS.map((n) => (
              <button key={n.id} onClick={() => scrollTo(n.id)}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
                {n.label}
              </button>
            ))}
            <div className="pt-2 border-t border-gray-100 flex flex-col gap-2 mt-2">
              <Link href="/auth/login" className="w-full text-center py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl">Log In</Link>
              <Link href="/go" className="w-full text-center py-2.5 text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl">Get Started Free</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ════════════════════════════════════════════════════════════ HERO ═══ */}
      <section id="home" className="relative min-h-screen flex items-center bg-gradient-to-br from-gray-950 via-blue-950 to-indigo-950 overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[700px] h-[700px] bg-blue-600/8 rounded-full blur-3xl" style={{ animation: 'float 8s ease-in-out infinite' }} />
          <div className="absolute -bottom-32 -left-32 w-[600px] h-[600px] bg-indigo-600/8 rounded-full blur-3xl" style={{ animation: 'float2 10s ease-in-out infinite 2s' }} />
          <div className="absolute top-1/3 left-1/2 w-96 h-96 bg-purple-600/5 rounded-full blur-2xl" style={{ animation: 'float 12s ease-in-out infinite 4s' }} />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.035]"
            style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
          {/* Glowing dots */}
          {[...Array(18)].map((_, i) => (
            <div key={i} className="absolute w-1 h-1 rounded-full bg-blue-400/40"
              style={{ left: `${5 + (i * 17) % 90}%`, top: `${10 + (i * 23) % 80}%`, animation: `blink ${1.5 + (i % 4) * 0.5}s step-end infinite ${i * 0.3}s` }} />
          ))}
        </div>

        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-32 grid lg:grid-cols-2 gap-12 items-center">
          {/* ── Left copy ── */}
          <div className="anim-slide-up">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold px-4 py-2 rounded-full mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full anim-blink" />
              Trusted by 50,000+ Indian Families · Live Now
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              Keep Your Child<br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Safe Online &amp; Offline
              </span>
            </h1>
            <p className="text-blue-100/70 text-lg leading-relaxed mb-8 max-w-xl">
              Real-time GPS tracking, call &amp; SMS monitoring, app usage analytics, and remote device control — all in one powerful dashboard built for Indian families.
            </p>
            <div className="flex flex-wrap gap-4 mb-10">
              <Link href="/go"
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold px-7 py-3.5 rounded-xl shadow-lg shadow-blue-900/40 hover:shadow-xl transition-all">
                Start Free Today <ArrowRight size={16} />
              </Link>
              <button onClick={() => scrollTo('preview')}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-7 py-3.5 rounded-xl transition-all">
                <Play size={14} className="fill-white" /> See Preview
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              {['256-bit Encrypted','No Root Required','Runs in Background','Android 8+'].map((b) => (
                <span key={b} className="flex items-center gap-1.5 text-blue-300/70 text-xs">
                  <Check size={11} className="text-green-400" /> {b}
                </span>
              ))}
            </div>
          </div>

          {/* ── Right — 3 phones ── */}
          <div className="hidden lg:flex items-center justify-center relative h-[520px]">
            {/* Left phone — SMS screen */}
            <div className="anim-float3 absolute left-0 bottom-8 w-44 h-80 bg-gray-900 rounded-[2.2rem] border-4 border-gray-700 shadow-2xl shadow-black/50 overflow-hidden opacity-70 z-10">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-gray-800 rounded-full" />
              <div className="absolute inset-0 bg-gradient-to-b from-purple-950 to-gray-950 pt-8 px-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-purple-700 rounded-full flex items-center justify-center"><MessageSquare size={10} className="text-white" /></div>
                  <p className="text-white text-[9px] font-bold">SMS Monitor</p>
                </div>
                {[
                  { from: 'Mom', msg: 'Come home by 7pm', type: 1 },
                  { from: 'Unknown', msg: 'Win ₹10000 now!', type: 1 },
                  { from: 'Me', msg: 'Ok coming soon', type: 2 },
                  { from: 'Priya', msg: 'Study group tmrw?', type: 1 },
                ].map((s, i) => (
                  <div key={i} className={`flex ${s.type === 2 ? 'justify-end' : 'justify-start'} mb-1.5`}>
                    <div className={`max-w-[80%] rounded-xl px-2 py-1 ${s.type === 2 ? 'bg-purple-700' : s.from === 'Unknown' ? 'bg-red-900/70 border border-red-700/50' : 'bg-gray-800'}`}>
                      {s.type === 1 && <p className="text-[7px] text-gray-400">{s.from}</p>}
                      <p className="text-[8px] text-white">{s.msg}</p>
                    </div>
                  </div>
                ))}
                <div className="mt-2 bg-red-900/30 border border-red-700/40 rounded-lg px-2 py-1.5">
                  <p className="text-red-400 text-[7px] font-semibold">⚠ Suspicious message flagged</p>
                </div>
              </div>
            </div>

            {/* Center phone — main dashboard */}
            <div className="anim-float relative w-60 h-[480px] bg-gray-900 rounded-[3rem] border-4 border-gray-700 shadow-2xl overflow-hidden z-20" style={{ boxShadow: '0 0 60px 8px rgba(99,102,241,.25)' }}>
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-800 rounded-full" />
              <div className="absolute inset-0 bg-gradient-to-b from-blue-950 to-gray-950 pt-10 px-4 pb-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white text-xs font-bold">ParentGard</p>
                    <p className="text-green-400 text-[9px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full anim-blink" /> Live Monitoring
                    </p>
                  </div>
                  <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
                    <Bell size={12} className="text-white" />
                  </div>
                </div>

                {/* Map */}
                <div className="bg-gray-800 rounded-2xl h-28 mb-3 relative overflow-hidden">
                  {/* Fake map grid */}
                  <div className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: 'linear-gradient(#4f8 1px,transparent 1px),linear-gradient(90deg,#4f8 1px,transparent 1px)', backgroundSize: '16px 16px' }} />
                  <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 to-blue-900/30" />
                  {/* Roads */}
                  <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 180 112">
                    <path d="M0 56 H180" stroke="#fff" strokeWidth="1.5" fill="none" />
                    <path d="M90 0 V112" stroke="#fff" strokeWidth="1" fill="none" />
                    <path d="M30 0 L60 112" stroke="#fff" strokeWidth=".5" fill="none" />
                    <path d="M0 30 L180 80" stroke="#fff" strokeWidth=".5" fill="none" />
                  </svg>
                  {/* Ping rings */}
                  <div className="absolute" style={{ left: '52%', top: '42%' }}>
                    <div className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 border-2 border-orange-400/60 rounded-full" style={{ animation: 'ping-ring 1.8s ease-out infinite' }} />
                    <div className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 border-2 border-orange-400/40 rounded-full" style={{ animation: 'ping-ring 1.8s ease-out infinite .6s' }} />
                    <div className="w-5 h-5 -translate-x-1/2 -translate-y-1/2 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/60">
                      <MapPin size={10} className="text-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
                    <p className="text-white text-[9px] font-semibold">📍 Andheri West, Mumbai</p>
                    <p className="text-green-400 text-[7px]">Updated 28s ago · Accuracy ±8m</p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {[{ icon: '📱', val: '3h 22m', label: 'Screen' }, { icon: '📞', val: '8', label: 'Calls' }, { icon: '💬', val: '24', label: 'SMS' }].map((s) => (
                    <div key={s.label} className="bg-gray-800/80 rounded-xl p-1.5 text-center">
                      <p className="text-sm">{s.icon}</p>
                      <p className="text-white text-[9px] font-bold">{s.val}</p>
                      <p className="text-gray-500 text-[7px]">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Live alert */}
                <div className="bg-gray-800/60 rounded-xl p-2 mb-2">
                  <p className="text-gray-500 text-[8px] font-semibold uppercase mb-1.5">Live Activity</p>
                  <div key={alertTick} className="flex items-center gap-2" style={{ animation: 'slide-up .4s ease' }}>
                    <span className="text-sm">{LIVE_ALERTS[alertTick].icon}</span>
                    <p className={`text-[9px] font-semibold ${LIVE_ALERTS[alertTick].color}`}>{LIVE_ALERTS[alertTick].text}</p>
                  </div>
                </div>

                {/* App usage bar */}
                <div className="bg-gray-800/60 rounded-xl p-2">
                  <p className="text-gray-500 text-[8px] mb-1">Top App Today</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">📺</span>
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: '68%', animation: 'slide-right 1.5s ease' }} />
                    </div>
                    <span className="text-white text-[8px] font-bold">68%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right phone — app blocking screen */}
            <div className="anim-float2 absolute right-0 bottom-8 w-44 h-80 bg-gray-900 rounded-[2.2rem] border-4 border-gray-700 shadow-2xl shadow-black/50 overflow-hidden opacity-70 z-10">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-gray-800 rounded-full" />
              <div className="absolute inset-0 bg-gradient-to-b from-red-950 to-gray-950 pt-8 px-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-red-700 rounded-full flex items-center justify-center"><Lock size={10} className="text-white" /></div>
                  <p className="text-white text-[9px] font-bold">App Control</p>
                </div>
                {[
                  { name: 'YouTube', pkg: 'com.google.yt', blocked: false, usage: '2h 12m', color: 'bg-red-600' },
                  { name: 'TikTok', pkg: 'com.zhiliaoapp', blocked: true, usage: '—', color: 'bg-black' },
                  { name: 'PUBG', pkg: 'com.pubg.mobile', blocked: true, usage: '—', color: 'bg-yellow-700' },
                  { name: 'Instagram', pkg: 'com.instagram', blocked: false, usage: '45m', color: 'bg-pink-700' },
                  { name: 'WhatsApp', pkg: 'com.whatsapp', blocked: false, usage: '38m', color: 'bg-green-700' },
                ].map((a) => (
                  <div key={a.name} className="flex items-center gap-1.5 mb-1.5">
                    <div className={`w-5 h-5 ${a.color} rounded-lg flex items-center justify-center text-[8px] font-bold text-white`}>
                      {a.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-[8px] font-semibold">{a.name}</p>
                      <p className="text-gray-500 text-[7px]">{a.usage}</p>
                    </div>
                    <div className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold ${a.blocked ? 'bg-red-900/60 text-red-400' : 'bg-green-900/40 text-green-400'}`}>
                      {a.blocked ? 'BLOCKED' : 'ALLOWED'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating notification cards */}
            <div className="absolute -top-4 left-12 bg-white rounded-2xl shadow-2xl px-3 py-2.5 anim-float" style={{ animationDelay: '.5s', animationDuration: '5s' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center"><MapPin size={13} className="text-green-600" /></div>
                <div><p className="text-gray-900 text-xs font-bold">Safe Zone ✓</p><p className="text-green-500 text-[9px]">Rahul at School</p></div>
              </div>
            </div>
            <div className="absolute top-16 -right-4 bg-white rounded-2xl shadow-2xl px-3 py-2.5 anim-float2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center"><Lock size={13} className="text-red-500" /></div>
                <div><p className="text-gray-900 text-xs font-bold">App Blocked</p><p className="text-red-400 text-[9px]">TikTok · Just now</p></div>
              </div>
            </div>
            <div className="absolute bottom-28 -left-6 bg-white rounded-2xl shadow-2xl px-3 py-2.5 anim-float3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center"><Bell size={13} className="text-purple-600" /></div>
                <div><p className="text-gray-900 text-xs font-bold">SMS Alert</p><p className="text-purple-400 text-[9px]">Unknown sender flagged</p></div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/5 backdrop-blur-sm border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-white font-extrabold text-2xl">{s.value}</p>
                <p className="text-blue-300/60 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════ TICKER ═══ */}
      <div className="bg-indigo-600 py-3 overflow-hidden">
        <div className="flex gap-8 whitespace-nowrap" style={{ animation: 'ticker 24s linear infinite' }}>
          {TICKER.concat(TICKER).map((t, i) => (
            <span key={i} className="text-white/90 text-sm font-medium flex-shrink-0">
              {t} <span className="text-indigo-400 mx-3">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ FEATURES ═══ */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-blue-600 text-sm font-semibold uppercase tracking-widest">Features</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-2">Everything You Need to Keep Kids Safe</h2>
            <p className="text-gray-500 text-lg mt-3 max-w-2xl mx-auto">
              Comprehensive monitoring tools designed for modern Indian families who care about digital safety.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <div key={f.title}
                className="group bg-white rounded-2xl p-5 border border-gray-100 hover:border-transparent hover:shadow-xl transition-all duration-300 relative overflow-hidden"
                style={{ animationDelay: `${i * 0.05}s` }}>
                {/* Gradient corner on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${f.grad} opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-2xl`} />
                <div className={`relative w-12 h-12 bg-gradient-to-br ${f.grad} rounded-2xl flex items-center justify-center mb-4 shadow-lg ${f.glow} group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon size={22} className="text-white" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1.5 group-hover:text-gray-800">{f.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ DASHBOARD PREVIEW ═══ */}
      <section id="preview" className="py-24 bg-gray-900 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-indigo-400 text-sm font-semibold uppercase tracking-widest">Live Preview</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2">Powerful Dashboard at Your Fingertips</h2>
            <p className="text-gray-400 text-lg mt-3">A real-time command center that shows you everything about your child's device.</p>
          </div>

          {/* Dashboard mockup */}
          <div className="bg-gray-800 rounded-3xl border border-gray-700 overflow-hidden shadow-2xl anim-glow">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-5 py-3 bg-gray-900 border-b border-gray-700">
              <div className="flex gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-full" /><div className="w-3 h-3 bg-yellow-500 rounded-full" /><div className="w-3 h-3 bg-green-500 rounded-full" /></div>
              <div className="flex-1 mx-3 bg-gray-800 rounded-lg px-3 py-1 flex items-center gap-2">
                <div className="w-3 h-3 text-green-400">🔒</div>
                <span className="text-gray-400 text-xs">ParentGard.in/dashboard</span>
              </div>
              <div className="flex items-center gap-1.5 text-green-400 text-xs"><span className="w-2 h-2 bg-green-400 rounded-full" />Live</div>
            </div>

            {/* Dashboard content */}
            <div className="flex h-[520px]">
              {/* Sidebar */}
              <div className="w-52 bg-gray-950 border-r border-gray-800 flex flex-col p-3">
                <div className="flex items-center gap-2.5 px-2 py-3 mb-4">
                  <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center"><Shield size={16} className="text-white" /></div>
                  <div><p className="text-white text-xs font-bold">ParentGard</p><p className="text-indigo-400 text-[9px]">Parent Portal</p></div>
                </div>
                {[
                  { icon: '🏠', label: 'Overview',       active: false },
                  { icon: '📍', label: 'Location',       active: true },
                  { icon: '📞', label: 'Call Logs',      active: false },
                  { icon: '💬', label: 'SMS',            active: false },
                  { icon: '📊', label: 'App Usage',      active: false },
                  { icon: '🌐', label: 'Browsing',       active: false },
                  { icon: '🔒', label: 'App Blocking',   active: false },
                  { icon: '📸', label: 'Remote Access',  active: false },
                ].map((item) => (
                  <div key={item.label} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium mb-0.5 transition-colors
                    ${item.active ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-500 hover:text-gray-300'}`}>
                    <span>{item.icon}</span> {item.label}
                    {item.active && <div className="ml-auto w-1.5 h-1.5 bg-indigo-400 rounded-full" />}
                  </div>
                ))}
              </div>

              {/* Main area */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700">
                  <div>
                    <p className="text-white font-bold">Live Location — Rahul's Phone</p>
                    <p className="text-gray-500 text-xs">Updated 12 seconds ago</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-green-900/30 border border-green-700/40 text-green-400 text-xs px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full anim-blink" /> Online
                    </div>
                    <div className="bg-gray-700 text-gray-300 text-xs px-2.5 py-1 rounded-full">🔋 78%</div>
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Map */}
                  <div className="flex-1 bg-gray-800 relative overflow-hidden">
                    {/* Fake map */}
                    <div className="absolute inset-0 opacity-15"
                      style={{ backgroundImage: 'linear-gradient(#3a5 1px,transparent 1px),linear-gradient(90deg,#3a5 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
                    <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 to-blue-900/20" />
                    {/* SVG roads */}
                    <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 400 300">
                      <path d="M0 150 H400" stroke="#fff" strokeWidth="3" fill="none" />
                      <path d="M200 0 V300" stroke="#fff" strokeWidth="2" fill="none" />
                      <path d="M0 80 L400 220" stroke="#fff" strokeWidth="1.5" fill="none" />
                      <path d="M60 0 L340 300" stroke="#fff" strokeWidth="1" fill="none" />
                      <path d="M0 220 L400 80" stroke="#fff" strokeWidth="1" fill="none" />
                      {/* Moving dashed path */}
                      <path d="M80 40 Q200 150 320 260" stroke="#4f6" strokeWidth="2" fill="none"
                        strokeDasharray="8 6" strokeDashoffset="0" style={{ animation: 'dash-flow 1.2s linear infinite' }} />
                    </svg>
                    {/* Building blocks */}
                    {[[50,50,40,30],[120,30,60,25],[280,60,50,35],[320,100,40,28],[60,180,70,30],[250,200,55,25],[150,120,45,32]].map(([x,y,w,h], i) => (
                      <div key={i} className="absolute bg-gray-700/60 rounded-sm border border-gray-600/30"
                        style={{ left: `${x/4}%`, top: `${y/3}%`, width: `${w/4}%`, height: `${h/3}%` }} />
                    ))}
                    {/* Location pin */}
                    <div className="absolute" style={{ left: '50%', top: '50%' }}>
                      <div className="absolute w-14 h-14 -translate-x-1/2 -translate-y-1/2 border-2 border-orange-400/50 rounded-full" style={{ animation: 'ping-ring 2s ease-out infinite' }} />
                      <div className="absolute w-14 h-14 -translate-x-1/2 -translate-y-1/2 border-2 border-orange-400/30 rounded-full" style={{ animation: 'ping-ring 2s ease-out infinite .7s' }} />
                      <div className="w-9 h-9 -translate-x-1/2 -translate-y-1/2 bg-orange-500 rounded-full border-3 border-white flex items-center justify-center shadow-xl shadow-orange-500/50">
                        <MapPin size={16} className="text-white" />
                      </div>
                    </div>
                    {/* School geofence */}
                    <div className="absolute border-2 border-green-500/40 bg-green-500/10 rounded-full" style={{ left: '36%', top: '30%', width: '28%', height: '40%' }}>
                      <span className="absolute top-1 left-1/2 -translate-x-1/2 text-green-400 text-[9px] font-bold whitespace-nowrap">🏫 School Zone</span>
                    </div>
                    {/* Address overlay */}
                    <div className="absolute bottom-3 left-3 right-3 bg-gray-900/80 backdrop-blur-sm rounded-xl p-2.5 border border-gray-700">
                      <p className="text-white text-xs font-semibold">📍 Andheri West, Mumbai 400058</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-green-400 text-[10px]">✓ Inside school zone</p>
                        <p className="text-gray-500 text-[10px]">Accuracy: ±8m</p>
                        <p className="text-gray-500 text-[10px]">Speed: 0 km/h</p>
                      </div>
                    </div>
                  </div>

                  {/* Right panel */}
                  <div className="w-56 border-l border-gray-700 flex flex-col overflow-y-auto">
                    {/* Today stats */}
                    <div className="p-3 border-b border-gray-700">
                      <p className="text-gray-500 text-[9px] font-semibold uppercase mb-2">Today's Activity</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[{ label:'Calls', val:'8', color:'text-green-400' }, { label:'SMS', val:'24', color:'text-purple-400' }, { label:'Apps', val:'14', color:'text-blue-400' }, { label:'Sites', val:'37', color:'text-yellow-400' }].map((s) => (
                          <div key={s.label} className="bg-gray-800 rounded-lg p-2 text-center">
                            <p className={`text-base font-extrabold ${s.color}`}>{s.val}</p>
                            <p className="text-gray-600 text-[8px]">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Screen time */}
                    <div className="p-3 border-b border-gray-700">
                      <p className="text-gray-500 text-[9px] font-semibold uppercase mb-2">Screen Time</p>
                      {[{ app: 'YouTube', pct: 68, color: 'bg-red-500' }, { app: 'WhatsApp', pct: 45, color: 'bg-green-500' }, { app: 'PUBG', pct: 32, color: 'bg-yellow-500' }, { app: 'Chrome', pct: 22, color: 'bg-blue-500' }].map((a) => (
                        <div key={a.app} className="mb-1.5">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-gray-400 text-[9px]">{a.app}</span>
                            <span className="text-gray-500 text-[9px]">{a.pct}%</span>
                          </div>
                          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full ${a.color} rounded-full`} style={{ width: `${a.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Live feed */}
                    <div className="p-3 flex-1">
                      <p className="text-gray-500 text-[9px] font-semibold uppercase mb-2">Live Feed</p>
                      <div className="space-y-1.5">
                        {[
                          { icon: '📞', text: 'Priya calling (2m 30s)', color: 'text-green-400', time: '2m' },
                          { icon: '🌐', text: 'youtube.com opened', color: 'text-blue-400', time: '8m' },
                          { icon: '💬', text: 'SMS from +91 98…', color: 'text-purple-400', time: '15m' },
                          { icon: '🔒', text: 'TikTok blocked', color: 'text-red-400', time: '22m' },
                          { icon: '📍', text: 'Arrived at school', color: 'text-orange-400', time: '1h' },
                        ].map((e, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-[10px] mt-0.5">{e.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[9px] font-medium ${e.color} truncate`}>{e.text}</p>
                            </div>
                            <span className="text-gray-600 text-[8px] flex-shrink-0">{e.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature callouts below dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              { icon: '⚡', title: 'Real-Time Sync',   desc: 'Data syncs every 30 seconds from the child\'s device.' },
              { icon: '🔔', title: 'Instant Alerts',   desc: 'Push notifications the moment something needs attention.' },
              { icon: '📊', title: 'Rich Analytics',   desc: 'Charts, timelines, and trends for every data type.' },
              { icon: '🌍', title: 'Works Anywhere',   desc: 'Access your dashboard from any browser, any device.' },
            ].map((c) => (
              <div key={c.title} className="bg-gray-800/60 border border-gray-700 rounded-2xl p-4 text-center hover:border-indigo-600/50 transition-colors">
                <div className="text-3xl mb-2">{c.icon}</div>
                <p className="text-white font-bold text-sm mb-1">{c.title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ HOW IT WORKS ═══ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-blue-600 text-sm font-semibold uppercase tracking-widest">Simple Setup</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-2">Up and Running in Minutes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10 relative">
            <div className="hidden md:block absolute top-10 left-[calc(33%-24px)] right-[calc(33%-24px)] h-0.5 bg-gradient-to-r from-blue-100 via-indigo-200 to-blue-100" />
            {[
              { step: '01', emoji: '📥', icon: Smartphone, title: 'Install on Child\'s Device', desc: 'Download ParentGard APK from our website and install on your child\'s Android. No rooting needed.' },
              { step: '02', emoji: '🔑', icon: Shield,     title: 'Grant Permissions',           desc: 'Allow the necessary permissions via our guided setup wizard. Takes under 2 minutes.' },
              { step: '03', emoji: '📊', icon: Eye,        title: 'Monitor from Anywhere',       desc: 'Log in from any browser and get real-time insights into your child\'s device activity.' },
            ].map((s) => (
              <div key={s.step} className="relative text-center group">
                <div className="relative inline-block mb-5">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
                    <span className="text-4xl">{s.emoji}</span>
                  </div>
                  <div className="absolute -top-3 -right-3 w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xs font-extrabold rounded-full flex items-center justify-center shadow-lg shadow-blue-600/40">
                    {s.step}
                  </div>
                </div>
                <h3 className="font-extrabold text-gray-900 text-base mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ PRICING ═══ */}
      <section id="pricing" className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-blue-600 text-sm font-semibold uppercase tracking-widest">Pricing</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-2">Simple, Transparent Pricing</h2>
            <p className="text-gray-500 text-lg mt-3">Start free. Upgrade when you need more protection.</p>
          </div>

          {plansLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {[1,2,3,4].map((i) => (
                <div key={i} className="bg-white rounded-2xl border-2 border-gray-100 p-6 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-20 mb-2" /><div className="h-3 bg-gray-100 rounded w-36 mb-6" />
                  <div className="h-10 bg-gray-200 rounded w-28 mb-6" />
                  <div className="space-y-2.5 mb-6">{[1,2,3,4,5].map((j) => <div key={j} className="h-3 bg-gray-100 rounded w-full" />)}</div>
                  <div className="h-10 bg-gray-200 rounded-xl" />
                </div>
              ))}
            </div>
          ) : plans.length === 0 ? (
            <p className="text-center text-gray-400 py-16">No plans available. Please check back soon.</p>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch
              ${plans.length <= 2 ? 'xl:grid-cols-2 max-w-3xl mx-auto' : plans.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
              {plans.map((plan, idx) => {
                const style  = planStyle(idx, plan.name);
                const isFree = plan.price === 0;
                const period = plan.durationDays <= 31 ? 'month' : plan.durationDays <= 92 ? '3 months' : plan.durationDays <= 185 ? '6 months' : 'year';
                return (
                  <div key={plan.id}
                    className={`relative bg-white rounded-2xl border-2 ${style.border} p-6 flex flex-col shadow-sm hover:shadow-xl transition-all duration-300
                      ${style.ring ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                    {style.badge && (
                      <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-extrabold px-4 py-1 rounded-full shadow ${style.badgeColor}`}>
                        {style.badge}
                      </div>
                    )}
                    <div className="mb-5">
                      <h3 className="font-extrabold text-gray-900 text-xl">{plan.name}</h3>
                      {plan.description && <p className="text-gray-500 text-xs mt-0.5">{plan.description}</p>}
                    </div>
                    <div className="mb-2">
                      {isFree ? <span className="text-4xl font-extrabold text-gray-900">Free</span> : (
                        <><span className="text-gray-500 text-lg align-top mt-2 inline-block">₹</span>
                          <span className="text-4xl font-extrabold text-gray-900">{plan.price.toLocaleString('en-IN')}</span>
                          <span className="text-gray-400 text-sm ml-1">/{period}</span></>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs mb-5">{isFree ? 'No credit card required' : `${plan.durationDays} days access`}</p>
                    <ul className="space-y-2 flex-1 mb-6">
                      <li className="flex items-center gap-2 text-sm text-gray-700"><Check size={14} className="text-green-500 flex-shrink-0" />{plan.features.maxDevices} Device{plan.features.maxDevices !== 1 ? 's' : ''}</li>
                      <li className="flex items-center gap-2 text-sm text-gray-700"><Check size={14} className="text-green-500 flex-shrink-0" />{plan.features.historyDays} days history retention</li>
                      {FEATURE_LABELS.map(({ key, label }) => {
                        const included = Boolean(plan.features[key]);
                        return (
                          <li key={key} className={`flex items-center gap-2 text-sm ${included ? 'text-gray-700' : 'text-gray-300 line-through'}`}>
                            {included ? <Check size={14} className="text-green-500 flex-shrink-0" /> : <X size={14} className="text-gray-200 flex-shrink-0" />}
                            {label}
                          </li>
                        );
                      })}
                    </ul>
                    <Link href={isFree ? '/auth/register' : '/go'}
                      className={`w-full text-center py-2.5 text-sm font-bold rounded-xl transition-all ${style.btn}`}>
                      {isFree ? 'Get Started Free' : `Choose ${plan.name}`}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-center text-gray-400 text-sm mt-8">All paid plans include a 7-day money-back guarantee. Cancel anytime.</p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════ ABOUT US ═══ */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-blue-600 text-sm font-semibold uppercase tracking-widest">About Us</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-2 mb-6">Built by Parents, for Parents</h2>
              <p className="text-gray-600 leading-relaxed mb-5">
                ParentGard was founded in 2024 by a team of parents who struggled to keep their children safe in India's rapidly evolving digital landscape. We witnessed first-hand how cyberbullying, predatory behaviour, and excessive screen time were affecting Indian families.
              </p>
              <p className="text-gray-600 leading-relaxed mb-8">
                Our mission is simple: give every Indian parent the tools to protect their children without unnecessarily invading their privacy. We believe in transparent, responsible monitoring that builds trust rather than breaking it.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: HeartHandshake, color: 'text-pink-500',   bg: 'bg-pink-50',   grad: 'from-pink-500 to-rose-500',   title: 'Family First',  desc: 'Every decision is made with family well-being at the core.' },
                  { icon: Lock,           color: 'text-blue-500',   bg: 'bg-blue-50',   grad: 'from-blue-500 to-cyan-500',   title: 'Privacy Safe',  desc: 'Data is encrypted end-to-end and never sold.' },
                  { icon: Zap,            color: 'text-yellow-500', bg: 'bg-yellow-50', grad: 'from-yellow-500 to-amber-500',title: 'Always On',     desc: '99.9% uptime so you\'re always connected.' },
                  { icon: Award,          color: 'text-indigo-500', bg: 'bg-indigo-50', grad: 'from-indigo-500 to-purple-500',title: 'Made in India', desc: 'Built specifically for Indian families.' },
                ].map((v) => (
                  <div key={v.title} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                    <div className={`w-10 h-10 bg-gradient-to-br ${v.grad} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform`}>
                      <v.icon size={18} className="text-white" />
                    </div>
                    <div><p className="font-bold text-gray-900 text-sm">{v.title}</p><p className="text-gray-500 text-xs mt-0.5">{v.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonials */}
            <div className="space-y-4">
              <p className="text-gray-900 font-bold text-lg mb-5 flex items-center gap-2"><Star size={16} className="text-yellow-400 fill-yellow-400" /> What Parents Say</p>
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="bg-gradient-to-br from-gray-50 to-blue-50/30 border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:border-blue-100 transition-all duration-300">
                  <Quote size={18} className="text-blue-200 mb-2" />
                  <p className="text-gray-700 text-sm leading-relaxed mb-4 italic">"{t.text}"</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md">
                        {t.name.charAt(0)}
                      </div>
                      <div><p className="font-bold text-gray-900 text-sm">{t.name}</p><p className="text-gray-400 text-xs">{t.role}</p></div>
                    </div>
                    <div className="flex gap-0.5">{[1,2,3,4,5].map((j) => <Star key={j} size={12} className="text-yellow-400 fill-yellow-400" />)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ BLOG ═══ */}
      <section id="blog" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="text-blue-600 text-sm font-semibold uppercase tracking-widest">Blog</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-2">Resources for Digital Parenting</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {BLOGS.map((b, i) => (
              <article key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                {/* Gradient cover with emoji */}
                <div className={`h-48 bg-gradient-to-br ${b.grad} flex flex-col items-center justify-center relative overflow-hidden`}>
                  {/* Pattern overlay */}
                  <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                  <span className="text-7xl mb-2 relative" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.4))' }}>{b.emoji}</span>
                  <span className={`relative text-xs font-semibold px-3 py-1 rounded-full bg-white/20 text-white border border-white/30`}>{b.tag}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-extrabold text-gray-900 text-base mt-1 mb-2 group-hover:text-blue-600 transition-colors leading-snug">{b.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed mb-4 line-clamp-3">{b.desc}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                        {b.author.charAt(0)}
                      </div>
                      <span className="text-gray-600 text-xs font-medium">{b.author}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-400 text-xs">
                      <span className="flex items-center gap-1"><Calendar size={10} /> {b.date}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {b.read}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ CONTACT ═══ */}
      <section id="contact" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              <span className="text-blue-600 text-sm font-semibold uppercase tracking-widest">Contact Us</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-2 mb-5">We're Here to Help</h2>
              <p className="text-gray-600 leading-relaxed mb-8">Have questions about ParentGard? Our dedicated support team is available every day of the week.</p>
              <div className="space-y-5">
                {[
                  { icon: Mail,   label: 'Email Us',    value: 'support@ParentGard.in',    desc: 'Reply within 4 hours on business days' },
                  { icon: Phone,  label: 'Call Us',     value: '+91 98765 43210',            desc: 'Mon–Sat, 9 AM to 8 PM IST' },
                  { icon: MapPin, label: 'Our Office',  value: 'Mumbai, Maharashtra, India', desc: 'Visit by appointment only' },
                ].map((c) => (
                  <div key={c.label} className="flex items-start gap-4 group">
                    <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/30 group-hover:scale-110 transition-transform">
                      <c.icon size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">{c.label}</p>
                      <p className="font-bold text-gray-900 text-sm mt-0.5">{c.value}</p>
                      <p className="text-gray-400 text-xs">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-8">
                <p className="text-gray-500 text-sm mr-1">Follow Us:</p>
                {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                  <a key={i} href="#"
                    className="w-9 h-9 bg-gray-100 hover:bg-gradient-to-br hover:from-blue-600 hover:to-indigo-600 rounded-xl flex items-center justify-center transition-all hover:shadow-lg">
                    <Icon size={16} className="text-gray-500 hover:text-white" />
                  </a>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-2xl border border-gray-100 p-8 hover:shadow-lg transition-shadow">
              {submitted ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-xl shadow-green-500/30">
                    <Check size={32} className="text-white" />
                  </div>
                  <h3 className="text-xl font-extrabold text-gray-900 mb-2">Message Sent!</h3>
                  <p className="text-gray-500 text-sm">Thank you for reaching out. We'll get back to you within 4 hours.</p>
                  <button onClick={() => setSubmitted(false)} className="mt-6 text-blue-600 text-sm font-semibold hover:underline">Send another message</button>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-extrabold text-gray-900 mb-6">Send Us a Message</h3>
                  <form onSubmit={handleContact} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-gray-600 text-xs font-semibold mb-1.5 block">Full Name *</label>
                        <input required value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Rajesh Kumar"
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white transition-all" />
                      </div>
                      <div>
                        <label className="text-gray-600 text-xs font-semibold mb-1.5 block">Phone Number</label>
                        <input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="+91 98765 43210" type="tel"
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs font-semibold mb-1.5 block">Email Address *</label>
                      <input required type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="rajesh@example.com"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white transition-all" />
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs font-semibold mb-1.5 block">Message *</label>
                      <textarea required rows={4} value={contactForm.message} onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                        placeholder="How can we help you?"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white transition-all resize-none" />
                    </div>
                    <button type="submit" disabled={submitting}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2">
                      {submitting
                        ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
                        : <>Send Message <ArrowRight size={16} /></>}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════ CTA BANNER ═══ */}
      <section className="py-20 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="text-6xl mb-4">🛡️</div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Start Protecting Your Family Today</h2>
          <p className="text-blue-100 text-lg mb-8">Join 50,000+ Indian families who trust ParentGard. Free forever — no credit card required.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/auth/register"
              className="bg-white text-blue-700 hover:bg-blue-50 font-extrabold px-8 py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl text-sm">
              Create Free Account
            </Link>
            <Link href="/auth/login"
              className="bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold px-8 py-3.5 rounded-xl transition-all text-sm">
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ FOOTER ═══ */}
      <footer className="bg-gray-950 text-gray-400">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="ParentGard" className="w-9 h-9 object-contain" />
                <span className="text-white font-extrabold text-lg">ParentGard</span>
              </div>
              <p className="text-sm leading-relaxed mb-5 max-w-xs">India's most trusted parental monitoring platform. Keeping children safe in the digital world since 2024.</p>
              <div className="flex gap-3">
                {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                  <a key={i} href="#" className="w-8 h-8 bg-gray-800 hover:bg-indigo-600 rounded-lg flex items-center justify-center transition-all hover:shadow-lg">
                    <Icon size={14} className="text-gray-400" />
                  </a>
                ))}
              </div>
            </div>
            {[
              { title: 'Product',  links: ['Features', 'Pricing', 'Download App', 'Release Notes'] },
              { title: 'Company', links: ['About Us', 'Blog', 'Careers', 'Press Kit'] },
              { title: 'Support', links: ['Help Center', 'Contact Us', 'Privacy Policy', 'Terms of Service'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-white font-bold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}><button className="text-sm hover:text-white transition-colors">{link}</button></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs">© 2026 ParentGard. All rights reserved. Made with ❤️ in India.</p>
            <div className="flex items-center gap-5 text-xs">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((l) => (
                <button key={l} className="hover:text-white transition-colors">{l}</button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
