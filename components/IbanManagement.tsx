
import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, Plus, Trash2, ShieldCheck, TrendingUp, 
  Settings2, AlertCircle, RefreshCw, X, Check, ArrowUpDown, Info,
  ChevronUp, ChevronDown, CheckSquare, Square, Zap, BarChart3, PieChart,
  Brain, Sparkles, Filter
} from 'lucide-react';
import { Iban } from '../types';
import { fetchIbans, addIban, updateIban, deleteIban, subscribeToTable } from '../services/supabaseService';

const IbanManagement: React.FC = () => {
  const [ibans, setIbans] = useState<Iban[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSmartSort, setIsSmartSort] = useState(true); // Akıllı rotasyon varsayılan açık
  
  const [newIban, setNewIban] = useState<Partial<Iban>>({
    bank_name: '',
    account_holder: '',
    iban_number: '',
    limit: 100000,
    priority: 5,
    description: ''
  });

  const loadIbans = async () => {
    setLoading(true);
    const data = await fetchIbans();
    setIbans(data);
    setLoading(false);
  };

  useEffect(() => {
    loadIbans();
    const sub = subscribeToTable('ibans', loadIbans);
    return () => { sub.unsubscribe(); };
  }, []);

  // Akıllı Sıralama Algoritması
  const sortedIbans = useMemo(() => {
    if (!isSmartSort) return [...ibans].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return [...ibans].sort((a, b) => {
      // 1. Aktif olanlar her zaman önce gelir
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      
      const aUsage = (Number(a.current_total) || 0) / (Number(a.limit) || 1);
      const bUsage = (Number(b.current_total) || 0) / (Number(b.limit) || 1);

      // 2. Limiti daha boş olan (kullanım oranı düşük) önce gelir
      if (Math.abs(aUsage - bUsage) > 0.05) { // %5 fark varsa doluluğa bak
        return aUsage - bUsage;
      }

      // 3. Eşitlik durumunda manuel öncelik (priority) devreye girer
      return (b.priority || 0) - (a.priority || 0);
    });
  }, [ibans, isSmartSort]);

  const handleAddIban = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIban.iban_number || !newIban.bank_name) return;
    
    setIsSaving(true);
    try {
      await addIban(newIban);
      setShowModal(false);
      setNewIban({
        bank_name: '',
        account_holder: '',
        iban_number: '',
        limit: 100000,
        priority: 5,
        description: ''
      });
      loadIbans();
    } catch (err) {
      alert("Hata: IBAN kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    await updateIban(id, { is_active: !current });
    loadIbans();
  };

  const updatePriority = async (id: string, delta: number) => {
    const iban = ibans.find(i => i.id === id);
    if (!iban) return;
    const newPriority = Math.max(1, Math.min(10, (iban.priority || 5) + delta));
    await updateIban(id, { priority: newPriority });
    loadIbans();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bu IBAN'ı silmek istediğinize emin misiniz?")) {
      await deleteIban(id);
      loadIbans();
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkAction = async (action: 'active' | 'passive' | 'delete') => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      for (const id of selectedIds) {
        if (action === 'active') await updateIban(id, { is_active: true });
        else if (action === 'passive') await updateIban(id, { is_active: false });
        else if (action === 'delete') await deleteIban(id);
      }
      setSelectedIds([]);
      loadIbans();
    } catch (err) {
      alert("İşlem hatası.");
    } finally {
      setLoading(false);
    }
  };

  const statsSummary = useMemo(() => {
    const active = ibans.filter(i => i.is_active).length;
    const totalVolume = ibans.reduce((sum, i) => sum + (Number(i.current_total) || 0), 0);
    const totalLimit = ibans.reduce((sum, i) => sum + (Number(i.limit) || 0), 0);
    const utilization = totalLimit > 0 ? (totalVolume / totalLimit) * 100 : 0;
    return { active, totalVolume, utilization };
  }, [ibans]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
            Finansal <span className="text-emerald-500">Rotasyon</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Sistemdeki aktif IBAN'lar ve kullanım limitlerini buradan yönetin.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsSmartSort(!isSmartSort)}
            className={`px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-2 border ${isSmartSort ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-xl shadow-emerald-500/10' : 'bg-zinc-900 text-zinc-500 border-white/5'}`}
          >
            {isSmartSort ? <Brain size={18} className="animate-pulse" /> : <Filter size={18} />}
            AKILLI ROTASYON: {isSmartSort ? 'AKTİF' : 'KAPALI'}
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-emerald-500 text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-xl shadow-emerald-500/20"
          >
            <Plus size={18} /> YENİ IBAN EKLE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0c0c0d] border border-white/5 rounded-[2rem] p-6 flex items-center gap-6 group">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-500/20 transition-transform">
            <ShieldCheck size={28} />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Aktif Kanallar</p>
            <h4 className="text-2xl font-black text-white">{statsSummary.active} / {ibans.length}</h4>
          </div>
        </div>
        <div className="bg-[#0c0c0d] border border-white/5 rounded-[2rem] p-6 flex items-center gap-6 group">
          <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-500/20 transition-transform">
            <BarChart3 size={28} />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Toplam Sirkülasyon</p>
            <h4 className="text-2xl font-black text-white">₺{statsSummary.totalVolume.toLocaleString()}</h4>
          </div>
        </div>
        <div className="bg-[#0c0c0d] border border-white/5 rounded-[2rem] p-6 flex items-center gap-6 group">
          <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center border border-amber-500/20 transition-transform">
            <PieChart size={28} />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Kapasite Kullanımı</p>
            <h4 className="text-2xl font-black text-white">%{statsSummary.utilization.toFixed(1)}</h4>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-emerald-500 text-black px-8 py-4 rounded-[1.5rem] flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4">
          <div className="flex items-center gap-4">
            <CheckSquare size={20} />
            <span className="text-sm font-black uppercase tracking-widest">{selectedIds.length} IBAN SEÇİLDİ</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handleBulkAction('active')} className="bg-black text-emerald-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all">AKTİF ET</button>
            <button onClick={() => handleBulkAction('passive')} className="bg-black text-amber-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all">PASİFE AL</button>
            <button onClick={() => handleBulkAction('delete')} className="bg-rose-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all">SİL</button>
            <button onClick={() => setSelectedIds([])} className="bg-black/10 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black/20 transition-all">İPTAL</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-500 gap-4">
            <RefreshCw size={40} className="animate-spin text-emerald-500" />
            <p className="font-black uppercase tracking-widest text-xs animate-pulse">Analiz Ediliyor...</p>
          </div>
        ) : sortedIbans.length === 0 ? (
          <div className="col-span-full h-64 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center gap-4 text-zinc-600 bg-black/20">
            <CreditCard size={48} strokeWidth={1} />
            <p className="font-black uppercase text-xs tracking-widest">Henüz IBAN eklenmemiş.</p>
          </div>
        ) : (
          sortedIbans.map((iban) => {
            const usagePercent = Math.min((Number(iban.current_total || 0) / Number(iban.limit || 1)) * 100, 100);
            const isSelected = selectedIds.includes(iban.id);
            
            // Skor hesaplama (Görsel için)
            const efficiencyScore = iban.is_active ? Math.max(0, 100 - usagePercent).toFixed(0) : "0";

            return (
              <div 
                key={iban.id} 
                className={`bg-[#0c0c0d] border ${isSelected ? 'border-emerald-500 ring-1 ring-emerald-500/50 shadow-emerald-500/10' : 'border-white/5'} ${iban.is_active ? 'shadow-lg shadow-black/40' : 'opacity-70 grayscale-[0.3]'} rounded-[2.5rem] p-8 transition-all hover:border-emerald-500/20 group animate-in slide-in-from-bottom-4`}
              >
                {/* Header row with score and checkbox */}
                <div className="flex items-center justify-end gap-3 mb-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                    <Sparkles size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">Sıra Puanı: {efficiencyScore}</span>
                  </div>
                  <button 
                    onClick={() => toggleSelect(iban.id)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-zinc-600 hover:text-zinc-400'}`}
                  >
                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </div>

                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${iban.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-white/5'}`}>
                      <CreditCard size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-black tracking-tight text-zinc-200">{iban.bank_name}</h4>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{iban.account_holder}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleStatus(iban.id, iban.is_active)}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${iban.is_active ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}
                      title={iban.is_active ? "Pasife Al" : "Aktif Et"}
                    >
                      {iban.is_active ? <Check size={20} /> : <X size={20} />}
                    </button>
                    <button 
                      onClick={() => handleDelete(iban.id)}
                      className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-black/40 rounded-2xl p-4 border border-white/5 relative group/iban hover:border-emerald-500/20 transition-all">
                    <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mb-1">IBAN Numarası</p>
                    <p className="text-sm font-mono text-emerald-500/80 tracking-wider break-all">{iban.iban_number}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Bot Önceliği</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Zap size={14} className="text-emerald-500" />
                          <span className="text-lg font-black text-white">{iban.priority}/10</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => updatePriority(iban.id, 1)} className="p-1.5 hover:bg-emerald-500/10 rounded-md text-emerald-500 transition-all"><ChevronUp size={16}/></button>
                        <button onClick={() => updatePriority(iban.id, -1)} className="p-1.5 hover:bg-rose-500/10 rounded-md text-rose-500 transition-all"><ChevronDown size={16}/></button>
                      </div>
                    </div>
                    <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5">
                      <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Kullanım Frekansı</p>
                      <div className="flex items-center gap-2 mt-1 text-emerald-500 font-black">
                        <TrendingUp size={14} />
                        <span className="text-lg">{iban.usage_count || 0} İşlem</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Limit Rezerve Oranı</p>
                      <p className="text-xs font-black text-zinc-300">₺{(Number(iban.current_total) || 0).toLocaleString()} / ₺{iban.limit.toLocaleString()}</p>
                    </div>
                    <div className="h-4 bg-zinc-900 rounded-full overflow-hidden border border-white/5 p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${usagePercent > 80 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : usagePercent > 50 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0a0a0b] border border-white/10 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 -rotate-12 pointer-events-none">
              <CreditCard size={250} />
            </div>
            
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter">IBAN <span className="text-emerald-500">Kayıt Sistemi</span></h3>
                <p className="text-zinc-500 text-xs mt-1">Sisteme yeni bir yatırım noktası tanımlayın.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center transition-all">
                <X size={24} className="text-zinc-500" />
              </button>
            </div>

            <form onSubmit={handleAddIban} className="grid grid-cols-2 gap-6 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Banka İsmi</label>
                <input 
                  required
                  type="text" 
                  value={newIban.bank_name} 
                  onChange={e => setNewIban({...newIban, bank_name: e.target.value})} 
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-emerald-500 transition-all font-bold" 
                  placeholder="Örn: Garanti BBVA" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Hesap Sahibi</label>
                <input 
                  required
                  type="text" 
                  value={newIban.account_holder} 
                  onChange={e => setNewIban({...newIban, account_holder: e.target.value})} 
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-emerald-500 transition-all font-bold" 
                  placeholder="Örn: Ahmet Yılmaz" 
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">IBAN Numarası</label>
                <input 
                  required
                  type="text" 
                  value={newIban.iban_number} 
                  onChange={e => setNewIban({...newIban, iban_number: e.target.value.replace(/\s/g, '').toUpperCase()})} 
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 px-6 text-emerald-500 outline-none focus:border-emerald-500 transition-all font-mono tracking-widest" 
                  placeholder="TR0000..." 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Maksimum Limit (₺)</label>
                <input 
                  type="number" 
                  value={newIban.limit} 
                  onChange={e => setNewIban({...newIban, limit: Number(e.target.value)})} 
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-emerald-500 transition-all font-bold" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Öncelik (1-10)</label>
                <input 
                  type="number" min="1" max="10"
                  value={newIban.priority} 
                  onChange={e => setNewIban({...newIban, priority: Number(e.target.value)})} 
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-emerald-500 transition-all font-bold" 
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Özel Not</label>
                <textarea 
                  value={newIban.description} 
                  onChange={e => setNewIban({...newIban, description: e.target.value})} 
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 px-6 text-zinc-400 outline-none focus:border-emerald-500 transition-all text-sm h-24 resize-none" 
                  placeholder="IBAN için özel not..."
                />
              </div>

              <div className="col-span-2 pt-4">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full bg-emerald-500 text-black py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="animate-spin mx-auto" size={24} /> : 'IBAN HAVUZUNA EKLE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IbanManagement;
