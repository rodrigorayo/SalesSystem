import type { Sale } from '../api/types';
import { formatFullDate } from '../utils/dateUtils';


interface TicketPrinterProps {
    sale: Sale;
    tenantName?: string;
    sucursalName?: string;
}

export const TicketPrinter: React.FC<TicketPrinterProps> = ({ sale, tenantName = 'TABOADA', sucursalName }) => {
    // Format currency
    const fmt = (n: number) => {
        return new Intl.NumberFormat('es-BO', { style: 'decimal', minimumFractionDigits: 2 }).format(n);
    };



    const c = sale.cliente;

    return (
        <div className="print-only" style={{ width: '80mm', margin: '0 auto', fontSize: '11px', fontFamily: 'monospace', color: '#000', padding: '5px' }}>
            {sale.anulada && (
                <div className="watermark-anulada">ANULADA</div>
            )}
            
            {/* Cabecera */}
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <h2 style={{ fontSize: '18px', margin: '0 0 2px 0', fontWeight: '900', letterSpacing: '1px' }}>{tenantName === sale.tenant_id ? 'TABOADA' : tenantName}</h2>
                <div style={{ borderTop: '2px solid #000', width: '60%', margin: '2px auto 8px auto' }}></div>
                
                <h3 style={{ fontSize: '14px', margin: '0 0 8px 0', fontWeight: 'bold', border: '1px solid #000', padding: '4px', display: 'inline-block' }}>
                    NOTA DE ENTREGA
                </h3>

                <div style={{ textAlign: 'left', marginTop: '10px', lineHeight: '1.4' }}>
                    <p style={{ margin: '0', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 'bold' }}>Sucursal:</span> 
                        <span>{sucursalName || 'Matriz'}</span>
                    </p>
                    <p style={{ margin: '0', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 'bold' }}>Fecha:</span> 
                        <span>{formatFullDate(sale.created_at || new Date().toISOString())}</span>
                    </p>
                    <p style={{ margin: '0', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 'bold' }}>Ticket Nº:</span> 
                        <span>#{sale._id ? sale._id.slice(-6).toUpperCase() : 'PENDIENTE'}</span>
                    </p>
                </div>
            </div>

            {/* Datos del Cliente (si los hay) */}
            {(c?.razon_social || c?.nit || c?.email || c?.telefono) && (
                <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0', marginBottom: '10px', fontSize: '10px' }}>
                    {c.razon_social && <p style={{ margin: '1px 0' }}><b>Cliente:</b> {c.razon_social}</p>}
                    {c.nit && <p style={{ margin: '1px 0' }}><b>NIT/CI:</b> {c.nit}</p>}
                    {c.telefono && <p style={{ margin: '1px 0' }}><b>Celular:</b> {c.telefono}</p>}
                </div>
            )}

            {/* Items */}
            <div style={{ marginBottom: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #000' }}>
                            <th style={{ textAlign: 'left', padding: '4px 0', width: '25px' }}>Cant</th>
                            <th style={{ textAlign: 'left', padding: '4px 0' }}>Detalle</th>
                            <th style={{ textAlign: 'right', padding: '4px 0', width: '60px' }}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.items.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ verticalAlign: 'top', padding: '5px 0' }}>{item.cantidad}</td>
                                <td style={{ verticalAlign: 'top', padding: '5px 0' }}>
                                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{item.descripcion}</div>
                                    <div style={{ fontSize: '9px', color: '#666' }}>{fmt(item.precio_unitario)} x un.</div>
                                </td>
                                <td style={{ textAlign: 'right', verticalAlign: 'top', padding: '5px 0', fontWeight: 'bold' }}>
                                    {fmt(item.subtotal)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totales */}
            <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>
                {sale.descuento && sale.descuento.valor > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                        <span>SUBTOTAL BS:</span>
                        <span>{fmt(sale.total + (sale.items.reduce((acc, i) => acc + i.subtotal, 0) - sale.total))}</span>
                    </div>
                )}
                
                {sale.descuento && sale.descuento.valor > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px', color: '#444' }}>
                        <span>DESCUENTO:</span>
                        <span>-{fmt(sale.items.reduce((acc, i) => acc + i.subtotal, 0) - sale.total)}</span>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '15px', padding: '4px 0', borderBottom: '2px solid #000', marginBottom: '8px' }}>
                    <span>TOTAL BS:</span>
                    <span>{fmt(sale.total)}</span>
                </div>
            </div>

            {/* Pagos */}
            <div style={{ marginBottom: '10px', fontSize: '10px' }}>
                {sale.pagos.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                        <span style={{ textTransform: 'uppercase' }}>PAGO {p.metodo}:</span>
                        <span style={{ fontWeight: 'bold' }}>{fmt(p.monto)}</span>
                    </div>
                ))}
                
                {(() => {
                    const totalPagado = sale.pagos.reduce((sum, p) => sum + p.monto, 0);
                    const cambio = totalPagado - sale.total;
                    if (cambio > 0.01) {
                        return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', borderTop: '1px dashed #ccc', paddingTop: '2px' }}>
                                <span style={{ fontWeight: 'bold' }}>CAMBIO BS:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{fmt(cambio)}</span>
                            </div>
                        )
                    }
                    return null;
                })()}
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                <p style={{ margin: '2px 0' }}><b>Atendido por:</b> {sale.cashier_name || 'Caja'}</p>
                {sale.vendedor_name && (
                    <p style={{ margin: '2px 0' }}><b>Vendedor:</b> {sale.vendedor_name}</p>
                )}
                <p style={{ margin: '8px 0', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>¡Gracias por preferir Taboada!</p>
                
                <p style={{ margin: '10px 0 0 0', fontStyle: 'italic', fontSize: '8px', opacity: 0.7 }}>
                    Este documento no es una factura comercial.
                </p>
            </div>

            {/* Estilos CSS para Ocultar todo lo demás al imprimir */}
            <style>
                {`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .print-only, .print-only * {
                            visibility: visible;
                        }
                        .print-only {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 80mm;
                            margin: 0;
                            padding: 0;
                        }
                        .watermark-anulada {
                            position: absolute !important;
                            top: 50% !important;
                            left: 50% !important;
                            transform: translate(-50%, -50%) rotate(-45deg) !important;
                            font-size: 3rem !important;
                            font-weight: 900 !important;
                            color: transparent !important;
                            -webkit-text-stroke: 2px #000 !important;
                            z-index: 9999 !important;
                            pointer-events: none !important;
                            white-space: nowrap !important;
                            text-transform: uppercase !important;
                            opacity: 0.6 !important;
                        }
                    }
                    @media screen {
                        .print-only {
                            display: none; /* solo se muestra temporalmente si quisiéramos renderizarlo oculto siempre */
                        }
                    }
                `}
            </style>
        </div>
    );
};
