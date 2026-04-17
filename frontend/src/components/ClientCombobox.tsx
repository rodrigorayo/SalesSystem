import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClientes } from '../api/api';
import { Search, User, Phone, X } from 'lucide-react';
import { useDebounceValue } from 'usehooks-ts';
import { motion, AnimatePresence } from 'framer-motion';

interface ClienteComboboxProps {
    onSelect: (cliente: any) => void;
    onClear: () => void;
    selectedClient: any;
    disabled?: boolean;
}

export function ClientCombobox({ onSelect, onClear, selectedClient, disabled }: ClienteComboboxProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebounceValue(search, 300);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const { data: clients = [], isLoading } = useQuery({
        queryKey: ['clientes', debouncedSearch],
        queryFn: () => getClientes(debouncedSearch),
        enabled: open, // solo busca si esta abierto
    });

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter local if we already fetched some
    const displayClients = clients.slice(0, 5); // limit to 5 results for clean UI

    if (selectedClient?.cliente_id) {
        return (
            <div className={`flex items-center justify-between border border-indigo-200 bg-indigo-50 rounded-lg px-3 py-2 ${disabled ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-6 h-6 rounded-full bg-indigo-200 flex flex-shrink-0 items-center justify-center text-indigo-700">
                        <User size={12} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-indigo-900 truncate">{selectedClient.razon_social}</span>
                        {selectedClient.telefono && <span className="text-[10px] text-indigo-600 flex items-center gap-1"><Phone size={8}/> {selectedClient.telefono}</span>}
                    </div>
                </div>
                {!disabled && (
                    <button onClick={onClear} className="w-6 h-6 rounded flex items-center justify-center text-indigo-400 hover:text-red-500 hover:bg-indigo-100 transition-colors">
                        <X size={14} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div ref={wrapperRef} className="relative">
            <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    disabled={disabled}
                    placeholder="Buscar cliente por teléfono, nombre o NIT..."
                    className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none placeholder:text-gray-400 bg-white"
                />
            </div>

            <AnimatePresence>
                {open && search.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
                    >
                        {isLoading ? (
                            <div className="p-3 text-center text-xs text-gray-500">Buscando...</div>
                        ) : displayClients.length === 0 ? (
                            <div className="p-4 text-center">
                                <p className="text-xs text-gray-500 mb-2">No se encontró "{search}"</p>
                                <button 
                                    onClick={() => {
                                        onSelect({
                                            cliente_id: undefined,
                                            razon_social: search.toUpperCase(),
                                            telefono: '',
                                            nit: '',
                                            email: '',
                                            es_factura: false
                                        });
                                        setOpen(false);
                                    }}
                                    className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
                                >
                                    + Continuar como "{search.toUpperCase()}" nuevo
                                </button>
                            </div>
                        ) : (
                            <ul className="max-h-60 overflow-auto divide-y divide-gray-100">
                                {displayClients.map((c: any) => (
                                    <li 
                                        key={c._id}
                                        onClick={() => {
                                            onSelect({
                                                cliente_id: c._id,
                                                razon_social: c.nombre,
                                                telefono: c.telefono || '',
                                                nit: c.nit_ci || '',
                                                email: c.email || '',
                                                es_factura: !!c.nit_ci
                                            });
                                            setOpen(false);
                                            setSearch('');
                                        }}
                                        className="px-3 py-2 flex items-center justify-between hover:bg-gray-50 cursor-pointer group"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{c.nombre}</span>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {c.telefono && <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Phone size={8}/> {c.telefono}</span>}
                                                {c.nit_ci && <span className="text-[10px] text-gray-500 border border-gray-200 rounded px-1">NIT: {c.nit_ci}</span>}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
