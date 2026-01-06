import React, { useState, useEffect } from 'react';
import {
    Users, Phone, Mail, MapPin, Plus, Edit2, Trash2, RefreshCw,
    Search, DollarSign, ShoppingBag, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { Customer } from '../types';
import { supabase } from '../services/supabaseService';

interface CustomersViewProps {
    businessId: string;
    showToast: (message: string, type: 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO') => void;
}

const CustomersView: React.FC<CustomersViewProps> = ({ businessId, showToast }) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

    // Form state
    const [form, setForm] = useState({ phone: '', name: '', email: '', address: '', note: '' });

    const loadCustomers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('business_id', businessId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setCustomers((data || []) as Customer[]);
        } catch {
            showToast('Müşteriler yüklenemedi', 'ERROR');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadCustomers(); }, [businessId]);

    const addCustomer = async () => {
        if (!form.phone.trim()) {
            showToast('Telefon numarası zorunlu', 'WARN');
            return;
        }
        try {
            const { error } = await supabase.from('customers').insert({
                business_id: businessId,
                phone: form.phone.trim(),
                name: form.name.trim() || null,
                email: form.email.trim() || null,
                address: form.address.trim() || null,
                note: form.note.trim() || null
            });
            if (error) {
                if (error.code === '23505') {
                    showToast('Bu telefon numarası zaten kayıtlı', 'WARN');
                    return;
                }
                throw error;
            }
            showToast('Müşteri eklendi', 'SUCCESS');
            setForm({ phone: '', name: '', email: '', address: '', note: '' });
            setShowAddForm(false);
            loadCustomers();
        } catch {
            showToast('Müşteri eklenemedi', 'ERROR');
        }
    };

    const updateCustomer = async () => {
        if (!editingCustomer) return;
        try {
            const { error } = await supabase.from('customers').update({
                phone: form.phone.trim(),
                name: form.name.trim() || null,
                email: form.email.trim() || null,
                address: form.address.trim() || null,
                note: form.note.trim() || null
            }).eq('id', editingCustomer.id);
            if (error) throw error;
            showToast('Müşteri güncellendi', 'SUCCESS');
            setEditingCustomer(null);
            setForm({ phone: '', name: '', email: '', address: '', note: '' });
            loadCustomers();
        } catch {
            showToast('Güncellenemedi', 'ERROR');
        }
    };

    const deleteCustomer = async (id: string) => {
        if (!confirm('Bu müşteriyi silmek istediğinize emin misiniz?')) return;
        try {
            await supabase.from('customers').delete().eq('id', id);
            showToast('Silindi', 'SUCCESS');
            loadCustomers();
        } catch {
            showToast('Silinemedi', 'ERROR');
        }
    };

    const filteredCustomers = customers.filter(c =>
        !searchQuery ||
        c.phone.includes(searchQuery) ||
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalSpent = customers.reduce((sum, c) => sum + c.total_spent, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-violet-500/10 rounded-2xl flex items-center justify-center">
                        <Users size={28} className="text-violet-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Müşteriler</h2>
                        <p className="text-zinc-500 text-sm">{customers.length} müşteri • ₺{totalSpent.toFixed(0)} toplam</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setShowAddForm(true); setEditingCustomer(null); setForm({ phone: '', name: '', email: '', address: '', note: '' }); }}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-black font-bold text-xs rounded-xl"
                    >
                        <Plus size={16} /> Yeni Müşteri
                    </button>
                    <button onClick={loadCustomers} className="p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700">
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input
                    type="text"
                    placeholder="Ad, telefon veya e-posta ile ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-violet-500/50"
                />
            </div>

            {/* Add/Edit Form */}
            {(showAddForm || editingCustomer) && (
                <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold">{editingCustomer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}</h3>
                        <button onClick={() => { setShowAddForm(false); setEditingCustomer(null); }} className="text-zinc-500 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                            <input
                                type="tel"
                                placeholder="Telefon *"
                                value={form.phone}
                                onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 pl-10 outline-none focus:border-violet-500/50"
                            />
                        </div>
                        <input
                            type="text"
                            placeholder="Ad Soyad"
                            value={form.name}
                            onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                            className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 outline-none focus:border-violet-500/50"
                        />
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                            <input
                                type="email"
                                placeholder="E-posta"
                                value={form.email}
                                onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 pl-10 outline-none focus:border-violet-500/50"
                            />
                        </div>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                            <input
                                type="text"
                                placeholder="Adres"
                                value={form.address}
                                onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
                                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 pl-10 outline-none focus:border-violet-500/50"
                            />
                        </div>
                    </div>
                    <input
                        type="text"
                        placeholder="Not (opsiyonel)"
                        value={form.note}
                        onChange={(e) => setForm(p => ({ ...p, note: e.target.value }))}
                        className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 outline-none focus:border-violet-500/50"
                    />
                    <button
                        onClick={editingCustomer ? updateCustomer : addCustomer}
                        className="w-full py-3 bg-violet-500 text-black font-bold rounded-xl"
                    >
                        {editingCustomer ? 'Güncelle' : 'Ekle'}
                    </button>
                </div>
            )}

            {/* Customers List */}
            {isLoading ? (
                <div className="text-center py-12 text-zinc-600">
                    <RefreshCw size={32} className="animate-spin mx-auto mb-2" />
                    <p>Yükleniyor...</p>
                </div>
            ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-zinc-600">
                    <Users size={48} className="mx-auto mb-4 opacity-30" />
                    <p>Müşteri bulunamadı</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredCustomers.map(customer => {
                        const isExpanded = expandedCustomer === customer.id;

                        return (
                            <div key={customer.id} className="bg-[#0c0c0d] border border-white/5 rounded-xl overflow-hidden">
                                <div
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                                    onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center text-violet-500 font-bold">
                                            {customer.name ? customer.name[0].toUpperCase() : '?'}
                                        </div>
                                        <div>
                                            <p className="font-bold">{customer.name || customer.phone}</p>
                                            <p className="text-xs text-zinc-500 flex items-center gap-2">
                                                <Phone size={12} />{customer.phone}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-emerald-500">₺{customer.total_spent.toFixed(0)}</p>
                                            <p className="text-[10px] text-zinc-600">{customer.total_orders} sipariş</p>
                                        </div>
                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-4 border-t border-white/5 space-y-3">
                                        {customer.email && (
                                            <div className="flex items-center gap-2 text-sm text-zinc-400">
                                                <Mail size={14} className="text-zinc-600" />
                                                {customer.email}
                                            </div>
                                        )}
                                        {customer.address && (
                                            <div className="flex items-center gap-2 text-sm text-zinc-400">
                                                <MapPin size={14} className="text-zinc-600" />
                                                {customer.address}
                                            </div>
                                        )}
                                        {customer.note && (
                                            <div className="text-sm text-zinc-500 bg-zinc-900/50 rounded-lg p-2">
                                                {customer.note}
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingCustomer(customer);
                                                    setForm({
                                                        phone: customer.phone,
                                                        name: customer.name || '',
                                                        email: customer.email || '',
                                                        address: customer.address || '',
                                                        note: customer.note || ''
                                                    });
                                                    setShowAddForm(false);
                                                }}
                                                className="flex-1 py-2 bg-violet-500/10 text-violet-500 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                                            >
                                                <Edit2 size={14} /> Düzenle
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteCustomer(customer.id); }}
                                                className="px-4 py-2 bg-rose-500/10 text-rose-500 rounded-lg"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CustomersView;
