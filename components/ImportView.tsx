import React, { useState, useCallback } from 'react';
import {
    Upload, Sparkles, Check, X, Trash2, Plus, RefreshCw,
    Image, FileImage, AlertCircle, CheckCircle2, Edit2
} from 'lucide-react';
import { supabase } from '../services/supabaseService';
import { BusinessType } from '../types';

interface ExtractedItem {
    id: string;
    name: string;
    description: string;
    price: number;
    selected: boolean;
}

interface ImportViewProps {
    businessId: string;
    businessType: BusinessType;
    showToast: (message: string, type: 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO') => void;
}

const ImportView: React.FC<ImportViewProps> = ({ businessId, businessType, showToast }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const isRestaurant = businessType === 'RESTAURANT';
    const itemLabel = isRestaurant ? 'Menü Öğesi' : 'Ürün';
    const tableName = isRestaurant ? 'menu_items' : 'products';

    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type.startsWith('image/')) {
            setFile(droppedFile);
            setPreview(URL.createObjectURL(droppedFile));
            setExtractedItems([]);
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
            setExtractedItems([]);
        }
    };

    const analyzeImage = async () => {
        if (!file) return;
        setIsAnalyzing(true);

        try {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    resolve(result.split(',')[1]);
                };
                reader.readAsDataURL(file);
            });

            // @ts-ignore - Vite env
            const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || 'AIzaSyBvhgHXsVz73l55eGPMF8q7wQ5Cq36_44o';

            const prompt = isRestaurant
                ? `Bu menü fotoğrafını analiz et. Tüm yemekleri/içecekleri bul.

Her öğe için şu JSON formatında döndür:
[
  {"name": "Ürün adı", "description": "Açıklama veya içindekiler", "price": 99.90},
  ...
]

KURALLAR:
- Fiyatları sayı olarak yaz (TL, ₺ veya virgül olmadan)
- Açıklama yoksa boş string kullan
- SADECE JSON array döndür, başka bir şey yazma`
                : `Bu e-ticaret sitesi/katalog görselini analiz et. Tüm ürünleri bul.

Her ürün için şu JSON formatında döndür:
[
  {"name": "Ürün adı", "description": "Ürün açıklaması", "price": 99.90},
  ...
]

KURALLAR:
- Fiyatları sayı olarak yaz (TL, ₺ veya virgül olmadan)
- Açıklama yoksa boş string kullan
- SADECE JSON array döndür, başka bir şey yazma`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: file.type, data: base64 } },
                            { text: prompt }
                        ]
                    }]
                })
            });

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // JSON parse
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const items = JSON.parse(jsonMatch[0]);
                const formattedItems: ExtractedItem[] = items.map((item: any, index: number) => ({
                    id: `item_${Date.now()}_${index}`,
                    name: item.name || '',
                    description: item.description || '',
                    price: parseFloat(item.price) || 0,
                    selected: true
                }));
                setExtractedItems(formattedItems);
                showToast(`${formattedItems.length} ${itemLabel.toLowerCase()} bulundu!`, 'SUCCESS');
            } else {
                showToast('Ürün bulunamadı, farklı bir görsel deneyin', 'WARN');
            }
        } catch (err) {
            console.error('Analiz hatası:', err);
            showToast('Analiz başarısız oldu', 'ERROR');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleItem = (id: string) => {
        setExtractedItems(items => items.map(item =>
            item.id === id ? { ...item, selected: !item.selected } : item
        ));
    };

    const updateItem = (id: string, field: keyof ExtractedItem, value: string | number) => {
        setExtractedItems(items => items.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const deleteItem = (id: string) => {
        setExtractedItems(items => items.filter(item => item.id !== id));
    };

    const saveItems = async () => {
        const selectedItems = extractedItems.filter(item => item.selected);
        if (selectedItems.length === 0) {
            showToast('En az bir öğe seçmelisiniz', 'WARN');
            return;
        }

        setIsSaving(true);
        try {
            const inserts = selectedItems.map(item => ({
                business_id: businessId,
                name: item.name,
                description: item.description || null,
                price: item.price,
                ...(isRestaurant ? { is_available: true } : { is_active: true, stock: 0 })
            }));

            const { error } = await supabase.from(tableName).insert(inserts);
            if (error) throw error;

            showToast(`${selectedItems.length} ${itemLabel.toLowerCase()} eklendi!`, 'SUCCESS');
            setExtractedItems([]);
            setFile(null);
            setPreview(null);
        } catch (err) {
            showToast('Kayıt başarısız', 'ERROR');
        } finally {
            setIsSaving(false);
        }
    };

    const selectAll = (value: boolean) => {
        setExtractedItems(items => items.map(item => ({ ...item, selected: value })));
    };

    const selectedCount = extractedItems.filter(i => i.selected).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center">
                    <Sparkles size={28} className="text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">AI {itemLabel} Import</h2>
                    <p className="text-zinc-500 text-sm">
                        {isRestaurant ? 'Menü fotoğrafından' : 'E-ticaret sitesinden'} otomatik tanıma
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Upload Area */}
                <div className="space-y-4">
                    <div
                        onDrop={handleFileDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer
              ${preview ? 'border-violet-500/50 bg-violet-500/5' : 'border-white/10 hover:border-white/20'}`}
                    >
                        {preview ? (
                            <div className="relative">
                                <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-xl" />
                                <button
                                    onClick={() => { setFile(null); setPreview(null); setExtractedItems([]); }}
                                    className="absolute top-2 right-2 p-2 bg-black/50 rounded-lg hover:bg-black/70"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <label className="cursor-pointer block">
                                <FileImage size={48} className="mx-auto mb-4 text-zinc-600" />
                                <p className="text-zinc-400 mb-2">Görsel yükle veya sürükle</p>
                                <p className="text-xs text-zinc-600">PNG, JPG, WEBP</p>
                                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                            </label>
                        )}
                    </div>

                    {preview && (
                        <button
                            onClick={analyzeImage}
                            disabled={isAnalyzing}
                            className="w-full py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isAnalyzing ? (
                                <>
                                    <RefreshCw className="animate-spin" size={20} />
                                    Analiz Ediliyor...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={20} />
                                    AI ile Analiz Et
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Results */}
                <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-4 max-h-[500px] overflow-y-auto">
                    {extractedItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-600 py-12">
                            <Image size={48} className="mb-4 opacity-30" />
                            <p>Görsel yükleyip analiz edin</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm text-zinc-500">{extractedItems.length} öğe bulundu</span>
                                <div className="flex gap-2">
                                    <button onClick={() => selectAll(true)} className="text-xs px-3 py-1 bg-white/5 rounded-lg">Tümünü Seç</button>
                                    <button onClick={() => selectAll(false)} className="text-xs px-3 py-1 bg-white/5 rounded-lg">Hiçbiri</button>
                                </div>
                            </div>

                            {extractedItems.map(item => (
                                <div key={item.id} className={`p-3 rounded-xl border transition-all ${item.selected ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/5 opacity-50'}`}>
                                    <div className="flex items-start gap-3">
                                        <button onClick={() => toggleItem(item.id)} className={`mt-1 w-5 h-5 rounded border flex items-center justify-center ${item.selected ? 'bg-violet-500 border-violet-500' : 'border-white/20'}`}>
                                            {item.selected && <Check size={12} />}
                                        </button>

                                        <div className="flex-1 space-y-2">
                                            {editingId === item.id ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                                        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
                                                        placeholder="İsim"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={item.description}
                                                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                                        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
                                                        placeholder="Açıklama"
                                                    />
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="number"
                                                            value={item.price}
                                                            onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                                            className="w-24 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
                                                            placeholder="Fiyat"
                                                        />
                                                        <button onClick={() => setEditingId(null)} className="px-3 py-2 bg-violet-500 text-white text-sm rounded-lg">
                                                            <Check size={14} />
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold">{item.name}</span>
                                                        <span className="font-bold text-violet-400">₺{item.price.toFixed(2)}</span>
                                                    </div>
                                                    {item.description && <p className="text-xs text-zinc-500">{item.description}</p>}
                                                </>
                                            )}
                                        </div>

                                        <div className="flex gap-1">
                                            <button onClick={() => setEditingId(editingId === item.id ? null : item.id)} className="p-1.5 text-zinc-500 hover:text-white">
                                                <Edit2 size={14} />
                                            </button>
                                            <button onClick={() => deleteItem(item.id)} className="p-1.5 text-zinc-500 hover:text-rose-500">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Save Button */}
            {extractedItems.length > 0 && (
                <button
                    onClick={saveItems}
                    disabled={isSaving || selectedCount === 0}
                    className="w-full py-4 bg-emerald-500 text-black font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isSaving ? (
                        <>
                            <RefreshCw className="animate-spin" size={20} />
                            Kaydediliyor...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={20} />
                            {selectedCount} {itemLabel} Kaydet
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

export default ImportView;
