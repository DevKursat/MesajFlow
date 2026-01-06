import React, { useState, useEffect } from 'react';
import {
    Plus, Trash2, Edit2, UtensilsCrossed, DollarSign, Check, X, RefreshCw,
    FolderOpen, ChevronRight, Eye, EyeOff, GripVertical
} from 'lucide-react';
import { MenuItem, MenuCategory } from '../types';
import { supabase } from '../services/supabaseService';

interface MenuViewProps {
    businessId: string;
    showToast: (message: string, type: 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO') => void;
}

const MenuView: React.FC<MenuViewProps> = ({ businessId, showToast }) => {
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [items, setItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [showAddItem, setShowAddItem] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

    // Form state
    const [newCategoryName, setNewCategoryName] = useState('');
    const [itemForm, setItemForm] = useState({ name: '', description: '', price: '' });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [catRes, itemRes] = await Promise.all([
                supabase.from('menu_categories').select('*').eq('business_id', businessId).order('sort_order'),
                supabase.from('menu_items').select('*').eq('business_id', businessId).order('sort_order')
            ]);
            if (catRes.error) throw catRes.error;
            if (itemRes.error) throw itemRes.error;
            setCategories((catRes.data || []) as MenuCategory[]);
            setItems((itemRes.data || []) as MenuItem[]);
        } catch (err) {
            showToast('Menü yüklenemedi', 'ERROR');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [businessId]);

    const addCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            const { error } = await supabase.from('menu_categories').insert({
                business_id: businessId,
                name: newCategoryName.trim(),
                sort_order: categories.length
            });
            if (error) throw error;
            showToast('Kategori eklendi', 'SUCCESS');
            setNewCategoryName('');
            setShowAddCategory(false);
            loadData();
        } catch {
            showToast('Kategori eklenemedi', 'ERROR');
        }
    };

    const addItem = async () => {
        if (!itemForm.name.trim() || !itemForm.price) return;
        try {
            const { error } = await supabase.from('menu_items').insert({
                business_id: businessId,
                category_id: selectedCategory,
                name: itemForm.name.trim(),
                description: itemForm.description.trim() || null,
                price: parseFloat(itemForm.price),
                sort_order: items.filter(i => i.category_id === selectedCategory).length
            });
            if (error) throw error;
            showToast('Ürün eklendi', 'SUCCESS');
            setItemForm({ name: '', description: '', price: '' });
            setShowAddItem(false);
            loadData();
        } catch {
            showToast('Ürün eklenemedi', 'ERROR');
        }
    };

    const updateItem = async () => {
        if (!editingItem) return;
        try {
            const { error } = await supabase.from('menu_items').update({
                name: itemForm.name.trim(),
                description: itemForm.description.trim() || null,
                price: parseFloat(itemForm.price)
            }).eq('id', editingItem.id);
            if (error) throw error;
            showToast('Ürün güncellendi', 'SUCCESS');
            setEditingItem(null);
            setItemForm({ name: '', description: '', price: '' });
            loadData();
        } catch {
            showToast('Güncellenemedi', 'ERROR');
        }
    };

    const toggleAvailability = async (item: MenuItem) => {
        try {
            await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id);
            loadData();
        } catch {
            showToast('Hata oluştu', 'ERROR');
        }
    };

    const deleteItem = async (id: string) => {
        if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
        try {
            await supabase.from('menu_items').delete().eq('id', id);
            showToast('Silindi', 'SUCCESS');
            loadData();
        } catch {
            showToast('Silinemedi', 'ERROR');
        }
    };

    const deleteCategory = async (id: string) => {
        if (!confirm('Bu kategoriyi ve içindeki ürünleri silmek istediğinize emin misiniz?')) return;
        try {
            await supabase.from('menu_items').delete().eq('category_id', id);
            await supabase.from('menu_categories').delete().eq('id', id);
            showToast('Kategori silindi', 'SUCCESS');
            if (selectedCategory === id) setSelectedCategory(null);
            loadData();
        } catch {
            showToast('Silinemedi', 'ERROR');
        }
    };

    const filteredItems = selectedCategory
        ? items.filter(i => i.category_id === selectedCategory)
        : items;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                        <UtensilsCrossed size={28} className="text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Menü Yönetimi</h2>
                        <p className="text-zinc-500 text-sm">{categories.length} kategori, {items.length} ürün</p>
                    </div>
                </div>
                <button onClick={loadData} className="p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700">
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Categories */}
                <div className="col-span-4 bg-[#0c0c0d] border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500">Kategoriler</h3>
                        <button onClick={() => setShowAddCategory(true)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20">
                            <Plus size={16} />
                        </button>
                    </div>

                    {showAddCategory && (
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                placeholder="Kategori adı"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="flex-1 bg-zinc-900 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
                                autoFocus
                            />
                            <button onClick={addCategory} className="p-2 bg-emerald-500 text-black rounded-lg"><Check size={16} /></button>
                            <button onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} className="p-2 bg-zinc-800 rounded-lg"><X size={16} /></button>
                        </div>
                    )}

                    <div className="space-y-1">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${!selectedCategory ? 'bg-emerald-500/10 text-emerald-500' : 'hover:bg-white/5'}`}
                        >
                            <span className="font-medium">Tümü</span>
                            <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{items.length}</span>
                        </button>
                        {categories.map(cat => (
                            <div key={cat.id} className="group flex items-center">
                                <button
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`flex-1 flex items-center justify-between p-3 rounded-xl transition-all ${selectedCategory === cat.id ? 'bg-emerald-500/10 text-emerald-500' : 'hover:bg-white/5'}`}
                                >
                                    <span className="font-medium">{cat.name}</span>
                                    <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{items.filter(i => i.category_id === cat.id).length}</span>
                                </button>
                                <button onClick={() => deleteCategory(cat.id)} className="p-2 text-zinc-600 hover:text-rose-500 opacity-0 group-hover:opacity-100">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Items */}
                <div className="col-span-8 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg">
                            {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 'Tüm Ürünler'}
                        </h3>
                        <button
                            onClick={() => { setShowAddItem(true); setEditingItem(null); setItemForm({ name: '', description: '', price: '' }); }}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl"
                        >
                            <Plus size={16} /> Ürün Ekle
                        </button>
                    </div>

                    {/* Add/Edit Form */}
                    {(showAddItem || editingItem) && (
                        <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    placeholder="Ürün adı"
                                    value={itemForm.name}
                                    onChange={(e) => setItemForm(p => ({ ...p, name: e.target.value }))}
                                    className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                                />
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                                    <input
                                        type="number"
                                        placeholder="Fiyat"
                                        value={itemForm.price}
                                        onChange={(e) => setItemForm(p => ({ ...p, price: e.target.value }))}
                                        className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 pl-10 outline-none focus:border-emerald-500/50"
                                    />
                                </div>
                            </div>
                            <input
                                type="text"
                                placeholder="Açıklama (opsiyonel)"
                                value={itemForm.description}
                                onChange={(e) => setItemForm(p => ({ ...p, description: e.target.value }))}
                                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                            />
                            <div className="flex gap-2">
                                <button onClick={editingItem ? updateItem : addItem} className="flex-1 py-3 bg-emerald-500 text-black font-bold rounded-xl">
                                    {editingItem ? 'Güncelle' : 'Ekle'}
                                </button>
                                <button onClick={() => { setShowAddItem(false); setEditingItem(null); }} className="px-4 py-3 bg-zinc-800 rounded-xl">
                                    İptal
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Items List */}
                    {isLoading ? (
                        <div className="text-center py-8 text-zinc-600">Yükleniyor...</div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-12 text-zinc-600">
                            <UtensilsCrossed size={48} className="mx-auto mb-4 opacity-30" />
                            <p>Henüz ürün yok</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredItems.map(item => (
                                <div key={item.id} className={`bg-[#0c0c0d] border border-white/5 rounded-xl p-4 flex items-center justify-between ${!item.is_available && 'opacity-50'}`}>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">{item.name}</span>
                                            {!item.is_available && <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded">Stokta Yok</span>}
                                        </div>
                                        {item.description && <p className="text-sm text-zinc-500 mt-1">{item.description}</p>}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-lg font-black text-emerald-500">₺{item.price.toFixed(2)}</span>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => toggleAvailability(item)}
                                                className={`p-2 rounded-lg ${item.is_available ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-500 bg-zinc-800'}`}
                                            >
                                                {item.is_available ? <Eye size={16} /> : <EyeOff size={16} />}
                                            </button>
                                            <button
                                                onClick={() => { setEditingItem(item); setItemForm({ name: item.name, description: item.description || '', price: item.price.toString() }); setShowAddItem(false); }}
                                                className="p-2 text-blue-500 bg-blue-500/10 rounded-lg"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => deleteItem(item.id)} className="p-2 text-rose-500 bg-rose-500/10 rounded-lg">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MenuView;
