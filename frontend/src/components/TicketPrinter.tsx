import type { Sale } from '../api/types';
import { formatFullDate } from '../utils/dateUtils';


interface TicketPrinterProps {
    sale: Sale;
    tenantName?: string;
}

export const TicketPrinter: React.FC<TicketPrinterProps> = ({ sale, tenantName = 'Nuestra Empresa' }) => {
    // Format currency
    const fmt = (n: number) => {
        return new Intl.NumberFormat('es-BO', { style: 'decimal', minimumFractionDigits: 2 }).format(n);
    };



    const c = sale.cliente;
    const isFactura = c?.es_factura;

    return (
        <div className="print-only" style={{ width: '80mm', margin: '0 auto', fontSize: '12px', fontFamily: 'monospace', color: '#000', padding: '10px' }}>
            {sale.anulada && (
                <div className="watermark-anulada">ANULADA</div>
            )}
            
            {/* Cabecera */}
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <h2 style={{ fontSize: '16px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>{tenantName}</h2>
                <h3 style={{ fontSize: '13px', margin: '0 0 5px 0', fontWeight: 'bold' }}>
                    {isFactura ? 'SOLICITUD DE FACTURA' : 'RECIBO DE VENTA'}
                </h3>
                {sale.sucursal_id && sale.sucursal_id !== 'CENTRAL' && (
                    <p style={{ margin: '2px 0', fontSize: '10px' }}>Sucursal: {sale.sucursal_id}</p>
                )}
                <p style={{ margin: '2px 0', fontSize: '10px' }}>Fecha: {formatFullDate(sale.created_at || new Date().toISOString())}</p>

                <p style={{ margin: '2px 0', fontSize: '10px' }}>Ticket Nº: {sale._id ? sale._id.slice(-6).toUpperCase() : 'PENDIENTE'}</p>
            </div>

            {/* Datos del Cliente (si los hay) */}
            {(c?.razon_social || c?.nit || c?.email || c?.telefono) && (
                <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '5px 0', marginBottom: '10px', fontSize: '11px' }}>
                    {c.razon_social && <p style={{ margin: '2px 0' }}>Señor(es): {c.razon_social}</p>}
                    {c.nit && <p style={{ margin: '2px 0' }}>NIT/CI: {c.nit}</p>}
                    {c.telefono && <p style={{ margin: '2px 0' }}>Celular: {c.telefono}</p>}
                    {c.email && <p style={{ margin: '2px 0' }}>Email: {c.email}</p>}
                </div>
            )}

            {/* Items */}
            <div style={{ marginBottom: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #000' }}>
                            <th style={{ textAlign: 'left', paddingBottom: '3px' }}>Cant</th>
                            <th style={{ textAlign: 'left', paddingBottom: '3px' }}>Desc</th>
                            <th style={{ textAlign: 'right', paddingBottom: '3px' }}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.items.map((item, idx) => (
                            <tr key={idx}>
                                <td style={{ verticalAlign: 'top', paddingTop: '3px' }}>{item.cantidad}</td>
                                <td style={{ verticalAlign: 'top', paddingTop: '3px', paddingRight: '5px' }}>
                                    {item.descripcion}
                                    <div style={{ fontSize: '9px', color: '#444' }}>{fmt(item.precio_unitario)} c/u</div>
                                </td>
                                <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: '3px' }}>
                                    {fmt(item.subtotal)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Descuentos (si hay) */}
            {sale.descuento && sale.descuento.valor > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                    <span>Subtotal:</span>
                    <span>{fmt(sale.total + (sale.items.reduce((acc, i) => acc + i.subtotal, 0) - sale.total))}</span>
                </div>
            )}
            
            {sale.descuento && sale.descuento.valor > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px' }}>
                    <span>Desc. {sale.descuento.tipo === 'PORCENTAJE' ? `(${sale.descuento.valor}%)` : `(Bs.${sale.descuento.valor})`}:</span>
                    <span>- {fmt(sale.items.reduce((acc, i) => acc + i.subtotal, 0) - sale.total)}</span>
                </div>
            )}

            <div style={{ borderTop: '1px dashed #000', paddingTop: '5px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
                <span>TOTAL BS:</span>
                <span>{fmt(sale.total)}</span>
            </div>

            {/* Pagos */}
            <div style={{ marginBottom: '15px', fontSize: '11px' }}>
                {sale.pagos.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                        <span>PAGO {p.metodo}:</span>
                        <span>{fmt(p.monto)}</span>
                    </div>
                ))}
                
                {(() => {
                    const totalPagado = sale.pagos.reduce((sum, p) => sum + p.monto, 0);
                    const cambio = totalPagado - sale.total;
                    if (cambio > 0.01) {
                        return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontWeight: 'bold' }}>
                                <span>CAMBIO:</span>
                                <span>{fmt(cambio)}</span>
                            </div>
                        )
                    }
                    return null;
                })()}
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '15px' }}>
                <p style={{ margin: '2px 0' }}>Cajero: {sale.cashier_name || 'Caja'}</p>
                <p style={{ margin: '4px 0', fontWeight: 'bold' }}>¡Gracias por su compra!</p>
                {isFactura && (
                    <p style={{ margin: '10px 0 0 0', fontStyle: 'italic', fontSize: '9px' }}>
                        Nota: Esta es una representación del documento. El documento oficial será emitido por los medios correspondientes.
                    </p>
                )}
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
