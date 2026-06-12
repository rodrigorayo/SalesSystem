import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRecipes, createRecipe, updateRecipe, deleteRecipe, getProducts } from '../api/api';
import { Plus, Trash2, Loader2, BookOpen, X, Search, Utensils, Edit3 } from 'lucide-react';
import type { Recipe, RecipeCreate, RecipeIngredientCreate, RecipeType } from '../api/types';
import { toast } from 'sonner';
import { useConfirm } from '../components/ConfirmModal';


const RECIPE_TYPES: { value: RecipeType; label: string }[] = [
    { value: 'PLATO_FINAL', label: 'Plato Final (Bowl)' },
    { value: 'BASE', label: 'Base (Arroz, Fideos, etc.)' },
    { value: 'PROTEINA', label: 'Proteína (Pollo, Carne, etc.)' },
    { value: 'TOPPING', label: 'Topping (Verduras, Semillas, etc.)' },
    { value: 'SALSAS', label: 'Salsa / Aderezo' },
    { value: 'BEBIDA', label: 'Bebida' },
    { value: 'COMPLEMENTO', label: 'Complemento / Acompañamiento' }
];

export default function RecipesPage() {
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [tipo, setTipo] = useState<RecipeType>('PLATO_FINAL');
    const [precioExtra, setPrecioExtra] = useState(0);
    const [ingredientes, setIngredientes] = useState<RecipeIngredientCreate[]>([]);

    // Fetch Recipes
    const { data: recipes, isLoading } = useQuery({
        queryKey: ['recipes'],
        queryFn: getRecipes
    });

    // Fetch Products for ingredient selection (limit=100 for easy dropdown search)
    const { data: productsData } = useQuery({
        queryKey: ['products-for-ingredients'],
        queryFn: () => getProducts(1, 100, ''),
        enabled: isModalOpen
    });
    const products = productsData?.items || [];

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: RecipeCreate) => createRecipe(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
            closeModal();
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; recipe: Partial<RecipeCreate> }) => updateRecipe(data.id, data.recipe),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
            closeModal();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteRecipe(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
        }
    });

    const openCreateModal = () => {
        setEditingId(null);
        setNombre('');
        setDescripcion('');
        setTipo('PLATO_FINAL');
        setPrecioExtra(0);
        setIngredientes([]);
        setIsModalOpen(true);
    };

    const openEditModal = (recipe: Recipe) => {
        setEditingId(recipe._id);
        setNombre(recipe.nombre);
        setDescripcion(recipe.descripcion || '');
        setTipo(recipe.tipo);
        setPrecioExtra(recipe.precio_extra || 0);
        
        // Map ingredients response to input structure
        const mappedIngs = (recipe.ingredientes || []).map(ing => ({
            producto_id: ing.producto_id,
            cantidad: ing.cantidad,
            unidad_medida_receta: ing.unidad_medida_receta,
            tipo_almacen_origen: ing.tipo_almacen_origen,
            es_opcional: ing.es_opcional,
            notas: ing.notas || ''
        }));
        setIngredientes(mappedIngs);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleAddIngredient = () => {
        setIngredientes([
            ...ingredientes,
            { producto_id: '', cantidad: 0, unidad_medida_receta: 'kg', tipo_almacen_origen: 'MATERIA_PRIMA', es_opcional: false, notas: '' }
        ]);
    };

    const handleRemoveIngredient = (index: number) => {
        setIngredientes(ingredientes.filter((_, i) => i !== index));
    };

    const handleIngredientChange = (index: number, field: keyof RecipeIngredientCreate, value: any) => {
        const updated = [...ingredientes];
        updated[index] = { ...updated[index], [field]: value };
        setIngredientes(updated);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation: check if all ingredients have a selected product and quantity > 0
        const invalid = ingredientes.some(ing => !ing.producto_id || ing.cantidad <= 0);
        if (invalid) {
            toast.warning('Por favor selecciona un producto y especifica una cantidad mayor a 0 para todos los ingredientes.');
            return;
        }

        const recipeData: RecipeCreate = {
            nombre,
            descripcion,
            tipo,
            precio_extra: precioExtra,
            ingredientes
        };

        if (editingId) {
            updateMutation.mutate({ id: editingId, recipe: recipeData });
        } else {
            createMutation.mutate(recipeData);
        }
    };

    const filteredRecipes = (recipes || []).filter(r => 
        r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto px-3 py-4 md:p-4 space-y-4 pb-20 md:pb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Recetas (BOM)</h1>
                    <p className="text-gray-500 mt-1">Define las recetas y los ingredientes/materia prima consumidos por bowl</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold shadow-lg hover:bg-gray-900 transition-all active:scale-95 shrink-0"
                >
                    <Plus size={20} /> Nueva Receta
                </button>
            </div>

            {/* Buscador */}
            <div className="relative">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="Buscar receta por nombre o descripción..."
                    className="w-full bg-white border border-gray-200 rounded-full pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900 shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="bg-white rounded-[40px] p-6 md:p-8 shadow-sm border border-gray-200/60">
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRecipes.map(recipe => (
                            <div key={recipe._id} className="group p-6 bg-gray-50 rounded-3xl border border-transparent hover:border-gray-200 hover:bg-white transition-all hover:shadow-lg flex flex-col justify-between h-full">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                                                <Utensils size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 truncate max-w-[150px] md:max-w-[200px]" title={recipe.nombre}>{recipe.nombre}</h3>
                                                <span className="text-[10px] bg-emerald-100/50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold uppercase">
                                                    {RECIPE_TYPES.find(t => t.value === recipe.tipo)?.label || recipe.tipo}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{recipe.descripcion || 'Sin descripción'}</p>
                                    
                                    {recipe.precio_extra ? (
                                        <div className="text-xs text-amber-600 font-bold mb-4 bg-amber-50 px-3 py-1 rounded-lg inline-block">
                                            Costo extra: +${recipe.precio_extra.toFixed(2)}
                                        </div>
                                    ) : null}

                                    {/* Mostrar resumen de ingredientes */}
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ingredientes ({(recipe.ingredientes || []).length})</h4>
                                        <div className="space-y-1">
                                            {(recipe.ingredientes || []).slice(0, 3).map((ing, idx) => (
                                                <div key={idx} className="text-xs text-gray-600 flex justify-between">
                                                    <span className="truncate max-w-[150px]">Ingrediente {idx + 1}</span>
                                                    <span className="font-semibold text-gray-800">{ing.cantidad} {ing.unidad_medida_receta}</span>
                                                </div>
                                            ))}
                                            {(recipe.ingredientes || []).length > 3 && (
                                                <div className="text-[10px] text-gray-400 italic">Y {(recipe.ingredientes || []).length - 3} más...</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-gray-100/60 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEditModal(recipe)}
                                        className="p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                                        title="Editar Receta"
                                    >
                                        <Edit3 size={15} /> Editar
                                    </button>
                                    <button
                                        onClick={async () => {
                                             if (await confirm({
                                                 title: '¿Eliminar receta?',
                                                 message: '¿Estás seguro de que deseas eliminar esta receta?',
                                                 type: 'danger',
                                                 confirmLabel: 'Eliminar',
                                                 cancelLabel: 'Cancelar'
                                             })) {
                                                 deleteMutation.mutate(recipe._id);
                                             }
                                        }}
                                        className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={15} /> Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                        {filteredRecipes.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-400">
                                <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                                <p>No se encontraron recetas.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-[32px] p-6 md:p-8 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 my-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">{editingId ? 'Editar Receta' : 'Nueva Receta'}</h2>
                            <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Nombre de la Receta</label>
                                    <input
                                        type="text" required autoFocus
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                        placeholder="Ej. Bowl Proteico Pollo"
                                        value={nombre}
                                        onChange={e => setNombre(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tipo de Componente</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                        value={tipo}
                                        onChange={e => setTipo(e.target.value as RecipeType)}
                                    >
                                        {RECIPE_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Descripción</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                        placeholder="Descripción corta del componente"
                                        value={descripcion}
                                        onChange={e => setDescripcion(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Precio Adicional en Bowl ($)</label>
                                    <input
                                        type="number" step="0.01" min="0"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                        placeholder="0.00"
                                        value={precioExtra}
                                        onChange={e => setPrecioExtra(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            {/* Sección de ingredientes (BOM) */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Ingredientes / Materias Primas</h3>
                                    <button
                                        type="button"
                                        onClick={handleAddIngredient}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors"
                                    >
                                        <Plus size={14} /> Añadir Ingrediente
                                    </button>
                                </div>

                                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                                    {ingredientes.map((ing, index) => (
                                        <div key={index} className="flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                            {/* Selector de Producto */}
                                            <div className="flex-1 min-w-[180px]">
                                                <select
                                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-black/5"
                                                    value={ing.producto_id}
                                                    onChange={e => handleIngredientChange(index, 'producto_id', e.target.value)}
                                                >
                                                    <option value="">-- Seleccionar Materia Prima --</option>
                                                    {products.map(p => (
                                                        <option key={p._id} value={p._id}>{p.descripcion} (${p.costo_producto || 0})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Cantidad */}
                                            <div className="w-full md:w-20">
                                                <input
                                                    type="number" step="0.0001" min="0.0001" required
                                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-black/5"
                                                    placeholder="Cant."
                                                    value={ing.cantidad || ''}
                                                    onChange={e => handleIngredientChange(index, 'cantidad', Number(e.target.value))}
                                                />
                                            </div>

                                            {/* Unidad */}
                                            <div className="w-full md:w-24">
                                                <select
                                                    required
                                                    className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-black/5"
                                                    value={ing.unidad_medida_receta}
                                                    onChange={e => handleIngredientChange(index, 'unidad_medida_receta', e.target.value)}
                                                >
                                                    <option value="kg">kg</option>
                                                    <option value="g">g</option>
                                                    <option value="L">L</option>
                                                    <option value="ml">ml</option>
                                                    <option value="u">u</option>
                                                    <option value="oz">oz</option>
                                                    <option value="lb">lb</option>
                                                </select>
                                            </div>

                                            {/* Notas */}
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-black/5"
                                                    placeholder="Notas (opcional)"
                                                    value={ing.notas}
                                                    onChange={e => handleIngredientChange(index, 'notas', e.target.value)}
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleRemoveIngredient(index)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}

                                    {ingredientes.length === 0 && (
                                        <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl text-xs">
                                            No se han añadido ingredientes todavía. Haz click en "Añadir Ingrediente" para comenzar.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-900 transition-all flex items-center justify-center gap-2"
                            >
                                {createMutation.isPending || updateMutation.isPending ? <Loader2 className="animate-spin" /> : editingId ? 'Guardar Cambios' : 'Crear Receta'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
