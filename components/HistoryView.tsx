
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Filter, Download, ChevronLeft, ChevronRight, FileText, RefreshCw, X, ExternalLink, AlertTriangle, Eye } from 'lucide-react';
import { Transaction } from '../types';
import { fetchTransactions, subscribeToTable } from '../services/supabaseService';

// Media tipi belirleme
const getMediaType = (url: string): 'image' | 'pdf' | 'unknown' => {
  if (!url) return 'unknown';
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.pdf') || lowerUrl.includes('application/pdf')) return 'pdf';
  if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)/)) return 'image';
  return 'image';
};

interface SelectedMedia {
  url: string;
  type: 'image' | 'pdf' | 'unknown';
  transaction?: Transaction;
}

const HistoryView: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchTransactions();
    setTransactions(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    // Fix: replaced missing subscribeToTransactions with generic subscribeToTable
    const subscription = subscribeToTable('transactions', (payload) => {
      if (payload.type === 'INSERT') {
        setTransactions(prev => [payload.new as Transaction, ...prev]);
      } else if (payload.type === 'UPDATE') {
        setTransactions(prev => prev.map(t => t.id === payload.new.id ? payload.new as Transaction : t));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Media görüntüleme fonksiyonları
  const openMedia = useCallback((url: string | undefined, transaction?: Transaction) => {
    if (!url) {
      setMediaError('Dekont URL\'si bulunamadı');
      return;
    }
    setMediaError(null);
    const mediaType = getMediaType(url);
    setSelectedMedia({ url, type: mediaType, transaction });
  }, []);

  const closeMedia = useCallback(() => {
    setSelectedMedia(null);
    setMediaError(null);
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => 
      t.sender_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.customer_phone?.includes(searchTerm) ||
      t.amount.toString().includes(searchTerm)
    );
  }, [transactions, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold">İşlem Geçmişi</h1>
          <p className="text-zinc-500 text-sm">Tüm kayıtlar canlı olarak senkronize edilmektedir.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadData} className="p-2 bg-zinc-900 border border-white/5 rounded-xl text-zinc-400 hover:text-white">
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/5 rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all">
            <Download size={16} /> Excel İndir
          </button>
        </div>
      </div>

      <div className="flex gap-4 items-center bg-[#111113] border border-white/5 p-4 rounded-2xl">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            type="text" 
            placeholder="İsim, telefon veya miktar ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>
        <button className="px-4 py-2.5 bg-zinc-900 border border-white/5 rounded-xl text-xs font-bold flex items-center gap-2">
          <Filter size={16} /> Filtrele
        </button>
      </div>

      <div className="bg-[#111113] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-zinc-500 font-bold border-b border-white/5">
              <th className="px-6 py-4">İşlem ID</th>
              <th className="px-6 py-4">Müşteri / Banka</th>
              <th className="px-6 py-4">Miktar</th>
              <th className="px-6 py-4">Durum</th>
              <th className="px-6 py-4">Tarih</th>
              <th className="px-6 py-4 text-right">Detay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center text-zinc-600 italic">Kayıt bulunamadı</td>
              </tr>
            ) : (
              filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4 text-xs font-mono text-zinc-500">#{t.id.slice(0, 8)}</td>
                  <td className="px-6 py-4">
                     <div className="flex flex-col">
                       <span className="text-sm font-medium">{t.sender_name || 'Anonim'}</span>
                       <span className="text-[10px] text-zinc-600">{t.customer_phone} • {t.bank_name || 'Banka Bilgisi Yok'}</span>
                     </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-zinc-200">₺{t.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${
                      t.status === 'CREDITED' ? 'bg-emerald-500/10 text-emerald-500' : 
                      t.status === 'APPROVED' ? 'bg-blue-500/10 text-blue-500' : 
                      t.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {t.status}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-500">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => openMedia(t.receipt_url, t)}
                      disabled={!t.receipt_url}
                      className={`p-2 hover:bg-zinc-800 rounded-lg transition-all ${t.receipt_url ? 'text-zinc-600 group-hover:text-emerald-500 cursor-pointer' : 'text-zinc-800 cursor-not-allowed'}`}
                      title={t.receipt_url ? 'Dekontu Görüntüle' : 'Dekont Yok'}
                    >
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="px-6 py-4 bg-white/5 border-t border-white/5 flex items-center justify-between">
          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Toplam Kayıt: {filteredTransactions.length}</p>
          <div className="flex gap-2">
            <button className="p-2 bg-zinc-900 border border-white/5 rounded-lg text-zinc-600">
              <ChevronLeft size={16} />
            </button>
            <button className="p-2 bg-zinc-900 border border-white/5 rounded-lg text-zinc-600">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
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
                  <a 
                    href={selectedMedia.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 bg-white/5 hover:bg-blue-500/10 hover:text-blue-500 rounded-2xl transition-all text-zinc-500"
                    title="Yeni sekmede aç"
                  >
                    <ExternalLink size={18} />
                  </a>
                  <a 
                    href={selectedMedia.url} 
                    download 
                    className="p-3 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-500 rounded-2xl transition-all text-zinc-500"
                    title="İndir"
                  >
                    <Download size={18} />
                  </a>
                  <button onClick={closeMedia} className="p-3 bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-all text-zinc-500 group">
                    <X size={20} className="group-hover:rotate-90 transition-transform" />
                  </button>
                </div>
              </div>
              
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
              {!mediaError && (
                <div className="flex-1 overflow-auto min-h-[300px] max-h-[70vh]">
                  {selectedMedia.type === 'pdf' ? (
                    <div className="w-full h-full min-h-[500px] flex flex-col">
                      <iframe
                        src={`${selectedMedia.url}#toolbar=1&navpanes=0`}
                        className="w-full flex-1 min-h-[500px] rounded-2xl border border-white/5"
                        title="PDF Dekont"
                        onError={() => setMediaError('PDF yüklenemedi')}
                      />
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

export default HistoryView;
