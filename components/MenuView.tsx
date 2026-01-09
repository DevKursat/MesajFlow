import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, UtensilsCrossed, DollarSign, Check, X, RefreshCw, Eye, EyeOff, Sparkles, FileImage, CheckCircle2 } from 'lucide-react';
import { MenuItem, MenuCategory } from '../types';
import { supabase } from '../services/supabaseService';

interface ExtractedItem { id: string; name: string; description: string; price: number; selected: boolean; }
interface MenuViewProps { businessId: string; showToast: (msg: string, type: 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO') => void; }

const MenuView: React.FC<MenuViewProps> = ({ businessId, showToast }) => {
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [items, setItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [showAddItem, setShowAddItem] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [itemForm, setItemForm] = useState({ name: '', description: '', price: '' });
    const [isDragging, setIsDragging] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [catRes, itemRes] = await Promise.all([
                supabase.from('menu_categories').select('*').eq('business_id', businessId).order('sort_order'),
                supabase.from('menu_items').select('*').eq('business_id', businessId).order('sort_order')
            ]);
            setCategories((catRes.data || []) as MenuCategory[]);
            setItems((itemRes.data || []) as MenuItem[]);
        } catch { showToast('Menü yüklenemedi', 'ERROR'); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { loadData(); }, [businessId]);

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) { setImportFile(file); setImportPreview(URL.createObjectURL(file)); setExtractedItems([]); }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setImportFile(file);
            setImportPreview(URL.createObjectURL(file));
            setExtractedItems([]);
        } else {
            showToast('Lütfen bir görsel dosyası sürükleyin', 'WARN');
        }
    };

    const analyzeImage = async () => {
        if (!importFile) return;
        setIsAnalyzing(true);
        try {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(importFile);
            });
            // @ts-ignore
            const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || 'AIzaSyBvhgHXsVz73l55eGPMF8q7wQ5Cq36_44o';

            const prompt = `Bu görseli analiz et. Eğer menü, yemek listesi, ürün listesi veya fiyat listesi görüyorsan TÜM ürünleri çıkar.

Her ürün için şunları bul:
- name: Ürün/yemek adı
- description: Varsa açıklama (yoksa boş string)
- price: Fiyat (sadece sayı, TL/₺ olmadan)

SADECE JSON array döndür, başka hiçbir şey yazma:
[{"name":"Ürün Adı","description":"Açıklama","price":99.90}]

Fiyat bulamazsan 0 yaz. Türkçe karakterleri koru.`;

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: importFile.type, data: base64 } }, { text: prompt }] }] })
            });
            const data = await res.json();
            console.log('Gemini Response:', data);

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            console.log('Extracted text:', text);

            // JSON'u bul - hem düz array hem de code block içinde arayalım
            let jsonStr = '';
            const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1].trim();
            } else {
                const arrayMatch = text.match(/\[[\s\S]*\]/);
                if (arrayMatch) jsonStr = arrayMatch[0];
            }

            if (jsonStr) {
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setExtractedItems(parsed.map((item: any, i: number) => ({
                        id: `ext_${Date.now()}_${i}`,
                        name: String(item.name || 'Ürün').trim(),
                        description: String(item.description || '').trim(),
                        price: parseFloat(item.price) || 0,
                        selected: true
                    })));
                    showToast(`${parsed.length} ürün bulundu!`, 'SUCCESS');
                } else {
                    showToast('Görselde ürün bulunamadı', 'WARN');
                }
            } else {
                console.error('JSON not found in response:', text);
                showToast('Ürün çıkarılamadı - lütfen menü görseli yükleyin', 'WARN');
            }
        } catch (err) {
            console.error('Analysis error:', err);
            showToast('Analiz başarısız - tekrar deneyin', 'ERROR');
        }
        finally { setIsAnalyzing(false); }
    };

    const saveExtractedItems = async () => {
        const selected = extractedItems.filter(i => i.selected);
        if (selected.length === 0) return;
        setIsSaving(true);
        try {
            await supabase.from('menu_items').insert(selected.map(item => ({ business_id: businessId, name: item.name, description: item.description || null, price: item.price, is_available: true })));
            showToast(`${selected.length} ürün eklendi!`, 'SUCCESS');
            setShowImportModal(false); setExtractedItems([]); setImportFile(null); setImportPreview(null); loadData();
        } catch { showToast('Kayıt başarısız', 'ERROR'); }
        finally { setIsSaving(false); }
    };

    const addCategory = async () => { if (!newCategoryName.trim()) return; try { await supabase.from('menu_categories').insert({ business_id: businessId, name: newCategoryName.trim(), sort_order: categories.length }); showToast('Eklendi', 'SUCCESS'); setNewCategoryName(''); setShowAddCategory(false); loadData(); } catch { showToast('Hata', 'ERROR'); } };
    const addItem = async () => { if (!itemForm.name.trim() || !itemForm.price) return; try { await supabase.from('menu_items').insert({ business_id: businessId, category_id: selectedCategory, name: itemForm.name.trim(), description: itemForm.description.trim() || null, price: parseFloat(itemForm.price), sort_order: items.filter(i => i.category_id === selectedCategory).length }); showToast('Eklendi', 'SUCCESS'); setItemForm({ name: '', description: '', price: '' }); setShowAddItem(false); loadData(); } catch { showToast('Hata', 'ERROR'); } };
    const updateItem = async () => { if (!editingItem) return; try { await supabase.from('menu_items').update({ name: itemForm.name.trim(), description: itemForm.description.trim() || null, price: parseFloat(itemForm.price) }).eq('id', editingItem.id); showToast('Güncellendi', 'SUCCESS'); setEditingItem(null); setItemForm({ name: '', description: '', price: '' }); loadData(); } catch { showToast('Hata', 'ERROR'); } };
    const toggleAvailability = async (item: MenuItem) => { await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id); loadData(); };
    const deleteItem = async (id: string) => { if (!confirm('Silmek istediğinize emin misiniz?')) return; await supabase.from('menu_items').delete().eq('id', id); loadData(); };
    const deleteCategory = async (id: string) => { if (!confirm('Kategoriyi silmek istediğinize emin misiniz?')) return; await supabase.from('menu_items').delete().eq('category_id', id); await supabase.from('menu_categories').delete().eq('id', id); if (selectedCategory === id) setSelectedCategory(null); loadData(); };

    const filteredItems = selectedCategory ? items.filter(i => i.category_id === selectedCategory) : items;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center"><UtensilsCrossed size={28} className="text-emerald-500" /></div>
                    <div><h2 className="text-2xl font-black uppercase tracking-tight">Menü Yönetimi</h2><p className="text-zinc-500 text-sm">{categories.length} kategori, {items.length} ürün</p></div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold text-xs rounded-xl"><Sparkles size={16} /> AI Import</button>
                    <button onClick={loadData} className="p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /></button>
                </div>
            </div>

            {showImportModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0c0c0d] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3"><Sparkles className="text-violet-500" size={24} /><h3 className="text-xl font-black">AI Menü Import</h3></div>
                            <button onClick={() => { setShowImportModal(false); setExtractedItems([]); setImportFile(null); setImportPreview(null); }} className="p-2 hover:bg-white/5 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {!importPreview ? (
                                <label
                                    className={`block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isDragging ? 'border-violet-500 bg-violet-500/10 scale-[1.02]' : 'border-white/10 hover:border-violet-500/50'}`}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                >
                                    <FileImage size={48} className={`mx-auto mb-4 ${isDragging ? 'text-violet-500 animate-bounce' : 'text-zinc-600'}`} />
                                    <p className={isDragging ? 'text-violet-400 font-bold' : 'text-zinc-400'}>
                                        {isDragging ? 'Bırakın!' : 'Menü fotoğrafı yükle veya sürükle'}
                                    </p>
                                    <p className="text-xs text-zinc-600 mt-2">PNG, JPG, WEBP desteklenir</p>
                                    <input type="file" accept="image/*" onChange={handleImportFile} className="hidden" />
                                </label>
                            ) : (
                                <div className="space-y-4">
                                    <div className="relative"><img src={importPreview} alt="Menü" className="max-h-48 mx-auto rounded-xl" /><button onClick={() => { setImportFile(null); setImportPreview(null); setExtractedItems([]); }} className="absolute top-2 right-2 p-2 bg-black/50 rounded-lg"><X size={16} /></button></div>
                                    {extractedItems.length === 0 ? (
                                        <button onClick={analyzeImage} disabled={isAnalyzing} className="w-full py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                                            {isAnalyzing ? <><RefreshCw className="animate-spin" size={18} /> Analiz Ediliyor...</> : <><Sparkles size={18} /> AI ile Analiz Et</>}
                                        </button>
                                    ) : (
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs text-zinc-500">{extractedItems.filter(i => i.selected).length}/{extractedItems.length} seçili</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setExtractedItems(ex => ex.map(e => ({ ...e, selected: true })))} className="text-xs text-violet-400 hover:text-violet-300">Tümünü Seç</button>
                                                    <button onClick={() => setExtractedItems(ex => ex.map(e => ({ ...e, selected: false })))} className="text-xs text-zinc-500 hover:text-zinc-400">Hiçbirini Seçme</button>
                                                </div>
                                            </div>
                                            {extractedItems.map(item => (
                                                <div key={item.id} className={`p-3 rounded-xl border ${item.selected ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/5 opacity-50'}`}>
                                                    <div className="flex items-start gap-3">
                                                        <button onClick={() => setExtractedItems(ex => ex.map(e => e.id === item.id ? { ...e, selected: !e.selected } : e))} className={`w-5 h-5 mt-1 rounded border flex items-center justify-center shrink-0 ${item.selected ? 'bg-violet-500 border-violet-500' : 'border-white/20'}`}>{item.selected && <Check size={12} />}</button>
                                                        <div className="flex-1 space-y-2">
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={item.name}
                                                                    onChange={(e) => setExtractedItems(ex => ex.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))}
                                                                    className="flex-1 bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-violet-500/50"
                                                                    placeholder="Ürün adı"
                                                                />
                                                                <div className="relative w-24">
                                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">₺</span>
                                                                    <input
                                                                        type="number"
                                                                        value={item.price}
                                                                        onChange={(e) => setExtractedItems(ex => ex.map(i => i.id === item.id ? { ...i, price: parseFloat(e.target.value) || 0 } : i))}
                                                                        className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-1.5 pl-6 text-sm font-bold text-violet-400 outline-none focus:border-violet-500/50"
                                                                        placeholder="0.00"
                                                                        step="0.01"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={item.description}
                                                                onChange={(e) => setExtractedItems(ex => ex.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                                                                className="w-full bg-zinc-900/30 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-zinc-400 outline-none focus:border-violet-500/50"
                                                                placeholder="Açıklama (opsiyonel)"
                                                            />
                                                        </div>
                                                        <button onClick={() => setExtractedItems(ex => ex.filter(e => e.id !== item.id))} className="p-1.5 text-zinc-500 hover:text-rose-500 shrink-0"><Trash2 size={14} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {extractedItems.length > 0 && (
                            <div className="p-6 border-t border-white/5">
                                <button onClick={saveExtractedItems} disabled={isSaving || extractedItems.filter(i => i.selected).length === 0} className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isSaving ? <><RefreshCw className="animate-spin" size={18} /> Kaydediliyor...</> : <><CheckCircle2 size={18} /> {extractedItems.filter(i => i.selected).length} Ürün Kaydet</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-4 bg-[#0c0c0d] border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500">Kategoriler</h3><button onClick={() => setShowAddCategory(true)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20"><Plus size={16} /></button></div>
                    {showAddCategory && (<div className="flex gap-2 mb-3"><input type="text" placeholder="Kategori adı" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="flex-1 bg-zinc-900 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none" autoFocus /><button onClick={addCategory} className="p-2 bg-emerald-500 text-black rounded-lg"><Check size={16} /></button><button onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} className="p-2 bg-zinc-800 rounded-lg"><X size={16} /></button></div>)}
                    <div className="space-y-1">
                        <button onClick={() => setSelectedCategory(null)} className={`w-full flex items-center justify-between p-3 rounded-xl ${!selectedCategory ? 'bg-emerald-500/10 text-emerald-500' : 'hover:bg-white/5'}`}><span className="font-medium">Tümü</span><span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{items.length}</span></button>
                        {categories.map(cat => (<div key={cat.id} className="group flex items-center"><button onClick={() => setSelectedCategory(cat.id)} className={`flex-1 flex items-center justify-between p-3 rounded-xl ${selectedCategory === cat.id ? 'bg-emerald-500/10 text-emerald-500' : 'hover:bg-white/5'}`}><span className="font-medium">{cat.name}</span><span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{items.filter(i => i.category_id === cat.id).length}</span></button><button onClick={() => deleteCategory(cat.id)} className="p-2 text-zinc-600 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button></div>))}
                    </div>
                </div>
                <div className="col-span-8 space-y-4">
                    <div className="flex items-center justify-between"><h3 className="font-bold text-lg">{selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 'Tüm Ürünler'}</h3><button onClick={() => { setShowAddItem(true); setEditingItem(null); setItemForm({ name: '', description: '', price: '' }); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl"><Plus size={16} /> Ürün Ekle</button></div>
                    {(showAddItem || editingItem) && (
                        <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3"><input type="text" placeholder="Ürün adı" value={itemForm.name} onChange={(e) => setItemForm(p => ({ ...p, name: e.target.value }))} className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 outline-none" /><div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} /><input type="number" placeholder="Fiyat" value={itemForm.price} onChange={(e) => setItemForm(p => ({ ...p, price: e.target.value }))} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 pl-10 outline-none" /></div></div>
                            <input type="text" placeholder="Açıklama (opsiyonel)" value={itemForm.description} onChange={(e) => setItemForm(p => ({ ...p, description: e.target.value }))} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 outline-none" />
                            <div className="flex gap-2"><button onClick={editingItem ? updateItem : addItem} className="flex-1 py-3 bg-emerald-500 text-black font-bold rounded-xl">{editingItem ? 'Güncelle' : 'Ekle'}</button><button onClick={() => { setShowAddItem(false); setEditingItem(null); }} className="px-4 py-3 bg-zinc-800 rounded-xl">İptal</button></div>
                        </div>
                    )}
                    {isLoading ? (<div className="text-center py-8 text-zinc-600">Yükleniyor...</div>) : filteredItems.length === 0 ? (<div className="text-center py-12 text-zinc-600"><UtensilsCrossed size={48} className="mx-auto mb-4 opacity-30" /><p>Henüz ürün yok</p></div>) : (
                        <div className="space-y-2">
                            {filteredItems.map(item => (
                                <div key={item.id} className={`bg-[#0c0c0d] border border-white/5 rounded-xl p-4 flex items-center justify-between ${!item.is_available && 'opacity-50'}`}>
                                    <div className="flex-1"><div className="flex items-center gap-2"><span className="font-bold">{item.name}</span>{!item.is_available && <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded">Stokta Yok</span>}</div>{item.description && <p className="text-sm text-zinc-500 mt-1">{item.description}</p>}</div>
                                    <div className="flex items-center gap-4"><span className="text-lg font-black text-emerald-500">₺{item.price.toFixed(2)}</span><div className="flex gap-1"><button onClick={() => toggleAvailability(item)} className={`p-2 rounded-lg ${item.is_available ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-500 bg-zinc-800'}`}>{item.is_available ? <Eye size={16} /> : <EyeOff size={16} />}</button><button onClick={() => { setEditingItem(item); setItemForm({ name: item.name, description: item.description || '', price: item.price.toString() }); setShowAddItem(false); }} className="p-2 text-blue-500 bg-blue-500/10 rounded-lg"><Edit2 size={16} /></button><button onClick={() => deleteItem(item.id)} className="p-2 text-rose-500 bg-rose-500/10 rounded-lg"><Trash2 size={16} /></button></div></div>
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
