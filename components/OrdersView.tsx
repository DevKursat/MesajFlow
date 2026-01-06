import React, { useState, useEffect } from 'react';
import {
    Package, Clock, CheckCircle, Truck, XCircle, ChevronDown, ChevronUp,
    RefreshCw, Search, Filter, Phone, MapPin, User, ShoppingBag
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { supabase } from '../services/supabaseService';

interface OrdersViewProps {
    businessId: string;
    businessType: 'RESTAURANT' | 'ECOMMERCE';
    showToast: (message: string, type: 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO') => void;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode; next?: OrderStatus }> = {
    PENDING: { label: 'Bekliyor', color: 'text-amber-500 bg-amber-500/10', icon: <Clock size={16} />, next: 'CONFIRMED' },
    CONFIRMED: { label: 'Onaylandı', color: 'text-blue-500 bg-blue-500/10', icon: <CheckCircle size={16} />, next: 'PREPARING' },
    PREPARING: { label: 'Hazırlanıyor', color: 'text-purple-500 bg-purple-500/10', icon: <Package size={16} />, next: 'SHIPPED' },
    SHIPPED: { label: 'Yolda', color: 'text-cyan-500 bg-cyan-500/10', icon: <Truck size={16} />, next: 'DELIVERED' },
    DELIVERED: { label: 'Teslim Edildi', color: 'text-emerald-500 bg-emerald-500/10', icon: <CheckCircle size={16} /> },
    CANCELLED: { label: 'İptal', color: 'text-rose-500 bg-rose-500/10', icon: <XCircle size={16} /> },
};

const OrdersView: React.FC<OrdersViewProps> = ({ businessId, businessType, showToast }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const loadOrders = async () => {
        setIsLoading(true);
        try {
            let query = supabase.from('orders').select('*').eq('business_id', businessId).order('created_at', { ascending: false });
            if (statusFilter !== 'ALL') query = query.eq('status', statusFilter);
            const { data, error } = await query;
            if (error) throw error;
            setOrders((data || []) as Order[]);
        } catch (err) {
            showToast('Siparişler yüklenemedi', 'ERROR');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadOrders(); }, [businessId, statusFilter]);

    const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
        try {
            const { error } = await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId);
            if (error) throw error;
            showToast(`Sipariş durumu: ${STATUS_CONFIG[newStatus].label}`, 'SUCCESS');
            loadOrders();
        } catch {
            showToast('Durum güncellenemedi', 'ERROR');
        }
    };

    const filteredOrders = orders.filter(o =>
        !searchQuery ||
        o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer_phone?.includes(searchQuery) ||
        o.order_number?.includes(searchQuery)
    );

    const pendingCount = orders.filter(o => o.status === 'PENDING').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 ${businessType === 'RESTAURANT' ? 'bg-emerald-500/10' : 'bg-blue-500/10'} rounded-2xl flex items-center justify-center`}>
                        <ShoppingBag size={28} className={businessType === 'RESTAURANT' ? 'text-emerald-500' : 'text-blue-500'} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Siparişler</h2>
                        <p className="text-zinc-500 text-sm">{pendingCount > 0 && <span className="text-amber-500">{pendingCount} bekleyen</span>}</p>
                    </div>
                </div>
                <button onClick={loadOrders} className="p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors">
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input
                        type="text"
                        placeholder="Müşteri, telefon veya sipariş no..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-emerald-500/50"
                    />
                </div>
                <div className="flex gap-2">
                    {(['ALL', 'PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === status ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                        >
                            {status === 'ALL' ? 'Tümü' : STATUS_CONFIG[status].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders List */}
            {isLoading ? (
                <div className="text-center py-12 text-zinc-600">
                    <RefreshCw size={32} className="animate-spin mx-auto mb-2" />
                    <p>Yükleniyor...</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-zinc-600">
                    <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
                    <p>Sipariş bulunamadı</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredOrders.map(order => {
                        const statusConfig = STATUS_CONFIG[order.status];
                        const isExpanded = expandedOrder === order.id;

                        return (
                            <div key={order.id} className="bg-[#0c0c0d] border border-white/5 rounded-2xl overflow-hidden">
                                {/* Order Header */}
                                <div
                                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-xl ${statusConfig.color}`}>
                                            {statusConfig.icon}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white">#{order.order_number || order.id.slice(0, 8)}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-lg ${statusConfig.color}`}>
                                                    {statusConfig.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                                                {order.customer_name && <span className="flex items-center gap-1"><User size={12} />{order.customer_name}</span>}
                                                {order.customer_phone && <span className="flex items-center gap-1"><Phone size={12} />{order.customer_phone}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-lg font-black text-emerald-500">₺{order.total.toFixed(2)}</span>
                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </div>

                                {/* Order Details */}
                                {isExpanded && (
                                    <div className="p-5 border-t border-white/5 space-y-4">
                                        {/* Items */}
                                        <div className="bg-zinc-900/50 rounded-xl p-4">
                                            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Ürünler</p>
                                            <div className="space-y-2">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="flex justify-between text-sm">
                                                        <span className="text-zinc-300">{item.quantity}x {item.name}</span>
                                                        <span className="text-zinc-500">₺{(item.price * item.quantity).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="border-t border-white/5 mt-3 pt-3 flex justify-between font-bold">
                                                <span>Toplam</span>
                                                <span className="text-emerald-500">₺{order.total.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Address */}
                                        {order.address && (
                                            <div className="flex items-start gap-2 text-sm text-zinc-400">
                                                <MapPin size={16} className="mt-0.5 text-zinc-600" />
                                                <span>{order.address}</span>
                                            </div>
                                        )}

                                        {/* Note */}
                                        {order.note && (
                                            <div className="text-sm text-zinc-500 bg-zinc-900/50 rounded-xl p-3">
                                                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Not: </span>
                                                {order.note}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            {statusConfig.next && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                                                <button
                                                    onClick={() => updateStatus(order.id, statusConfig.next!)}
                                                    className={`flex-1 py-3 rounded-xl font-bold text-sm ${STATUS_CONFIG[statusConfig.next].color} hover:brightness-110 transition-all flex items-center justify-center gap-2`}
                                                >
                                                    {STATUS_CONFIG[statusConfig.next].icon}
                                                    {STATUS_CONFIG[statusConfig.next].label} Yap
                                                </button>
                                            )}
                                            {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
                                                <button
                                                    onClick={() => updateStatus(order.id, 'CANCELLED')}
                                                    className="px-4 py-3 rounded-xl text-sm text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-all"
                                                >
                                                    İptal
                                                </button>
                                            )}
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

export default OrdersView;
