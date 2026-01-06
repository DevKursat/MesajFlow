
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, CheckCheck, Loader2, MessageSquare, Bot, RefreshCcw, User, Smartphone, Activity, Zap, ZapOff, Bookmark, Sparkles, Star, Search, ChevronRight, Users, MessageCircle } from 'lucide-react';
import { fetchMessages, sendMessageToDb, subscribeToTable, fetchConnections, fetchAiSettings } from '../services/supabaseService';

// Hızlı Yanıt Şablonları - Restoran & E-ticaret
const QUICK_RESPONSES = [
  { id: 'welcome', label: 'Hoş Geldiniz', text: 'Merhaba! 👋 Size nasıl yardımcı olabilirim?', icon: <Sparkles size={14} /> },
  { id: 'menu', label: 'Menü/Ürünler', text: 'Güncel menümüzü/ürünlerimizi hemen iletiyorum! 📋', icon: <Zap size={14} /> },
  { id: 'hours', label: 'Çalışma Saatleri', text: 'Hafta içi 09:00-22:00, hafta sonu 10:00-23:00 saatleri arasında hizmetinizdeyiz.', icon: <Activity size={14} /> },
  { id: 'order', label: 'Sipariş Durumu', text: 'Siparişinizi kontrol ediyorum, lütfen bir dakika bekleyin...', icon: <RefreshCcw size={14} /> },
  { id: 'thanks', label: 'Teşekkürler', text: 'Bizi tercih ettiğiniz için teşekkür ederiz! Tekrar bekleriz 🙏', icon: <Star size={14} /> },
];

// İnsan benzeri yazım hataları
const humanizeText = (text: string): string => {
  let result = text;
  if (Math.random() > 0.6) result = result.charAt(0).toLowerCase() + result.slice(1);
  if (Math.random() > 0.5) result = result.replace(/[.!?]$/, '');
  if (Math.random() > 0.8) result = result.replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ş/g, 's');
  return result;
};

// Kişi tipi
interface Contact {
  phone: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isFromMe: boolean;
}

// Telefon numarasını temizle ve GÖRÜNTÜLE
const cleanPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return '';

  // @ sonrasını at
  let cleaned = phone.split('@')[0] || '';

  // : sonrasını at (device id)
  if (cleaned.includes(':')) cleaned = cleaned.split(':')[0];

  // Sadece rakamları al
  cleaned = cleaned.replace(/\D/g, '');

  // Minimum 7 hane
  if (cleaned.length < 7) return '';

  return cleaned;
};

// WhatsApp LID mi kontrol et (gerçek numara alınamayan kişiler)
const isWhatsAppLID = (phone: string | null | undefined): boolean => {
  if (!phone) return false;
  const cleaned = cleanPhoneNumber(phone);
  // LID: 15+ hane VE "1" ile başlıyor
  return cleaned.length >= 15 && cleaned.startsWith('1');
};

// Görüntülenecek numara/isim
const getDisplayName = (phone: string | null | undefined): string => {
  if (!phone) return 'Müşteri';
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return 'Müşteri';

  // WhatsApp LID ise "Müşteri" göster
  if (isWhatsAppLID(phone)) return 'Müşteri';

  return `+${cleaned}`;
};

