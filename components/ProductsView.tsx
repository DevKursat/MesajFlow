import React, { useState, useEffect } from 'react';
import {
    Plus, Trash2, Edit2, Store, DollarSign, Check, X, RefreshCw,
    FolderOpen, Eye, EyeOff, Package, AlertTriangle
} from 'lucide-react';
import { Product, ProductCategory } from '../types';
import { supabase } from '../services/supabaseService';

interface ProductsViewProps {
    businessId: string;
    showToast: (message: string, type: 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO') => void;
}

const ProductsView: React.FC<ProductsViewProps> = ({ businessId, showToast }) => {
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Form state
    const [newCategoryName, setNewCategoryName] = useState('');
    const [productForm, setProductForm] = useState({ name: '', description: '', price: '', stock: '', sku: '' });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [catRes, prodRes] = await Promise.all([
                supabase.from('product_categories').select('*').eq('business_id', businessId).order('sort_order'),
                supabase.from('products').select('*').eq('business_id', businessId).order('sort_order')
            ]);
            if (catRes.error) throw catRes.error;
            if (prodRes.error) throw prodRes.error;
            setCategories((catRes.data || []) as ProductCategory[]);
            setProducts((prodRes.data || []) as Product[]);
        } catch (err) {
            showToast('Ürünler yüklenemedi', 'ERROR');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [businessId]);

