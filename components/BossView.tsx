import React, { useState, useEffect } from 'react';
import {
    Plus, Trash2, UtensilsCrossed, Store, Building2, Lock, RefreshCw,
    CheckCircle, XCircle, Shield, Users, MessageCircle, Send
} from 'lucide-react';
import { AiSettings, BusinessType } from '../types';
import { fetchAllBusinesses, registerBusiness, deleteBusiness } from '../services/supabaseService';

interface BossViewProps {
    showToast: (message: string, type: 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO') => void;
}

const BossView: React.FC<BossViewProps> = ({ showToast }) => {
    const [businesses, setBusinesses] = useState<AiSettings[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [newName, setNewName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newType, setNewType] = useState<BusinessType>('RESTAURANT');
    const [useWhatsapp, setUseWhatsapp] = useState(true);
    const [useTelegram, setUseTelegram] = useState(false);

    const loadBusinesses = async () => {
        setIsLoading(true);
        const data = await fetchAllBusinesses();
        setBusinesses(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadBusinesses();
    }, []);

    const handleAddBusiness = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || !newPassword.trim()) {
            showToast('İşletme adı ve şifre zorunlu!', 'WARN');
            return;
        }
        if (newPassword.length < 4) {
            showToast('Şifre en az 4 karakter olmalı!', 'WARN');
            return;
        }
        if (!useWhatsapp && !useTelegram) {
            showToast('En az bir platform seçmelisiniz!', 'WARN');
            return;
        }

        setIsSubmitting(true);
        try {
            await registerBusiness(newName.trim(), newPassword, newType, useWhatsapp, useTelegram);
            showToast(`${newName} başarıyla eklendi!`, 'SUCCESS');
            setNewName('');
            setNewPassword('');
            setNewType('RESTAURANT');
            setUseWhatsapp(true);
            setUseTelegram(false);
            setShowAddForm(false);
            loadBusinesses();
        } catch (err: any) {
            if (err.code === '23505') {
                showToast('Bu işletme adı zaten kullanılıyor!', 'ERROR');
            } else {
                showToast('İşletme eklenemedi.', 'ERROR');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (business: AiSettings) => {
        if (!confirm(`"${business.business_name}" işletmesini silmek istediğinize emin misiniz?`)) return;

        try {
            await deleteBusiness(business.id);
            showToast(`${business.business_name} silindi.`, 'SUCCESS');
            loadBusinesses();
        } catch {
            showToast('Silme başarısız.', 'ERROR');
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl flex items-center justify-center">
                        <Shield size={28} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Boss Panel</h2>
                        <p className="text-zinc-500 text-sm">İşletme Yönetimi</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-500 text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:brightness-110 transition-all"
                >
                    <Plus size={18} /> Yeni İşletme
                </button>
            </div>

            {/* Add Form */}
            {showAddForm && (
                <div className="bg-[#0c0c0d] border border-white/10 rounded-3xl p-8 animate-in slide-in-from-top duration-300">
                    <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2">
                        <Building2 size={20} className="text-purple-500" /> Yeni İşletme Ekle
                    </h3>
                    <form onSubmit={handleAddBusiness} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* İşletme Adı */}
                            <div className="relative">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                                <input
                                    type="text"
                                    placeholder="İşletme Adı"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full bg-zinc-900/50 border border-white/5 rounded-xl py-4 pl-12 pr-4 text-white outline-none focus:border-purple-500/50 transition-all"
                                />
                            </div>
                            {/* Şifre */}
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                                <input
                                    type="text"
                                    placeholder="Şifre"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-zinc-900/50 border border-white/5 rounded-xl py-4 pl-12 pr-4 text-white outline-none focus:border-purple-500/50 transition-all font-mono"
                                />
                            </div>
                        </div>

                        {/* İşletme Tipi */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setNewType('RESTAURANT')}
                                className={`p-4 rounded-xl border transition-all flex items-center justify-center gap-3 ${newType === 'RESTAURANT' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:text-white'}`}
                            >
                                <UtensilsCrossed size={20} />
                                <span className="font-bold text-sm">Restoran</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setNewType('ECOMMERCE')}
                                className={`p-4 rounded-xl border transition-all flex items-center justify-center gap-3 ${newType === 'ECOMMERCE' ? 'bg-blue-500/10 border-blue-500/50 text-blue-500' : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:text-white'}`}
                            >
                                <Store size={20} />
                                <span className="font-bold text-sm">E-Ticaret</span>
                            </button>
                        </div>

                        {/* Platform Seçimi - WhatsApp & Telegram */}
                        <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-4">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Platform Seçimi</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setUseWhatsapp(!useWhatsapp)}
                                    className={`p-4 rounded-xl border transition-all flex items-center justify-center gap-3 ${useWhatsapp ? 'bg-green-500/10 border-green-500/50 text-green-500' : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:text-white'}`}
                                >
                                    <MessageCircle size={20} />
                                    <span className="font-bold text-sm">WhatsApp</span>
                                    {useWhatsapp && <CheckCircle size={16} className="ml-auto" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUseTelegram(!useTelegram)}
                                    className={`p-4 rounded-xl border transition-all flex items-center justify-center gap-3 ${useTelegram ? 'bg-sky-500/10 border-sky-500/50 text-sky-500' : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:text-white'}`}
                                >
                                    <Send size={20} />
                                    <span className="font-bold text-sm">Telegram</span>
                                    {useTelegram && <CheckCircle size={16} className="ml-auto" />}
                                </button>
                            </div>
                            {!useWhatsapp && !useTelegram && (
                                <p className="text-orange-400 text-xs mt-2 text-center">⚠️ En az bir platform seçmelisiniz</p>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-purple-500 text-black py-4 rounded-xl font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                {isSubmitting ? 'EKLENİYOR...' : 'EKLE'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                className="px-6 py-4 bg-zinc-800 text-zinc-400 rounded-xl font-black uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                            >
                                <XCircle size={18} /> İptal
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Users size={16} className="text-purple-500" />
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Toplam</p>
                    </div>
                    <p className="text-3xl font-black text-white">{businesses.length}</p>
                </div>
                <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <UtensilsCrossed size={16} className="text-emerald-500" />
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Restoran</p>
                    </div>
                    <p className="text-3xl font-black text-emerald-500">{businesses.filter(b => b.business_type === 'RESTAURANT').length}</p>
                </div>
                <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Store size={16} className="text-blue-500" />
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">E-Ticaret</p>
                    </div>
                    <p className="text-3xl font-black text-blue-500">{businesses.filter(b => b.business_type === 'ECOMMERCE').length}</p>
                </div>
            </div>

            {/* Business List */}
            <div className="bg-[#0c0c0d] border border-white/5 rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h3 className="font-black uppercase tracking-tight text-sm">Kayıtlı İşletmeler</h3>
                    <button onClick={loadBusinesses} className="text-zinc-500 hover:text-white transition-colors">
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-zinc-600">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                        <p>Yükleniyor...</p>
                    </div>
                ) : businesses.length === 0 ? (
                    <div className="p-12 text-center text-zinc-600">
                        <Building2 size={48} className="mx-auto mb-4 opacity-30" />
                        <p>Henüz işletme yok</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {businesses.map((business) => (
                            <div key={business.id} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${business.business_type === 'RESTAURANT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                        {business.business_type === 'RESTAURANT' ? <UtensilsCrossed size={22} /> : <Store size={22} />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">{business.business_name}</p>
                                        <p className="text-xs text-zinc-500">{business.business_type === 'RESTAURANT' ? 'Restoran' : 'E-Ticaret'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Şifre</p>
                                        <p className="font-mono text-sm text-zinc-400">{business.system_password}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(business)}
                                        className="p-3 bg-rose-500/10 text-rose-500/60 rounded-xl hover:bg-rose-500/20 hover:text-rose-500 transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BossView;