const ChatSimulator: React.FC = () => {
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isHumanizing, setIsHumanizing] = useState(true);
  const [aiSettings, setAiSettings] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // İlk yükleme
  useEffect(() => {
    const init = async () => {
      const connData = await fetchConnections();
      setConnections(connData);
      if (connData.length > 0) setSelectedConn(connData[0].id);

      const settings = await fetchAiSettings();
      setAiSettings(settings);
      setIsHumanizing(settings?.human_simulation ?? true);

      setIsLoading(false);
    };
    init();
  }, []);

  // Mesajlardan kişi listesi çıkar - SADECE GELEN MESAJLARDAN (is_from_me = false)
  const getContactsFromMessages = (messages: any[]): Contact[] => {
    const contactMap = new Map<string, Contact>();

    messages.forEach(msg => {
      // Sadece GELEN mesajlardan kişi listesi oluştur (müşterinin gönderdiği)
      // Giden mesajlarda sender_phone kime gönderildiğini gösteriyor
      if (msg.is_from_me) return; // Giden mesajları atla

      let phone = cleanPhoneNumber(msg.sender_phone);
      // Geçersiz numaraları atla - cleanPhoneNumber zaten 10-15 hane kontrolü yapıyor
      if (!phone) return;

      const existing = contactMap.get(phone);
      const msgTime = new Date(msg.created_at);

      if (!existing || msgTime > existing.lastMessageTime) {
        contactMap.set(phone, {
          phone,
          lastMessage: msg.message_text || '[Medya]',
          lastMessageTime: msgTime,
          unreadCount: 0,
          isFromMe: false
        });
      }
    });

    // Son mesajı güncelle - giden mesajları da kontrol et
    messages.forEach(msg => {
      if (!msg.is_from_me) return;

      const phone = cleanPhoneNumber(msg.sender_phone);
      const existing = contactMap.get(phone);
      if (!existing) return;

      const msgTime = new Date(msg.created_at);
      if (msgTime > existing.lastMessageTime) {
        contactMap.set(phone, {
          ...existing,
          lastMessage: msg.message_text || '[Medya]',
          lastMessageTime: msgTime,
          isFromMe: true
        });
      }
    });

    return Array.from(contactMap.values())
      .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
  };

  // Bağlantı değiştiğinde mesajları yükle
  useEffect(() => {
    if (!selectedConn) return;

    fetchMessages(selectedConn).then(msgs => {
      setAllMessages(msgs);
      const contacts = getContactsFromMessages(msgs);
      if (contacts.length > 0) {
        setSelectedContact(contacts[0].phone);
      }
    });

    const sub = subscribeToTable('whatsapp_messages', (payload) => {
      if (payload.type === 'INSERT' && payload.new.connection_id === selectedConn) {
        setAllMessages(prev => [...prev, payload.new]);
      }
    });

    return () => { sub.unsubscribe(); };
  }, [selectedConn]);

  // Otomatik scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages, selectedContact]);

  // Kişi listesi (memoized)
  const contacts = useMemo(() => {
    const list = getContactsFromMessages(allMessages);
    if (searchTerm) {
      return list.filter(c => c.phone.includes(searchTerm));
    }
    return list;
  }, [allMessages, searchTerm]);

  // Seçili kişinin mesajları - temizlenmiş numara ile karşılaştır
  const filteredMessages = useMemo(() => {
    if (!selectedContact) return [];
    return allMessages.filter(msg => {
      const msgPhone = cleanPhoneNumber(msg.sender_phone);
      return msgPhone === selectedContact;
    }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [allMessages, selectedContact]);

  // Mesaj gönder - seçili numaraya WhatsApp'tan gönderilecek
  const handleManualSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !selectedConn || !selectedContact) return;

    let msgText = inputText;
    if (isHumanizing) {
      msgText = humanizeText(msgText);
    }

    const messageData = {
      connection_id: selectedConn,
      sender_phone: selectedContact, // Mesajın gideceği numara
      message_text: msgText,
      is_from_me: true,
      is_outgoing: true, // WhatsApp worker'a gönderilecek işaret
      target_phone: selectedContact, // Hedef numara - worker bu numaraya gönderecek
      created_at: new Date().toISOString()
    };

    setInputText('');

    // Optimistic update - mesajı hemen göster
    const tempMsg = {
      id: `temp_${Date.now()}`,
      ...messageData
    };
    setAllMessages(prev => [...prev, tempMsg]);

    await sendMessageToDb(messageData);
  };

  const useQuickResponse = (text: string) => {
    setInputText(text);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes}dk`;
    if (hours < 24) return `${hours}sa`;
    if (days < 7) return `${days}g`;
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
  };

  if (isLoading) return (
    <div className="h-full flex items-center justify-center text-zinc-500">
      <Loader2 className="animate-spin mr-2" /> Yükleniyor...
    </div>
  );

  if (connections.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-[#111113] border border-dashed border-white/5 rounded-[3rem]">
      <Smartphone size={64} className="text-zinc-800 mb-6" />
      <h3 className="text-xl font-black uppercase tracking-tight">Aktif Cihaz Yok</h3>
      <p className="text-zinc-500 text-sm mt-2 italic">Lütfen önce 'Bağlantılar' sekmesinden cihaz bağlayın.</p>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-[#111113] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
      {/* SOL PANEL - Kişi Listesi */}
      <div className="w-80 border-r border-white/5 flex flex-col bg-[#0a0a0b]">
        {/* Header */}
        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-emerald-500" />
              <span className="font-black text-sm uppercase tracking-tight">Sohbetler</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-emerald-500 animate-pulse" />
              <span className="text-[9px] text-zinc-500 font-bold uppercase">{contacts.length} Kişi</span>
            </div>
          </div>

          {/* Cihaz Seçimi */}
          <select
            value={selectedConn || ''}
            onChange={(e) => {
              setSelectedConn(e.target.value);
              setSelectedContact(null);
            }}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold outline-none text-emerald-500 focus:border-emerald-500 mb-3"
          >
            {connections.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.phone_number || 'Numarasız'})</option>
            ))}
          </select>

          {/* Arama */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Numara ara..."
              className="w-full bg-zinc-900/50 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-emerald-500/30"
            />
          </div>
        </div>

        {/* Kişi Listesi */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {contacts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 p-6">
              <MessageCircle size={32} strokeWidth={1} className="mb-3 opacity-30" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-center">Henüz mesaj yok</p>
            </div>
          ) : (
            contacts.map((contact) => (
              <div
                key={contact.phone}
                onClick={() => setSelectedContact(contact.phone)}
                className={`p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/[0.02] ${selectedContact === contact.phone ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : ''
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${selectedContact === contact.phone
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : 'bg-zinc-800 text-zinc-500'
                    }`}>
                    <User size={18} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-zinc-200 truncate">
                        {getDisplayName(contact.phone)}
                      </span>
                      <span className="text-[9px] text-zinc-600 flex-shrink-0 ml-2">
                        {formatTime(contact.lastMessageTime)}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${contact.isFromMe ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {contact.isFromMe && <span className="text-emerald-500 mr-1">✓</span>}
                      {contact.lastMessage.substring(0, 35)}
                      {contact.lastMessage.length > 35 && '...'}
                    </p>
                  </div>

                  <ChevronRight size={14} className={`flex-shrink-0 mt-3 ${selectedContact === contact.phone ? 'text-emerald-500' : 'text-zinc-700'
                    }`} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SAĞ PANEL - Sohbet */}
      <div className="flex-1 flex flex-col">
        {/* Sohbet Header */}
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          {selectedContact ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <User size={18} />
                </div>
                <div>
                  <p className="font-bold text-sm">{getDisplayName(selectedContact)}</p>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-zinc-500 uppercase">Aktif Sohbet</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsHumanizing(!isHumanizing)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isHumanizing
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-zinc-800 text-zinc-500 border-white/5'
                  }`}
              >
                {isHumanizing ? <Zap size={14} /> : <ZapOff size={14} />}
                İnsan: {isHumanizing ? 'ON' : 'OFF'}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-zinc-600">
              <MessageSquare size={18} />
              <span className="text-xs font-bold uppercase">Bir sohbet seçin</span>
            </div>
          )}
        </div>

        {/* Mesaj Alanı */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-emerald-500/[0.01] to-transparent">
          {!selectedContact ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4">
              <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center">
                <MessageSquare size={40} strokeWidth={1} className="opacity-30" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em]">Sol panelden bir sohbet seçin</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 opacity-40">
              <MessageSquare size={48} strokeWidth={1} />
              <p className="text-xs font-bold uppercase tracking-[0.2em]">Mesaj bekleniyor...</p>
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.is_from_me ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`max-w-[70%] flex items-end gap-2 ${msg.is_from_me ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border ${msg.is_from_me ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-zinc-800 border-white/5'
                    }`}>
                    {msg.is_from_me ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className={`rounded-2xl p-3 shadow-lg ${msg.is_from_me ? 'bg-zinc-900 border border-emerald-500/20 text-zinc-200' : 'bg-emerald-500 text-black font-medium'
                    }`}>
                    {msg.is_media ? (
                      <div className="space-y-2">
                        <img src={msg.media_url} alt="Media" className="max-w-xs rounded-lg border border-white/10" />
                        <p className={`text-[9px] font-bold ${msg.is_from_me ? 'text-zinc-500' : 'text-emerald-900'} uppercase`}>[Medya]</p>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message_text}</p>
                    )}
                    <div className={`text-[8px] mt-1.5 opacity-50 flex items-center gap-1 ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.is_from_me && <CheckCheck size={10} className="text-emerald-500" />}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Alanı */}
        {selectedContact && (
          <div className="p-4 bg-white/[0.01] border-t border-white/5 space-y-3">
            {/* Hızlı Yanıtlar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
              <div className="flex-shrink-0 flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest border-r border-white/5 pr-3 mr-1">
                <Bookmark size={12} className="text-emerald-500" /> Kısayol:
              </div>
              {QUICK_RESPONSES.map(qr => (
                <button
                  key={qr.id}
                  onClick={() => useQuickResponse(qr.text)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-white/5 rounded-lg text-[9px] font-bold text-zinc-400 hover:text-emerald-500 hover:border-emerald-500/30 transition-all"
                >
                  {qr.icon}
                  {qr.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleManualSend} className="flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-2xl p-2 pl-4">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`+${selectedContact} numarasına yanıt yaz...`}
                className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-200 py-2"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-3 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 font-black text-xs"
              >
                <Send size={16} />
              </button>
            </form>
            <p className="text-[8px] text-zinc-600 text-center uppercase font-black tracking-widest opacity-50">
              Manuel yanıt gönderildiğinde AI bu kişi için devreden çıkar
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSimulator;