    const addCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            const { error } = await supabase.from('product_categories').insert({
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

    const addProduct = async () => {
        if (!productForm.name.trim() || !productForm.price) return;
        try {
            const { error } = await supabase.from('products').insert({
                business_id: businessId,
                category_id: selectedCategory,
                name: productForm.name.trim(),
                description: productForm.description.trim() || null,
                price: parseFloat(productForm.price),
                stock: parseInt(productForm.stock) || 0,
                sku: productForm.sku.trim() || null,
                sort_order: products.filter(p => p.category_id === selectedCategory).length
            });
            if (error) throw error;
            showToast('Ürün eklendi', 'SUCCESS');
            setProductForm({ name: '', description: '', price: '', stock: '', sku: '' });
            setShowAddProduct(false);
            loadData();
        } catch {
            showToast('Ürün eklenemedi', 'ERROR');
        }
    };

    const updateProduct = async () => {
        if (!editingProduct) return;
        try {
            const { error } = await supabase.from('products').update({
                name: productForm.name.trim(),
                description: productForm.description.trim() || null,
                price: parseFloat(productForm.price),
                stock: parseInt(productForm.stock) || 0,
                sku: productForm.sku.trim() || null
            }).eq('id', editingProduct.id);
            if (error) throw error;
            showToast('Ürün güncellendi', 'SUCCESS');
            setEditingProduct(null);
            setProductForm({ name: '', description: '', price: '', stock: '', sku: '' });
            loadData();
        } catch {
            showToast('Güncellenemedi', 'ERROR');
        }
    };

    const toggleActive = async (product: Product) => {
        try {
            await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id);
            loadData();
        } catch {
            showToast('Hata oluştu', 'ERROR');
        }
    };

    const deleteProduct = async (id: string) => {
        if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
        try {
            await supabase.from('products').delete().eq('id', id);
            showToast('Silindi', 'SUCCESS');
            loadData();
        } catch {
            showToast('Silinemedi', 'ERROR');
        }
    };

    const deleteCategory = async (id: string) => {
        if (!confirm('Bu kategoriyi ve içindeki ürünleri silmek istediğinize emin misiniz?')) return;
        try {
            await supabase.from('products').delete().eq('category_id', id);
            await supabase.from('product_categories').delete().eq('id', id);
            showToast('Kategori silindi', 'SUCCESS');
            if (selectedCategory === id) setSelectedCategory(null);
            loadData();
        } catch {
            showToast('Silinemedi', 'ERROR');
        }
    };

    const filteredProducts = selectedCategory
        ? products.filter(p => p.category_id === selectedCategory)
        : products;

    const lowStockCount = products.filter(p => p.stock < 5 && p.is_active).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                        <Store size={28} className="text-blue-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Ürün Yönetimi</h2>
                        <p className="text-zinc-500 text-sm">
                            {categories.length} kategori, {products.length} ürün
                            {lowStockCount > 0 && <span className="text-amber-500 ml-2">• {lowStockCount} düşük stok</span>}
                        </p>
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
                        <button onClick={() => setShowAddCategory(true)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20">
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
                                className="flex-1 bg-zinc-900 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500/50"
                                autoFocus
                            />
                            <button onClick={addCategory} className="p-2 bg-blue-500 text-black rounded-lg"><Check size={16} /></button>
                            <button onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} className="p-2 bg-zinc-800 rounded-lg"><X size={16} /></button>
                        </div>
                    )}

                    <div className="space-y-1">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${!selectedCategory ? 'bg-blue-500/10 text-blue-500' : 'hover:bg-white/5'}`}
                        >
                            <span className="font-medium">Tümü</span>
                            <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{products.length}</span>
                        </button>
                        {categories.map(cat => (
                            <div key={cat.id} className="group flex items-center">
                                <button
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`flex-1 flex items-center justify-between p-3 rounded-xl transition-all ${selectedCategory === cat.id ? 'bg-blue-500/10 text-blue-500' : 'hover:bg-white/5'}`}
                                >
                                    <span className="font-medium">{cat.name}</span>
                                    <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{products.filter(p => p.category_id === cat.id).length}</span>
                                </button>
                                <button onClick={() => deleteCategory(cat.id)} className="p-2 text-zinc-600 hover:text-rose-500 opacity-0 group-hover:opacity-100">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Products */}
                <div className="col-span-8 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg">
                            {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 'Tüm Ürünler'}
                        </h3>
                        <button
                            onClick={() => { setShowAddProduct(true); setEditingProduct(null); setProductForm({ name: '', description: '', price: '', stock: '', sku: '' }); }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-black font-bold text-xs rounded-xl"
                        >
                            <Plus size={16} /> Ürün Ekle
                        </button>
                    </div>

                    {/* Add/Edit Form */}
                    {(showAddProduct || editingProduct) && (
                        <div className="bg-[#0c0c0d] border border-white/5 rounded-2xl p-4 space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <input
                                    type="text"
                                    placeholder="Ürün adı"
                                    value={productForm.name}
                                    onChange={(e) => setProductForm(p => ({ ...p, name: e.target.value }))}
                                    className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 outline-none focus:border-blue-500/50"
                                />
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                                    <input
                                        type="number"
                                        placeholder="Fiyat"
                                        value={productForm.price}
                                        onChange={(e) => setProductForm(p => ({ ...p, price: e.target.value }))}
                                        className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 pl-10 outline-none focus:border-blue-500/50"
                                    />
                                </div>
                                <div className="relative">
                                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                                    <input
                                        type="number"
                                        placeholder="Stok"
                                        value={productForm.stock}
                                        onChange={(e) => setProductForm(p => ({ ...p, stock: e.target.value }))}
                                        className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 pl-10 outline-none focus:border-blue-500/50"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    placeholder="Açıklama (opsiyonel)"
                                    value={productForm.description}
                                    onChange={(e) => setProductForm(p => ({ ...p, description: e.target.value }))}
                                    className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 outline-none focus:border-blue-500/50"
                                />
                                <input
                                    type="text"
                                    placeholder="SKU (opsiyonel)"
                                    value={productForm.sku}
                                    onChange={(e) => setProductForm(p => ({ ...p, sku: e.target.value }))}
                                    className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 font-mono"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={editingProduct ? updateProduct : addProduct} className="flex-1 py-3 bg-blue-500 text-black font-bold rounded-xl">
                                    {editingProduct ? 'Güncelle' : 'Ekle'}
                                </button>
                                <button onClick={() => { setShowAddProduct(false); setEditingProduct(null); }} className="px-4 py-3 bg-zinc-800 rounded-xl">
                                    İptal
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Products List */}
                    {isLoading ? (
                        <div className="text-center py-8 text-zinc-600">Yükleniyor...</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-12 text-zinc-600">
                            <Store size={48} className="mx-auto mb-4 opacity-30" />
                            <p>Henüz ürün yok</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredProducts.map(product => (
                                <div key={product.id} className={`bg-[#0c0c0d] border border-white/5 rounded-xl p-4 flex items-center justify-between ${!product.is_active && 'opacity-50'}`}>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">{product.name}</span>
                                            {product.sku && <span className="text-[10px] font-mono text-zinc-600">{product.sku}</span>}
                                            {!product.is_active && <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded">Pasif</span>}
                                        </div>
                                        {product.description && <p className="text-sm text-zinc-500 mt-1">{product.description}</p>}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <span className="text-lg font-black text-blue-500">₺{product.price.toFixed(2)}</span>
                                            <div className={`text-xs flex items-center gap-1 justify-end ${product.stock < 5 ? 'text-amber-500' : 'text-zinc-500'}`}>
                                                {product.stock < 5 && <AlertTriangle size={12} />}
                                                Stok: {product.stock}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => toggleActive(product)}
                                                className={`p-2 rounded-lg ${product.is_active ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-500 bg-zinc-800'}`}
                                            >
                                                {product.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingProduct(product);
                                                    setProductForm({
                                                        name: product.name,
                                                        description: product.description || '',
                                                        price: product.price.toString(),
                                                        stock: product.stock.toString(),
                                                        sku: product.sku || ''
                                                    });
                                                    setShowAddProduct(false);
                                                }}
                                                className="p-2 text-cyan-500 bg-cyan-500/10 rounded-lg"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => deleteProduct(product.id)} className="p-2 text-rose-500 bg-rose-500/10 rounded-lg">
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

export default ProductsView;
