
import React, { useState, useEffect } from 'react';
import { QrCode, Smartphone, Trash2, Wifi, WifiOff, Loader2, Plus, X, UserCheck, Zap, ShieldCheck, Battery, SignalHigh } from 'lucide-react';
import { fetchConnections, createConnection, deleteConnection, subscribeToTable } from '../services/supabaseService';
import { WhatsAppConnection } from '../types';

const ConnectionsView: React.FC = () => {
  const [conns, setConns] = useState<WhatsAppConnection[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newConn, setNewConn] = useState({ name: '', rep: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadConnections = () => fetchConnections().then(setConns);

  useEffect(() => {
    loadConnections();
    const sub = subscribeToTable('whatsapp_connections', loadConnections);
    return () => { sub.unsubscribe(); };
  }, []);

  const handleCreate = async () => {
    if (conns.length >= 5) {
      setError("Maksimum 5 kanal limitine ulaştınız.");
      return;
    }
    if (!newConn.name || !newConn.rep) return;
    
    setLoading(true);
    try {
      await createConnection(newConn.name, newConn.rep, newConn.phone);
      setShowModal(false);
      setNewConn({ name: '', rep: '', phone: '' });
      setError('');
    } catch (err: any) {
      setError(err.message === 'LIMIT_REACHED' ? "Tüm slotlar dolu." : "Bağlantı başlatılamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bu kanalı kalıcı olarak silmek ve bağlantıyı koparmak istediğinize emin misiniz?")) {
      await deleteConnection(id);
      loadConnections();
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
            Kanal <span className="text-emerald-500">Merkezi</span>
            <span className="text-[10px] bg-zinc-900 border border-white/5 text-zinc-500 px-3 py-1 rounded-full ml-4 font-black">SLOT: {conns.length}/5</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Aynı anda 5 farklı numara üzerinden AI desteği sağlayın.</p>
        </div>
        {conns.length < 5 && (
          <button 
            onClick={() => setShowModal(true)}
            className="bg-emerald-500 text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-xl shadow-emerald-500/20"
          >
            <Plus size={18} /> YENİ KANAL BAĞLA
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {conns.map(conn => (
          <div key={conn.id} className={`bg-[#0c0c0d] border ${conn.status === 'CONNECTED' ? 'border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.05)]' : 'border-white/5'} rounded-[3rem] p-8 flex flex-col gap-8 relative group transition-all`}>
             <div className="flex justify-between items-start">
                <div className="flex items-center gap-6">
                   <div className={`w-20 h-20 rounded-3xl flex items-center justify-center border-2 transition-all ${
                     conn.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-lg shadow-emerald-500/10' : 
                     conn.status === 'ERROR' || conn.status === 'DISCONNECTED' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                     conn.status === 'RECONNECTING' || conn.status === 'INITIALIZING' || conn.status === 'QR_READY' || conn.status === 'PAIRING_READY' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-zinc-900 text-zinc-700 border-white/5'
                   }`}>
                      {conn.status === 'CONNECTED' ? <Wifi size={36} className="animate-pulse" /> : 
                       (conn.status === 'RECONNECTING' || conn.status === 'INITIALIZING') ? <Loader2 size={36} className="animate-spin" /> :
                       (conn.status === 'QR_READY' || conn.status === 'PAIRING_READY') ? <QrCode size={36} className="animate-pulse" /> :
                       <WifiOff size={36} />}
                   </div>
                   <div>
                      <h4 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        {conn.name}
                        {conn.status === 'CONNECTED' && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />}
                        {(conn.status === 'RECONNECTING' || conn.status === 'INITIALIZING') && <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />}
                      </h4>
                      <div className="flex items-center gap-2 text-emerald-500/60 text-[10px] font-black uppercase mt-1">
                         <UserCheck size={12} /> Temsilci: {conn.representative_name}
                      </div>
                   </div>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => handleDelete(conn.id)} className="w-12 h-12 bg-white/5 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl flex items-center justify-center transition-all">
                     <Trash2 size={20} />
                   </button>
                </div>
             </div>

             <div className="grid grid-cols-3 gap-4">
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
                   <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-1">Şebeke</p>
                   <SignalHigh size={18} className={conn.status === 'CONNECTED' ? 'text-emerald-500' : 'text-zinc-800'} />
                </div>
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
                   <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-1">Batarya</p>
                   <div className="flex items-center gap-1.5 text-xs font-black text-zinc-400">
                     <Battery size={16} className="text-emerald-500/50" /> {conn.battery_level || 100}%
                   </div>
                </div>
                <div className={`bg-black/40 rounded-2xl p-4 border border-white/5 flex flex-col items-center ${conn.status === 'CONNECTED' ? 'border-emerald-500/20' : ''}`}>
                   <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-1">AI Motor</p>
                   <Zap size={18} className={conn.status === 'CONNECTED' ? 'text-emerald-500 animate-bounce' : 'text-zinc-800'} />
                </div>
             </div>

             <div className="space-y-4">
                <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                   <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Bağlı Numara</span>
                   <span className="text-sm font-mono text-zinc-200">+{conn.phone_number || '---'}</span>
                </div>
                
                {(conn.status === 'INITIALIZING' || conn.status === 'RECONNECTING') && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-6 flex flex-col items-center gap-3 animate-pulse">
                    <Loader2 size={32} className="text-amber-500 animate-spin" />
                    <p className="text-[10px] text-amber-500 font-black uppercase tracking-[0.15em] text-center">
                      {conn.status === 'INITIALIZING' ? 'QR Kod Hazırlanıyor...' : 'Yeniden Bağlanılıyor...'}
                    </p>
                  </div>
                )}

                {conn.status === 'QR_READY' && conn.qr_code && (
                  <div className="bg-white p-6 rounded-[2rem] flex flex-col items-center gap-4 animate-in zoom-in">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(conn.qr_code)}`} alt="QR" className="w-48 h-48" />
                    <p className="text-[10px] text-black font-black uppercase tracking-[0.2em] text-center">Cihazdan QR Okutun</p>
                  </div>
                )}

                {conn.status === 'PAIRING_READY' && conn.pairing_code && (
                  <div className="bg-emerald-500 text-black rounded-[2rem] p-8 text-center shadow-2xl animate-in slide-in-from-bottom-4">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-70">WhatsApp Web Eşleşme Kodu</p>
                    <p className="text-5xl font-mono font-black tracking-[0.4em]">{conn.pairing_code}</p>
                    <p className="text-[9px] mt-6 font-bold opacity-60 uppercase">Cihazda "Numara ile bağla" seçeneğine bu kodu girin.</p>
                  </div>
                )}

                {conn.status === 'DISCONNECTED' && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-[2rem] p-6 flex flex-col items-center gap-3">
                    <WifiOff size={32} className="text-rose-500" />
                    <p className="text-[10px] text-rose-500 font-black uppercase tracking-[0.15em] text-center">Bağlantı Koptu - Silip Yeniden Ekleyin</p>
                  </div>
                )}
             </div>

             {conn.status === 'CONNECTED' && (
               <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                 <ShieldCheck size={16} className="text-emerald-500" />
                 <span className="text-[10px] font-black text-emerald-500/80 uppercase tracking-[0.1em]">AI Mühendisliği Bu Kanal İçin Aktif</span>
               </div>
             )}
          </div>
        ))}

        {conns.length < 5 && Array.from({ length: 5 - conns.length }).map((_, i) => (
          <div key={`empty-${i}`} className="border-2 border-dashed border-white/5 rounded-[3rem] h-[400px] flex flex-col items-center justify-center gap-4 text-zinc-800 hover:border-zinc-800 transition-colors group cursor-pointer" onClick={() => setShowModal(true)}>
             <div className="w-16 h-16 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
               <Plus size={32} />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em]">Boş Kanal Slotu {conns.length + i + 1}</p>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-md animate-in fade-in">
           <div className="bg-[#0a0a0b] border border-white/10 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-5 -rotate-12 pointer-events-none"><Smartphone size={250} /></div>
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Yeni <span className="text-emerald-500">Kanal Slotu</span></h3>
                <button onClick={() => setShowModal(false)} className="w-12 h-12 bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl flex items-center justify-center transition-all"><X size={24} /></button>
              </div>
              
              <div className="space-y-6 relative z-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Kanal İsmi</label>
                  <input type="text" value={newConn.name} onChange={e => setNewConn({...newConn, name: e.target.value})} className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-5 px-8 text-white outline-none focus:border-emerald-500 transition-all font-bold" placeholder="Örn: Gece Vardiyası" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">AI Temsilci Adı</label>
                  <input type="text" value={newConn.rep} onChange={e => setNewConn({...newConn, rep: e.target.value})} className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-5 px-8 text-white outline-none focus:border-emerald-500 transition-all font-bold" placeholder="Örn: Selin" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Numara (Pairing için opsiyonel)</label>
                  <input type="text" value={newConn.phone} onChange={e => setNewConn({...newConn, phone: e.target.value})} className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-5 px-8 text-white outline-none focus:border-emerald-500 transition-all font-mono" placeholder="905xxxxxxxxx" />
                </div>
                {error && <p className="text-rose-500 text-[10px] font-black text-center uppercase tracking-widest animate-pulse">{error}</p>}
                <button onClick={handleCreate} disabled={loading} className="w-full bg-emerald-500 text-black py-6 rounded-[1.5rem] font-black uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50">
                  {loading ? <Loader2 size={24} className="animate-spin mx-auto" /> : 'KANALI AKTİF ET'}
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionsView;
