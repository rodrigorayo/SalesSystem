import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Clock, Search, Filter } from 'lucide-react';
import { getAuditLogs } from '../api/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AuditLogsPage() {
    const [actionFilter, setActionFilter] = useState('');
    const [entityFilter, setEntityFilter] = useState('');
    const [usernameFilter, setUsernameFilter] = useState('');

    const { data: logs, isLoading } = useQuery({
        queryKey: ['audit-logs', actionFilter, entityFilter, usernameFilter],
        queryFn: () => getAuditLogs(100, 0, actionFilter, entityFilter, usernameFilter)
    });

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Shield className="w-8 h-8 text-indigo-600" style={{ color: 'var(--brand-color, #4f46e5)' }} />
                        Registro de Auditoría
                    </h1>
                    <p className="text-gray-500 mt-1">Historial inmutable de acciones críticas realizadas en el sistema.</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por usuario..."
                        value={usernameFilter}
                        onChange={(e) => setUsernameFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                <select
                    className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                >
                    <option value="">Todas las Acciones</option>
                    <option value="CREATE_USER">Creación de Empleado</option>
                    <option value="UPDATE_USER">Edición de Empleado</option>
                    <option value="DEACTIVATE_USER">Desactivación de Empleado</option>
                    <option value="CREATE_PRODUCT">Creación de Producto</option>
                    <option value="UPDATE">Edición de Producto</option>
                    <option value="DEACTIVATE_PRODUCT">Desactivación de Producto</option>
                </select>
            </div>

            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase">Fecha y Hora</th>
                                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase">Usuario</th>
                                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase">Acción</th>
                                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase">Entidad ID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-gray-500">Cargando registros...</td>
                                </tr>
                            ) : logs?.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-gray-500">No se encontraron registros de auditoría.</td>
                                </tr>
                            ) : (
                                logs?.map((log: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2 text-sm text-gray-900">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="font-semibold text-gray-900">{log.username}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                                                log.action.includes('CREATE') ? 'bg-green-50 text-green-700 border-green-200' :
                                                log.action.includes('DEACTIVATE') ? 'bg-red-50 text-red-700 border-red-200' :
                                                'bg-indigo-50 text-indigo-700 border-indigo-200'
                                            }`}>
                                                {log.action}
                                            </span>
                                            <span className="text-xs text-gray-500 ml-2">({log.entity})</span>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-gray-500 font-mono text-xs">
                                            {log.entity_id}
                                        </td>
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
