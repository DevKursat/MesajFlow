
// MesajFlow - WhatsApp & Telegram AI Bot SaaS for Restaurants & E-commerce
import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Settings, QrCode, History,
  Lock, ArrowRight, MessageCircle, RefreshCw, LogOut, MessageSquare,
  Database, Copy, Check as CheckIcon, Info as InfoIcon, AlertOctagon,
  ShoppingBag, Users, Bot, UtensilsCrossed, Store, UserPlus, Building2, Shield
} from 'lucide-react';
import DashboardView from './components/DashboardView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import ConnectionsView from './components/ConnectionsView';
import ChatSimulator from './components/ChatSimulator';
import BossView from './components/BossView';
import OrdersView from './components/OrdersView';
import MenuView from './components/MenuView';
import ProductsView from './components/ProductsView';
import CustomersView from './components/CustomersView';
import ImportView from './components/ImportView';
import ErrorBoundary from './components/ErrorBoundary';
import Toast, { ToastType } from './components/Toast';
import { fetchTransactions, fetchAiSettings, subscribeToTable, logError, initializeSettings, SUPABASE_SQL_SETUP, loginBusiness, registerBusiness } from './services/supabaseService';
import { BusinessType, AiSettings } from './types';

const LoginView: React.FC<{ onLogin: (settings: AiSettings) => void, showToast: (msg: string, type: ToastType) => void }> = ({ onLogin, showToast }) => {
  const [businessName, setBusinessName] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [showSqlHelper, setShowSqlHelper] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 30;

  useEffect(() => {
    let timer: number;
    if (lockoutTime > 0) {
      timer = window.setInterval(() => {
        setLockoutTime((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTime]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SETUP);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleInitDb = async () => {
    setIsChecking(true);
    try {
      await initializeSettings();
      showToast("Veritabanı başarıyla hazırlandı.", "SUCCESS");
    } catch (err: any) {
      showToast("Kurulum başarısız. SQL kodunu Supabase'de çalıştırın.", "ERROR");
      setShowSqlHelper(true);
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0) return;
    if (!businessName.trim()) {
      showToast("İşletme adı gerekli!", "WARN");
      return;
    }

    setIsChecking(true);
    try {
      const settings = await loginBusiness(businessName.trim(), pass);

      if (settings) {
        localStorage.setItem('mesajflow_auth', 'true');
        localStorage.setItem('mesajflow_business_id', settings.id);
        localStorage.setItem('mesajflow_business_type', settings.business_type);
        localStorage.setItem('mesajflow_business_name', settings.business_name);
        showToast(`Hoş geldiniz, ${settings.business_name}!`, "SUCCESS");
        onLogin(settings);
      } else {
        throw new Error("INVALID_CREDENTIALS");
      }
    } catch (err: any) {
      if (err.message === 'INVALID_CREDENTIALS') {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        setError(true);
        logError('AUTH', `Hatalı giriş: ${nextAttempts}/${MAX_ATTEMPTS}`, { attempt: nextAttempts }, 'WARN');

        if (nextAttempts >= MAX_ATTEMPTS) {
          setLockoutTime(LOCKOUT_DURATION);
          setFailedAttempts(0);
          showToast("Çok fazla hatalı deneme! Lütfen bekleyin.", "ERROR");
        } else {
          showToast("İşletme adı veya şifre hatalı!", "ERROR");
        }
        setTimeout(() => setError(false), 2000);
      } else if (err.code === 'DB_TABLE_MISSING' || err.message === 'DB_TABLE_MISSING') {
        setError(true);
        showToast("Veritabanı hazır değil. Sistemi ilklendirin.", "ERROR");
        setShowSqlHelper(true);
      } else {
        logError('AUTH', 'Giriş hatası', err);
        setError(true);
        showToast("Sunucu bağlantısı kurulamadı.", "ERROR");
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/10 via-transparent to-transparent">
      <div className="max-w-md w-full bg-[#0a0a0b] border border-white/5 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden animate-in zoom-in duration-500">
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${lockoutTime > 0 ? 'via-rose-500' : 'via-emerald-500'} to-transparent transition-colors`} />

        <div className="text-center space-y-4 mb-8">
          <div className={`w-20 h-20 ${lockoutTime > 0 ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'} border rounded-3xl flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.1)] transition-colors`}>
            {lockoutTime > 0 ? <AlertOctagon size={40} /> : <MessageCircle size={40} />}
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">Mesaj<span className={`${lockoutTime > 0 ? 'text-rose-500' : 'text-emerald-500'} transition-colors`}>Flow</span></h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em]">İşletme Girişi</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* İşletme Adı */}
          <div className="relative group">
            <Building2 className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${error ? 'text-rose-500' : 'text-zinc-600 group-focus-within:text-emerald-500'}`} size={20} />
            <input
              type="text"
              placeholder="İşletme Adı"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className={`w-full bg-zinc-900/50 border ${error ? 'border-rose-500' : 'border-white/5'} rounded-2xl py-5 pl-14 pr-4 text-white outline-none focus:border-emerald-500/50 transition-all font-medium`}
              autoFocus
            />
          </div>

          {/* Şifre */}
          <div className="relative group">
            <Lock className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${lockoutTime > 0 ? 'text-rose-900' : error ? 'text-rose-500' : 'text-zinc-600 group-focus-within:text-emerald-500'}`} size={20} />
            <input
              type="password"
              placeholder={lockoutTime > 0 ? `Bekleyin (${lockoutTime}s)` : "Şifre"}
              value={pass}
              disabled={lockoutTime > 0}
              onChange={(e) => setPass(e.target.value)}
              className={`w-full bg-zinc-900/50 border ${lockoutTime > 0 ? 'border-rose-900 text-rose-900' : error ? 'border-rose-500' : 'border-white/5'} rounded-2xl py-5 pl-14 pr-4 text-white outline-none focus:border-emerald-500/50 transition-all font-mono tracking-widest disabled:cursor-not-allowed`}
            />
          </div>

          <button
            disabled={isChecking || lockoutTime > 0}
            className={`w-full ${lockoutTime > 0 ? 'bg-zinc-900 text-zinc-700' : error ? 'bg-rose-500' : 'bg-emerald-500'} text-black py-5 rounded-2xl font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/10 disabled:opacity-50`}
          >
            {isChecking ? <RefreshCw className="animate-spin" size={20} /> :
              lockoutTime > 0 ? `BEKLEYİN (${lockoutTime})` :
                error ? 'HATA' : <>GİRİŞ YAP <ArrowRight size={20} /></>}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
          <button
            onClick={handleInitDb}
            className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-zinc-500 hover:text-emerald-500 uppercase tracking-widest transition-all"
          >
            <Database size={14} /> Sistemi İlklendir
          </button>
          <button
            onClick={() => setShowSqlHelper(true)}
            className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-zinc-600 hover:text-blue-500 uppercase tracking-widest transition-all"
          >
            <InfoIcon size={14} /> SQL Kurulum Kodu
          </button>
        </div>
      </div>

      {/* SQL Helper Modal */}
      {showSqlHelper && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0c0c0d] border border-white/10 w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter text-white">Veritabanı <span className="text-emerald-500">Kurulumu</span></h3>
                <p className="text-xs text-zinc-500 mt-1">Supabase SQL Editor'da çalıştırın.</p>
              </div>
              <button onClick={() => setShowSqlHelper(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-zinc-500">
                <Database size={24} />
              </button>
            </div>

            <div className="flex-1 bg-black/50 border border-white/5 rounded-2xl overflow-hidden relative">
              <pre className="p-6 text-[10px] font-mono text-emerald-500/80 h-full overflow-y-auto custom-scrollbar whitespace-pre-wrap leading-relaxed">
                {SUPABASE_SQL_SETUP}
              </pre>
              <button
                onClick={handleCopySql}
                className="absolute top-4 right-4 bg-zinc-900 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-2 text-white"
              >
                {copyStatus ? <CheckIcon size={12} className="text-emerald-500" /> : <Copy size={12} />}
                {copyStatus ? 'KOPYALANDI' : 'KOPYALA'}
              </button>
            </div>

            <button
              onClick={() => setShowSqlHelper(false)}
              className="mt-8 w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all"
            >
              KAPAT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Boss Login View - Ayrı şifre korumalı
const BossLoginView: React.FC<{ onLogin: () => void, showToast: (msg: string, type: ToastType) => void }> = ({ onLogin, showToast }) => {
  const [pass, setPass] = useState('');
  const [error, setError] = useState(false);
  const BOSS_PASSWORD = '060606';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pass === BOSS_PASSWORD) {
      localStorage.setItem('mesajflow_boss_auth', 'true');
      showToast('Boss Panel erişimi sağlandı!', 'SUCCESS');
      onLogin();
    } else {
      setError(true);
      showToast('Şifre hatalı!', 'ERROR');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-[#0a0a0b] border border-white/5 rounded-3xl p-8 shadow-2xl">
        <div className="text-center space-y-3 mb-8">
          <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 text-purple-500 rounded-2xl flex items-center justify-center mx-auto">
            <Shield size={32} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-white">Boss <span className="text-purple-500">Panel</span></h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Admin Erişimi</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 ${error ? 'text-rose-500' : 'text-zinc-600'}`} size={18} />
            <input
              type="password"
              placeholder="Boss Şifresi"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className={`w-full bg-zinc-900/50 border ${error ? 'border-rose-500' : 'border-white/5'} rounded-xl py-4 pl-12 pr-4 text-white outline-none focus:border-purple-500/50 transition-all font-mono tracking-widest`}
              autoFocus
            />
          </div>
          <button className={`w-full ${error ? 'bg-rose-500' : 'bg-purple-500'} text-black py-4 rounded-xl font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2`}>
            <Shield size={18} /> Giriş
          </button>
        </form>
        <a href="/" className="block mt-6 text-center text-[10px] text-zinc-500 hover:text-white transition-colors uppercase tracking-widest">
          ← Ana Sayfaya Dön
        </a>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // /boss URL kontrolü
  const isBossRoute = window.location.pathname === '/boss';
  const [bossAuthenticated, setBossAuthenticated] = useState(localStorage.getItem('mesajflow_boss_auth') === 'true');

  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('mesajflow_auth') === 'true');
  const [businessType, setBusinessType] = useState<BusinessType>((localStorage.getItem('mesajflow_business_type') as BusinessType) || 'RESTAURANT');
  const [businessName, setBusinessName] = useState(localStorage.getItem('mesajflow_business_name') || 'İşletme');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [businessId, setBusinessId] = useState(localStorage.getItem('mesajflow_business_id') || '');

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
  }, []);

  const handleLogin = (settings: AiSettings) => {
    setIsAuthenticated(true);
    setBusinessType(settings.business_type);
    setBusinessName(settings.business_name);
    setBusinessId(settings.id);
    localStorage.setItem('mesajflow_business_id', settings.id);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const init = async () => {
      try {
        const txs = await fetchTransactions();
        setUnreadCount(txs.filter(t => t.status === 'PENDING').length);
      } catch (err) {
        logError('APP_INIT', 'Veri yükleme hatası', err);
      }
    };
    init();

    const sub = subscribeToTable('transactions', () => {
      fetchTransactions().then(txs => {
        setUnreadCount(txs.filter(t => t.status === 'PENDING').length);
      }).catch(err => logError('REALTIME', 'Güncelleme hatası', err));
    });
    return () => { sub.unsubscribe(); };
  }, [isAuthenticated]);

  // /boss route için ayrı render
  if (isBossRoute) {
    if (!bossAuthenticated) {
      return (
        <ErrorBoundary>
          <BossLoginView onLogin={() => setBossAuthenticated(true)} showToast={showToast} />
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </ErrorBoundary>
      );
    }
    // Boss authenticated - show boss panel
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[#050505] text-zinc-100 font-['Inter'] p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-black">Boss <span className="text-purple-500">Panel</span></h1>
              <button
                onClick={() => { localStorage.removeItem('mesajflow_boss_auth'); window.location.href = '/'; }}
                className="text-xs text-zinc-500 hover:text-white flex items-center gap-2"
              >
                <LogOut size={14} /> Çıkış
              </button>
            </div>
            <BossView showToast={showToast} />
          </div>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </ErrorBoundary>
    );
  }

  if (!isAuthenticated) return (
    <ErrorBoundary>
      <LoginView onLogin={handleLogin} showToast={showToast} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </ErrorBoundary>
  );

  // Menü öğelerini işletme tipine göre filtrele
  const baseMenuItems = [
    { id: 'dashboard', label: 'Ana Panel', icon: <LayoutDashboard size={20} /> },
    { id: 'chat', label: 'Müşteri Sohbetleri', icon: <MessageSquare size={20} />, badge: unreadCount },
    { id: 'customers', label: 'Müşteriler', icon: <Users size={20} /> },
  ];

  const restaurantMenuItems: typeof baseMenuItems = [
    { id: 'orders', label: 'Siparişler', icon: <UtensilsCrossed size={20} /> },
    { id: 'menu', label: 'Menü Yönetimi', icon: <UtensilsCrossed size={20} /> },
    { id: 'import', label: 'AI Menü Import', icon: <Bot size={20} /> },
  ];

  const ecommerceMenuItems: typeof baseMenuItems = [
    { id: 'orders', label: 'Siparişler', icon: <ShoppingBag size={20} /> },
    { id: 'products', label: 'Ürün Yönetimi', icon: <Store size={20} /> },
    { id: 'import', label: 'AI Ürün Import', icon: <Bot size={20} /> },
  ];

  const commonEndMenuItems: typeof baseMenuItems = [
    { id: 'history', label: 'Geçmiş', icon: <History size={20} /> },
    { id: 'connections', label: 'Bağlantılar', icon: <QrCode size={20} /> },
    { id: 'settings', label: 'Bot Ayarları', icon: <Settings size={20} /> },
  ];

  const menuItems = [
    ...baseMenuItems,
    ...(businessType === 'RESTAURANT' ? restaurantMenuItems : ecommerceMenuItems),
    ...commonEndMenuItems,
  ];

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#050505] text-zinc-100 overflow-hidden font-['Inter']">
        <aside className="w-72 bg-[#0a0a0b] border-r border-white/5 flex flex-col shadow-2xl z-20">
          <div className="p-10">
            <h2 className="text-3xl font-black tracking-tighter">Mesaj<span className="text-emerald-500">Flow</span></h2>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-1.5 h-1.5 ${businessType === 'RESTAURANT' ? 'bg-emerald-500' : 'bg-blue-500'} rounded-full animate-pulse`} />
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate" title={businessName}>{businessName}</p>
            </div>
            <p className="text-[8px] text-zinc-600 mt-1">{businessType === 'RESTAURANT' ? 'Restoran' : 'E-Ticaret'}</p>
          </div>
          <nav className="flex-1 px-6 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all relative group ${activeTab === item.id ? 'bg-emerald-500 text-black shadow-[0_10px_30px_rgba(16,185,129,0.2)]' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
              >
                <span className={`${activeTab === item.id ? 'text-black' : 'group-hover:scale-110 transition-transform'}`}>{item.icon}</span>
                <span className="font-black text-xs uppercase tracking-widest">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`ml-auto ${activeTab === item.id ? 'bg-black text-white' : 'bg-emerald-500 text-black'} text-[10px] font-black px-2 py-0.5 rounded-lg animate-pulse`}>{item.badge}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="p-8 space-y-4">
            <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Bot size={14} className="text-emerald-500" />
                <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">AI Durumu</p>
              </div>
              <p className="text-sm font-black text-emerald-500">AKTİF</p>
            </div>
            <button
              onClick={() => { localStorage.removeItem('mesajflow_auth'); setIsAuthenticated(false); showToast("Güvenli çıkış yapıldı.", "INFO"); }}
              className="w-full flex items-center justify-center gap-2 p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-rose-500/60 hover:text-rose-500 hover:bg-rose-500/10 transition-all text-[10px] font-black uppercase tracking-widest"
            >
              <LogOut size={16} /> ÇIKIŞ
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-[#070708]">
          <header className="h-24 border-b border-white/5 flex items-center justify-between px-12 bg-[#0a0a0b]/80 backdrop-blur-2xl z-10">
            <div className="flex flex-col">
              <h2 className="text-xl font-black uppercase tracking-tighter text-zinc-200">{menuItems.find(i => i.id === activeTab)?.label}</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">MesajFlow v1.0.0</p>
            </div>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-6 px-6 py-2 bg-zinc-900/50 border border-white/5 rounded-2xl">
                <div className="text-right">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">WhatsApp</p>
                  <p className="text-sm font-black text-emerald-500 tracking-tighter">BAĞLI</p>
                </div>
                <div className="w-[1px] h-8 bg-zinc-800" />
                <div className="text-right">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Telegram</p>
                  <p className="text-sm font-black text-zinc-600 tracking-tighter">BEKLEMEDE</p>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-[1px] border border-white/10 group cursor-pointer overflow-hidden flex items-center justify-center">
                <MessageCircle size={24} className="text-white" />
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'chat' && <ChatSimulator />}
            {activeTab === 'customers' && <CustomersView businessId={businessId} showToast={showToast} />}
            {activeTab === 'orders' && <OrdersView businessId={businessId} businessType={businessType} showToast={showToast} />}
            {activeTab === 'menu' && <MenuView businessId={businessId} showToast={showToast} />}
            {activeTab === 'products' && <ProductsView businessId={businessId} showToast={showToast} />}
            {activeTab === 'import' && <ImportView businessId={businessId} businessType={businessType} showToast={showToast} />}
            {activeTab === 'history' && <HistoryView />}
            {activeTab === 'settings' && <SettingsView />}
            {activeTab === 'connections' && <ConnectionsView />}
          </div>
        </main>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </ErrorBoundary>
  );
};

export default App;
