
import React, { useState, useEffect } from 'react';
import { Save, Lock, Bot, Terminal, Cpu, MessageSquare, AlertTriangle, RefreshCw } from 'lucide-react';
import { AiSettings, AiTone } from '../types';
import { fetchAiSettings, updateAiSettings } from '../services/supabaseService';

const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [newPass, setNewPass] = useState('');

  useEffect(() => {
    fetchAiSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const update = { ...settings };
    if (newPass) update.system_password = newPass;
    await updateAiSettings(update);
    setNewPass('');
    setSaving(false);
  };

  if (!settings) return null;

  return (
    <div className="max-w-5xl space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Bot <span className="text-emerald-500">Ayarları</span></h1>
          <p className="text-zinc-500 text-sm mt-1">AI asistanın davranışlarını ve yanıtlarını özelleştirin.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-emerald-500 text-black px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-400 shadow-xl shadow-emerald-500/20 flex items-center gap-2">
          {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />} DEĞİŞİKLİKLERİ YAYINLA
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-[#111113] border border-white/5 rounded-[2.5rem] p-10 space-y-8">
            <div className="flex items-center gap-4 border-b border-white/5 pb-6">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl"><Terminal size={24} /></div>
              <h2 className="text-xl font-black uppercase tracking-tight">AI Sistem Komutu (Prompt)</h2>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Botun kişiliği ve kurallarını belirleyin:</p>
              <textarea
                value={settings.ai_instruction}
                onChange={e => setSettings({ ...settings, ai_instruction: e.target.value })}
                className="w-full h-64 bg-black/40 border border-white/10 rounded-3xl p-6 text-zinc-300 font-mono text-sm outline-none focus:border-emerald-500/50 transition-all custom-scrollbar leading-relaxed"
              />
              <div className="flex items-center gap-2 text-amber-500/60 text-[9px] font-bold uppercase italic">
                <AlertTriangle size={12} /> Not: Bot müşterilerinize yapay zeka olduğunu belirtmez.
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-8">
            <section className="bg-[#111113] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
              <div className="flex items-center gap-3">
                <Bot size={20} className="text-emerald-500" />
                <h3 className="font-black uppercase tracking-tight text-sm">Üslup Havuzu</h3>
              </div>
              <div className="space-y-3">
                {(['SAMIMI', 'PRO', 'AGRESIF', 'KURUMSAL'] as AiTone[]).map(tone => {
                  const toneConfig: Record<AiTone, { label: string; desc: string; color: string }> = {
                    'SAMIMI': { label: 'SAMİMİ', desc: 'Hocam, Kral, Dostum', color: 'emerald' },
                    'PRO': { label: 'PROFESYONEL', desc: 'Net ve Kısa', color: 'blue' },
                    'AGRESIF': { label: 'AGRESİF', desc: 'Satışçı, İkna Edici', color: 'orange' },
                    'KURUMSAL': { label: 'KURUMSAL', desc: 'Efendim, Sayın Müşterimiz', color: 'purple' }
                  };
                  const config = toneConfig[tone];
                  const isSelected = settings.tone === tone;
                  return (
                    <button
                      key={tone}
                      onClick={() => setSettings({ ...settings, tone })}
                      className={`w-full py-5 px-6 rounded-2xl font-black tracking-wider border-2 transition-all duration-300 ${isSelected
                          ? `bg-${config.color}-500 text-black border-${config.color}-500 shadow-lg shadow-${config.color}-500/30`
                          : 'bg-black/30 border-white/10 text-zinc-400 hover:border-white/30 hover:text-zinc-200'
                        }`}
                      style={isSelected ? {
                        backgroundColor: config.color === 'emerald' ? '#10b981' :
                          config.color === 'blue' ? '#3b82f6' :
                            config.color === 'orange' ? '#f97316' : '#a855f7',
                        borderColor: config.color === 'emerald' ? '#10b981' :
                          config.color === 'blue' ? '#3b82f6' :
                            config.color === 'orange' ? '#f97316' : '#a855f7'
                      } : {}}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs">{config.label}</span>
                        <span className={`text-[9px] font-medium ${isSelected ? 'text-black/70' : 'text-zinc-600'}`}>
                          {config.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="bg-[#111113] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
              <div className="flex items-center gap-3">
                <Cpu size={20} className="text-blue-500" />
                <h3 className="font-black uppercase tracking-tight text-sm">İşlem Gecikmesi</h3>
              </div>
              <div className="space-y-6">
                <p className="text-center text-4xl font-black font-mono text-white">{settings.delay_seconds}<span className="text-xs text-zinc-600">sn</span></p>
                <input
                  type="range" min="0" max="15" step="1"
                  value={settings.delay_seconds}
                  onChange={e => setSettings({ ...settings, delay_seconds: parseInt(e.target.value) })}
                  className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <p className="text-[9px] text-zinc-600 text-center font-bold uppercase">"Yazıyor..." süresini belirler.</p>
              </div>
            </section>
          </div>
        </div>

        <div className="space-y-8">
          <section className="bg-[#111113] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
            <div className="flex items-center gap-3">
              <Lock size={20} className="text-rose-500" />
              <h3 className="font-black uppercase tracking-tight text-sm">Güvenlik Anahtarı</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-600 uppercase">Yeni Şifre Belirle</label>
                <input
                  type="text"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="Şifreyi değiştir..."
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-6 text-sm outline-none focus:border-rose-500/50 font-mono text-white"
                />
              </div>
            </div>
          </section>

          <section className="bg-emerald-500/5 border border-emerald-500/10 rounded-[2.5rem] p-8 space-y-4">
            <div className="flex items-center gap-3">
              <MessageSquare size={20} className="text-emerald-500" />
              <h3 className="font-black uppercase tracking-tight text-sm text-emerald-500">Human Simulation</h3>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Yazım hataları & doğal duraksamalar</span>
              <input
                type="checkbox"
                checked={settings.human_simulation}
                onChange={e => setSettings({ ...settings, human_simulation: e.target.checked })}
                className="w-6 h-6 accent-emerald-500"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
