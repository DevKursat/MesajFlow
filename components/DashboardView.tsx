
import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Users, Clock, Bot, Loader2, RefreshCcw, ArrowUpRight, Activity, Terminal, Wifi, MessageSquare, ShoppingBag, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchTransactions, subscribeToTable, fetchConnections } from '../services/supabaseService';
import { Transaction, WhatsAppConnection } from '../types';

const StatCard = ({ title, value, change, icon, color, active = false }: any) => (
  <div className={`relative overflow-hidden bg-[#0c0c0d] border ${active ? 'border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.05)]' : 'border-white/5'} rounded-[2rem] p-8 flex flex-col gap-5 group transition-all duration-500`}>
    <div className="flex justify-between items-start">
      <div className={`p-4 rounded-2xl ${color} bg-opacity-10 group-hover:rotate-6 transition-transform`}>
        {React.cloneElement(icon, { className: color.replace('bg-', 'text-'), size: 24 })}
      </div>
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter bg-white/5 ${change.includes('+') || change === 'AKTİF' || change === 'İYİ' ? 'text-emerald-400' : 'text-zinc-500'}`}>
        <ArrowUpRight size={10} /> {change}
      </div>
    </div>
    <div>
      <p className="text-zinc-600 text-[10px] uppercase font-black tracking-[0.2em]">{title}</p>
      <h3 className="text-4xl font-black mt-2 tracking-tighter text-zinc-100">{value}</h3>
    </div>
    <div className="absolute -bottom-2 -right-2 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
      {React.cloneElement(icon, { size: 100 })}
    </div>
  </div>
);

const DashboardView: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const loadData = async () => {
    try {
      const [txData, connData] = await Promise.all([fetchTransactions(), fetchConnections()]);
      setTransactions(txData);
      setConnections(connData);
      addLog("Veriler senkronize edildi.");
    } catch (err) {
      addLog("HATA: Veri çekilemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setTimeout(() => setChartReady(true), 500);

    const txSub = subscribeToTable('transactions', (payload) => {
      if (payload.type === 'INSERT') {
        setTransactions(prev => [payload.new as Transaction, ...prev]);
        addLog(`YENİ MESAJ: ${payload.new.sender_name}`);
      }
    });

    const connSub = subscribeToTable('whatsapp_connections', (payload) => {
      loadData();
    });

    return () => {
      txSub.unsubscribe();
      connSub.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayTxs = transactions.filter(t => t.created_at?.startsWith(today));
    const totalMessages = todayTxs.length;
    const answered = todayTxs.filter(t => t.status === 'CREDITED');
    const responseRate = todayTxs.length > 0
      ? ((answered.length / todayTxs.length) * 100).toFixed(0)
      : "100";

    return {
      messages: totalMessages,
      pending: transactions.filter(t => t.status === 'PENDING').length,
      online: connections.filter(c => c.status === 'CONNECTED').length,
      responseRate
    };
  }, [transactions, connections]);

  const chartData = useMemo(() => {
    const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
    return hours.map((h) => {
      const targetHour = parseInt(h.split(':')[0]);
      const hourlyCount = transactions
        .filter(t => {
          const tDate = new Date(t.created_at);
          return tDate.getHours() <= targetHour;
        }).length;
      return { name: h, mesaj: hourlyCount };
    });
  }, [transactions]);

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-500 gap-6">
      <Loader2 size={60} className="animate-spin text-emerald-500 opacity-20" />
      <p className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Aura Yükleniyor...</p>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard title="BUGÜNKÜ MESAJLAR" value={stats.messages} change="AKTİF" icon={<MessageSquare />} color="bg-emerald-500" active={true} />
        <StatCard title="BAĞLI KANALLAR" value={`${stats.online}/5`} change="CANLI" icon={<Wifi />} color="bg-blue-500" />
        <StatCard title="BEKLEYEN YANIT" value={stats.pending} change={stats.pending > 0 ? "DİKKAT" : "TEMİZ"} icon={<Clock />} color="bg-amber-500" />
        <StatCard title="YANIT ORANI" value={`%${stats.responseRate}`} change="İYİ" icon={<Bot />} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="bg-[#0c0c0d] border border-white/5 rounded-[2.5rem] p-10 shadow-2xl relative min-h-[480px]">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-xl font-black tracking-tighter uppercase flex items-center gap-3">Mesaj Trafiği <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-black">BUGÜN</span></h3>
              <button onClick={loadData} className="p-3 bg-white/5 border border-white/5 rounded-2xl text-zinc-500 hover:text-emerald-500 transition-all"><RefreshCcw size={20} /></button>
            </div>
            <div className="h-[320px]">
              {chartReady && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorMesaj" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
                    <XAxis dataKey="name" stroke="#27272a" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#27272a" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0c0c0d', border: '1px solid #ffffff10', borderRadius: '16px' }} />
                    <Area type="monotone" dataKey="mesaj" stroke="#10b981" strokeWidth={3} fill="url(#colorMesaj)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-[#0c0c0d] border border-white/5 rounded-[2.5rem] p-8">
            <div className="flex items-center gap-3 mb-6">
              <Terminal size={18} className="text-emerald-500" />
              <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Anlık Aktivite</h4>
            </div>
            <div className="h-40 overflow-y-auto font-mono text-[9px] space-y-1 bg-black/40 rounded-2xl p-6 border border-white/5 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-zinc-700 italic">Henüz aktivite yok...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-2 text-emerald-500/60"><span className="text-zinc-700">[{i}]</span> {log}</div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-[#0c0c0d] border border-white/5 rounded-[2.5rem] p-8 flex flex-col h-full shadow-2xl">
            <h3 className="text-lg font-black tracking-tighter flex items-center gap-3 mb-8 uppercase text-zinc-200">
              <Wifi size={20} className="text-blue-500" /> Bağlı Kanallar
            </h3>
            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar">
              {connections.length === 0 ? (
                <div className="text-center text-zinc-600 py-8">
                  <Wifi size={32} className="mx-auto opacity-20 mb-3" />
                  <p className="text-xs font-bold">Henüz bağlı kanal yok</p>
                  <p className="text-[10px] text-zinc-700 mt-1">Bağlantılar menüsünden ekleyin</p>
                </div>
              ) : (
                connections.map(conn => (
                  <div key={conn.id} className="p-5 bg-white/[0.02] border border-white/5 rounded-3xl flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${conn.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-900 text-zinc-700'}`}>
                        <Wifi size={18} className={conn.status === 'CONNECTED' ? 'animate-pulse' : ''} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-zinc-200">{conn.name}</p>
                        <p className="text-[9px] font-bold text-zinc-600 uppercase">{conn.representative_name || 'AI Asistan'}</p>
                      </div>
                    </div>
                    <div className={`text-[9px] font-black px-2 py-1 rounded-lg ${conn.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {conn.status === 'CONNECTED' ? 'AKTİF' : 'KAPALI'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
