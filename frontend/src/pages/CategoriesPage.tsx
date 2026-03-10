import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client';
import { Plus, Trash2, Loader2, Tag, X } from 'lucide-react';
import type { Category, CategoryCreate } from '../api/types';

export default function CategoriesPage() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<CategoryCreate>({ name: '', description: '' });

    // Fetch Categories
    const { data: categories, isLoading } = useQuery({
        queryKey: ['categories'],
        queryFn: () => client<Category[]>('/categories')
    });

    // Mutations
    const createCategoryMutation = useMutation({
        mutationFn: (data: CategoryCreate) => client<Category>('/categories', { body: data }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setIsModalOpen(false);
            setFormData({ name: '', description: '' });
        }
    });

    const deleteCategoryMutation = useMutation({
        mutationFn: (id: string) => client<{ message: string }>(`/categories/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createCategoryMutation.mutate(formData);
    };

    return (
        <div className="max-w-7xl mx-auto px-3 py-4 md:p-4 space-y-4 pb-20 md:pb-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Categorías</h1>
                    <p className="text-gray-500 mt-1">Organiza tus productos</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold shadow-lg hover:bg-gray-900 transition-all active:scale-95"
                >
                    <Plus size={20} /> Nueva Categoría
                </button>
            </div>

            <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-200/60">
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categories?.map(category => (
                            <div key={category._id} className="group p-6 bg-gray-50 rounded-3xl border border-transparent hover:border-gray-200 hover:bg-white transition-all hover:shadow-lg flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                            <Tag size={20} />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900">{category.name}</h3>
                                    </div>
                                    <p className="text-sm text-gray-500 pl-13">{category.description || 'Sin descripción'}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        if (confirm('¿Eliminar categoría?')) deleteCategoryMutation.mutate(category._id);
                                    }}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        {categories?.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-400">
                                <Tag size={48} className="mx-auto mb-4 opacity-20" />
                                <p>No hay categorías creadas.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Nueva Categoría</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Nombre</label>
                                <input
                                    type="text" required autoFocus
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                    placeholder="Ej. Bebidas"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Descripción (Opcional)</label>
                                <textarea
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 min-h-[100px] text-gray-900"
                                    placeholder="Opcional..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={createCategoryMutation.isPending}
                                className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-900 transition-all flex items-center justify-center gap-2"
                            >
                                {createCategoryMutation.isPending ? <Loader2 className="animate-spin" /> : 'Crear Categoría'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
