
import { useQuery } from '@tanstack/react-query';
import { Users, Gift, MousePointerClick, RefreshCcw } from 'lucide-react';
import { client } from '../api/api';

export default function ComunidadPage() {
    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
        queryKey: ['comunidad-stats'],
        queryFn: async () => {
            const res = await client<any>('/comunidad/stats');
            return res;
        }
    });

    const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
        queryKey: ['comunidad-users'],
        queryFn: async () => {
            const res = await client<any>('/comunidad/users?limit=50');
            return res;
        }
    });

    const handleRefresh = () => {
        refetchStats();
        refetchUsers();
    };

    return (
        <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Comunidad FEXCO</h1>
                    <p className="text-sm text-gray-500 mt-1">Leads y reclamos de cupones en tiempo real.</p>
                </div>
                <button 
                    onClick={handleRefresh}
                    className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                    <RefreshCcw size={16} />
                    Actualizar
                </button>
            </div>

            {/* Stats Grid */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Users size={20} />
                        </div>
                        <p className="text-sm font-medium text-gray-500">Registrados</p>
                        <p className="text-3xl font-black text-gray-900">{stats.total_registrados}</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
                        <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                            <Gift size={20} />
                        </div>
                        <p className="text-sm font-medium text-gray-500">Cupones Reclamados</p>
                        <p className="text-3xl font-black text-gray-900">{stats.total_reclamados}</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                            <PercentIcon />
                        </div>
                        <p className="text-sm font-medium text-gray-500">Tasa de Conversión</p>
                        <p className="text-3xl font-black text-gray-900">{stats.tasa_conversion}%</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center">
                            <MousePointerClick size={20} />
                        </div>
                        <p className="text-sm font-medium text-gray-500">Visitas a la Landing</p>
                        <p className="text-3xl font-black text-gray-900">{stats.total_visitas_globales}</p>
                    </div>
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col">
                <div className="p-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Últimos Registros</h2>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="text-xs uppercase bg-gray-50/50 text-gray-500 font-semibold border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-6 py-4">Teléfono</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4">Premio</th>
                                <th className="px-6 py-4">Visitas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {usersLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400 font-medium">Cargando...</td>
                                </tr>
                            ) : users?.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400 font-medium">Nadie se ha registrado todavía.</td>
                                </tr>
                            ) : (
                                users?.map((user: any) => (
                                    <tr key={user._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="font-bold text-gray-900">{user.nombre ? `${user.nombre} ${user.apellido || ''}` : 'Anónimo'}</div>
                                            <div className="text-xs text-gray-400">{user.email || 'Sin correo'}</div>
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-700">{user.telefono}</td>
                                        <td className="px-6 py-3">
                                            {user.ha_reclamado ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-50 text-green-700 text-xs font-bold">
                                                    Reclamado
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-yellow-50 text-yellow-700 text-xs font-bold">
                                                    Solo Vio
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            {user.premio_reclamado ? (
                                                <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-xs">
                                                    {user.premio_reclamado}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-500">{user.visitas_pagina}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function PercentIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>
    )
}
