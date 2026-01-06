
import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Eye, ShieldCheck, AlertTriangle, RefreshCw, CreditCard, Zap, FileText, Copy, BadgeCheck, Download, ExternalLink, Loader2 } from 'lucide-react';
import { Transaction } from '../types';
import { fetchTransactions, updateTransactionStatus, subscribeToTable } from '../services/supabaseService';

// Media tipi belirleme yardımcı fonksiyonu
const getMediaType = (url: string): 'image' | 'pdf' | 'unknown' => {
  if (!url) return 'unknown';
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.pdf') || lowerUrl.includes('application/pdf')) return 'pdf';
  if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)/)) return 'image';
  if (lowerUrl.includes('supabase') && !lowerUrl.includes('.pdf')) return 'image';
  return 'image';
};

interface SelectedMedia {
  url: string;
  type: 'image' | 'pdf' | 'unknown';
  transaction?: Transaction;
}

const ApprovalQueue: React.FC = () => {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set()); // İşleniyor durumu

  useEffect(() => {
    const init = async () => {
      const data = await fetchTransactions();
      setItems(data.filter(t => t.status === 'PENDING' || t.status === 'APPROVED'));
      setLoading(false);
    };

    init();

    // Realtime subscription - anlık güncelleme
    const subscription = subscribeToTable('transactions', (payload) => {
      const tx = payload.new as Transaction;
      
      if (payload.type === 'INSERT') {
        if (tx.status === 'PENDING' || tx.status === 'APPROVED') {
          setItems(prev => [tx, ...prev.filter(i => i.id !== tx.id)]);
        }
      } else if (payload.type === 'UPDATE') {
        // İşleniyor durumunu kaldır
        setProcessingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(tx.id);
          return newSet;
        });
        
        setItems(prev => {
          // REJECTED veya CREDITED ise listeden çıkar
          if (tx.status === 'REJECTED' || tx.status === 'CREDITED') {
            return prev.filter(i => i.id !== tx.id);
          }
          // PENDING veya APPROVED ise güncelle veya ekle
          if (tx.status === 'PENDING' || tx.status === 'APPROVED') {
            const exists = prev.some(i => i.id === tx.id);
            if (exists) {
              return prev.map(i => i.id === tx.id ? { ...i, ...tx } : i);
            } else {
              return [tx, ...prev];
            }
          }
          return prev;
        });
      } else if (payload.type === 'DELETE') {
        setItems(prev => prev.filter(i => i.id !== payload.old.id));
        setProcessingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(payload.old.id);
          return newSet;
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Media açma fonksiyonu
  const openMedia = useCallback((url: string | undefined, transaction?: Transaction) => {
    if (!url) {
      setMediaError('Dekont URL\'si bulunamadı');
      return;
    }
    
    setMediaLoading(true);
    setMediaError(null);
    
    const mediaType = getMediaType(url);
    console.log('[Media] Açılıyor:', url, 'Tip:', mediaType);
    
    setSelectedMedia({ url, type: mediaType, transaction });
    setMediaLoading(false);
  }, []);

  // Media kapatma
  const closeMedia = useCallback(() => {
    setSelectedMedia(null);
    setMediaError(null);
    setMediaLoading(false);
  }, []);

  // Aksiyon handler - optimistic update ile
  const handleAction = async (id: string, newStatus: string) => {
    // İşleniyor durumuna al
    setProcessingIds(prev => new Set(prev).add(id));
    
    // Optimistic update - anında UI'dan kaldır/güncelle
    if (newStatus === 'REJECTED' || newStatus === 'CREDITED') {
      setItems(prev => prev.filter(i => i.id !== id));
    } else if (newStatus === 'APPROVED') {
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'APPROVED' } : i));
    }
    
    try {
      await updateTransactionStatus(id, newStatus);
    } catch (err) {
      console.error("İşlem güncellenemedi:", err);
      // Hata durumunda verileri yeniden yükle
      const data = await fetchTransactions();
      setItems(data.filter(t => t.status === 'PENDING' || t.status === 'APPROVED'));
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <ShieldCheck className="text-emerald-500" /> Yatırım Onay Masası
          </h1>
          <p className="text-zinc-500 text-sm font-medium">Gelen dekontlar AI tarafından analiz edilip buraya düşer.</p>
        </div>
        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-emerald-500 uppercase tracking-tighter">Canlı Veri Akışı</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-500">
            <RefreshCw size={30} className="animate-spin text-emerald-500" />
            <p className="text-sm font-black uppercase tracking-widest animate-pulse">Veriler senkronize ediliyor...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="h-64 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-zinc-700 bg-black/20">
            <FileText size={48} strokeWidth={1} />
            <p className="font-black uppercase text-[10px] tracking-[0.2em]">Onay bekleyen işlem bulunmuyor.</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`bg-[#0c0c0d] border ${item.status === 'APPROVED' ? 'border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.05)]' : 'border-white/5'} rounded-[2.5rem] p-6 transition-all flex items-center gap-8 group relative overflow-hidden animate-in fade-in slide-in-from-right-4 hover:border-white/10`}>
              {item.status === 'APPROVED' && (
                <div className="absolute top-0 right-0 px-4 py-1.5 bg-blue-500 text-black text-[10px] font-black uppercase tracking-widest rounded-bl-2xl shadow-lg">Bakiye Bekliyor</div>
              )}
              
              <div 
                className="w-24 h-24 bg-zinc-900 rounded-[1.5rem] flex-shrink-0 relative overflow-hidden cursor-pointer group/img border border-white/5 shadow-inner"
                onClick={() => openMedia(item.receipt_url, item)}
              >
                {item.receipt_url ? (
                  getMediaType(item.receipt_url) === 'pdf' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-red-400 bg-red-500/5">
                      <FileText size={28} />
                      <span className="text-[8px] mt-1 font-bold">PDF</span>
                    </div>
                  ) : (
                    <img 
                      src={item.receipt_url} 
                      alt="receipt" 
                      className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-500" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-zinc-600"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg></div>';
                      }}
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <FileText size={32} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                  <Eye size={20} className="text-white" />
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black">Müşteri Detayı</p>
                  <p className="font-black text-zinc-200 text-base">{item.sender_name || 'Gizli Oyuncu'}</p>
                  <p className="text-[10px] text-emerald-500 font-mono tracking-tighter bg-emerald-500/5 px-2 py-0.5 rounded w-fit">{item.customer_phone}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black">Finansal Veri</p>
                  <p className="text-2xl font-black text-emerald-500 tracking-tighter">₺{Number(item.amount).toLocaleString()}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase truncate max-w-[150px]">{item.bank_name || 'Banka Tespit Edilemedi'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black">Kullanıcı Adı</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span 
                      onClick={() => item.username && copyToClipboard(item.username)}
                      className="text-sm font-black text-zinc-300 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 hover:bg-white/10 cursor-pointer flex items-center gap-2 transition-all"
                    >
                      {item.username || '---'}
                      {item.username && <Copy size={12} className="text-zinc-500" />}
                    </span>
                  </div>
                </div>
                <div className="flex items-center">
                   {Number(item.amount) > 15000 && (
                     <div className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 text-rose-500 rounded-xl text-[9px] font-black uppercase border border-rose-500/20 shadow-lg shadow-rose-500/5 animate-pulse"><AlertTriangle size={14} /> Yüksek Riskli</div>
                   )}
                </div>
              </div>

              <div className="flex items-center gap-3 relative z-10">
                {processingIds.has(item.id) ? (
                  <div className="flex items-center gap-2 px-6 py-3 bg-zinc-800 rounded-2xl">
                    <Loader2 size={18} className="animate-spin text-emerald-500" />
                    <span className="text-xs font-bold text-zinc-400">İşleniyor...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleAction(item.id, 'REJECTED')} 
                        disabled={processingIds.has(item.id)}
                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-900 border border-white/5 text-zinc-600 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all group/btn disabled:opacity-50"
                        title="İşlemi Reddet"
                      >
                        <X size={20} className="group-hover/btn:scale-110 transition-transform" />
                      </button>
                      
                      {item.status === 'PENDING' && (
                        <button 
                          onClick={() => handleAction(item.id, 'APPROVED')} 
                          disabled={processingIds.has(item.id)}
                          className="px-5 h-12 flex items-center justify-center gap-2 rounded-2xl bg-zinc-800 text-zinc-200 border border-white/5 font-black hover:bg-zinc-700 transition-all text-[10px] uppercase tracking-widest group/approve disabled:opacity-50"
                          title="Sadece Onayla (Bakiye Yüklemez)"
                        >
                          <Check size={16} className="text-blue-400" /> ONAYLA
                        </button>
                      )}
                    </div>

                    <button 
                      onClick={() => handleAction(item.id, 'CREDITED')} 
                      disabled={processingIds.has(item.id)}
                      className={`px-8 h-12 flex items-center justify-center gap-3 rounded-2xl font-black transition-all shadow-xl text-[10px] uppercase tracking-widest group/credit disabled:opacity-50 ${
                        item.status === 'PENDING' 
                        ? 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20' 
                        : 'bg-blue-500 text-black hover:bg-blue-400 shadow-blue-500/20'
                      }`}
                      title="Doğrudan Bakiye Yükle"
                    >
                      <Zap size={16} className="group-hover/credit:animate-pulse" /> 
                      {item.status === 'PENDING' ? 'DİREKT BAKİYE' : 'BAKİYE YÜKLE'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Media Modal - PDF ve Görsel desteği */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/95 backdrop-blur-md animate-in fade-in" onClick={closeMedia}>
           <div className="relative max-w-4xl w-full max-h-[90vh] bg-[#0c0c0d] border border-white/10 rounded-[2.5rem] overflow-hidden p-6 md:p-8 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <FileText className="text-emerald-500" size={20} />
                  <h3 className="font-black text-zinc-500 uppercase tracking-widest text-[10px]">
                    {selectedMedia.type === 'pdf' ? 'PDF Dekont' : 'İşlem Kanıtı / Dekont'}
                  </h3>
                  {selectedMedia.transaction && (
                    <span className="text-emerald-500 text-xs font-bold ml-2">
                      ₺{Number(selectedMedia.transaction.amount).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Yeni sekmede aç */}
                  <a 
                    href={selectedMedia.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 bg-white/5 hover:bg-blue-500/10 hover:text-blue-500 rounded-2xl transition-all text-zinc-500"
                    title="Yeni sekmede aç"
                  >
                    <ExternalLink size={18} />
                  </a>
                  {/* İndir */}
                  <a 
                    href={selectedMedia.url} 
                    download 
                    className="p-3 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-500 rounded-2xl transition-all text-zinc-500"
                    title="İndir"
                  >
                    <Download size={18} />
                  </a>
                  {/* Kapat */}
                  <button onClick={closeMedia} className="p-3 bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-all text-zinc-500 group">
                    <X size={20} className="group-hover:rotate-90 transition-transform" />
                  </button>
                </div>
              </div>
              
              {/* Loading State */}
              {mediaLoading && (
                <div className="flex-1 flex items-center justify-center">
                  <RefreshCw size={40} className="animate-spin text-emerald-500" />
                </div>
              )}
              
              {/* Error State */}
              {mediaError && (
                <div className="flex-1 flex flex-col items-center justify-center text-rose-500 gap-4">
                  <AlertTriangle size={48} />
                  <p className="text-sm font-bold">{mediaError}</p>
                  <a 
                    href={selectedMedia.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-blue-500 text-black rounded-xl text-xs font-bold hover:bg-blue-400 transition-all"
                  >
                    Yeni Sekmede Dene
                  </a>
                </div>
              )}
              
              {/* Content Area */}
              {!mediaLoading && !mediaError && (
                <div className="flex-1 overflow-auto min-h-[300px] max-h-[70vh]">
                  {selectedMedia.type === 'pdf' ? (
                    // PDF Görüntüleyici
                    <div className="w-full h-full min-h-[500px] flex flex-col">
                      <iframe
                        src={`${selectedMedia.url}#toolbar=1&navpanes=0`}
                        className="w-full flex-1 min-h-[500px] rounded-2xl border border-white/5"
                        title="PDF Dekont"
                        onError={() => setMediaError('PDF yüklenemedi')}
                      />
                      {/* PDF yüklenemezse alternatif */}
                      <div className="mt-4 p-4 bg-zinc-900/50 rounded-xl text-center">
                        <p className="text-zinc-500 text-xs mb-3">PDF görüntülenemiyor mu?</p>
                        <a 
                          href={selectedMedia.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-black rounded-lg text-xs font-bold hover:bg-blue-400 transition-all"
                        >
                          <ExternalLink size={14} /> Tarayıcıda Aç
                        </a>
                      </div>
                    </div>
                  ) : (
                    // Görsel Görüntüleyici
                    <img 
                      src={selectedMedia.url} 
                      alt="Dekont" 
                      className="w-full h-auto object-contain rounded-2xl border border-white/5 shadow-2xl max-h-[65vh]" 
                      onError={() => setMediaError('Görsel yüklenemedi')}
                    />
                  )}
                </div>
              )}
              
              {/* Footer */}
              <div className="mt-6 flex justify-center flex-shrink-0">
                 <button onClick={closeMedia} className="px-10 py-4 bg-zinc-900 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-all hover:bg-zinc-800">
                   Pencereyi Kapat
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalQueue;
