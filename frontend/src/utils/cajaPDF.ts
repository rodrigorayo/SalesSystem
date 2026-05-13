/**
 * cajaPDF.ts  v2.0
 * Generates a polished, audit-grade PDF report for a single caja session.
 * Uses jsPDF + jsPDF-autoTable (browser-only, no server round-trip).
 *
 * Fixes:
 *  - Dates are now rendered in Bolivia timezone (UTC-4), NOT UTC.
 *  - All totals include a visible formula so they can be reconciled.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CajaSesionResumen, ResumenCaja } from '../hooks/useCaja';

// ─── Bolivia-aware date formatter ────────────────────────────────────────────

/**
 * Converts an ISO-UTC string to Bolivia local time (UTC-4).
 * The backend stores dates WITHOUT timezone; we append 'Z' to force UTC parse,
 * then display in Bolivia locale.
 */
function fmtBO(
    isoStr: string | undefined | null,
    opts: Intl.DateTimeFormatOptions = {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
    },
): string {
    if (!isoStr) return '—';
    const utc = isoStr.endsWith('Z') ? isoStr : isoStr + 'Z';
    return new Date(utc).toLocaleString('es-BO', {
        timeZone: 'America/La_Paz',
        ...opts,
    });
}

function fmtTime(isoStr: string | undefined | null): string {
    return fmtBO(isoStr, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
    dark:    [15,  23,  42]  as [number, number, number],  // slate-900
    primary: [79,  70,  229] as [number, number, number],  // indigo-600
    green:   [22,  163,  74] as [number, number, number],
    sky:     [14,  165, 233] as [number, number, number],
    purple:  [168,  85, 247] as [number, number, number],
    amber:   [245, 158,  11] as [number, number, number],
    red:     [239,  68,  68] as [number, number, number],
    gray:    [107, 114, 128] as [number, number, number],
    light:   [248, 250, 252] as [number, number, number],
    white:   [255, 255, 255] as [number, number, number],
    border:  [226, 232, 240] as [number, number, number],
    success_bg: [240, 253, 244] as [number, number, number],
    error_bg:   [254, 242, 242] as [number, number, number],
};

function subtipoColor(subtipo: string): [number, number, number] {
    switch (subtipo) {
        case 'VENTA_EFECTIVO':  return C.green;
        case 'VENTA_QR':        return C.sky;
        case 'VENTA_TARJETA':   return C.purple;
        case 'CAMBIO':          return C.amber;
        case 'GASTO':           return C.red;
        case 'APERTURA':        return C.primary;
        default:                return C.gray;
    }
}

function subtipoLabel(subtipo: string): string {
    const m: Record<string, string> = {
        APERTURA:         'Apertura',
        VENTA_EFECTIVO:   'Efectivo',
        VENTA_QR:         'QR',
        VENTA_TARJETA:    'Tarjeta',
        CAMBIO:           'Cambio',
        GASTO:            'Gasto',
        AJUSTE:           'Ajuste',
        INGRESO_EFECTIVO: 'Ing. Ef.',
        INGRESO_QR:       'Ing. QR',
        INGRESO_TARJETA:  'Ing. Tj.',
    };
    return m[subtipo] ?? subtipo;
}

function fmtMoney(n: number | undefined | null): string {
    return `Bs. ${(n ?? 0).toFixed(2)}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function drawSectionTitle(doc: jsPDF, text: string, y: number, _W: number, margin: number): number {
    doc.setFillColor(...C.primary);
    doc.rect(margin, y, 3, 5, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text(text, margin + 6, y + 4.2);
    return y + 10;
}

function drawFormulaRow(
    doc: jsPDF,
    label: string,
    formula: string,
    value: number,
    y: number,
    margin: number,
    W: number,
    color: [number, number, number] = C.dark,
    bold = false,
): number {
    const ROW_H = 6.5;
    doc.setFontSize(8);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(label, margin + 2, y + 4);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.gray);
    doc.text(formula, margin + 55, y + 4);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...color);
    doc.text(fmtMoney(value), W - margin - 2, y + 4, { align: 'right' });

    return y + ROW_H;
}

function drawDivider(doc: jsPDF, y: number, margin: number, W: number): number {
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.line(margin, y, W - margin, y);
    return y + 2;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function generarPDFSesion(
    sesion: CajaSesionResumen,
    resumen: ResumenCaja,
): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W      = doc.internal.pageSize.getWidth();
    const margin = 14;
    let   y      = margin;

    // ── Pre-compute all figures ───────────────────────────────────────────────

    // Cash flow
    const efVentas     = resumen.total_efectivo_ventas ?? 0;
    const efIngresos   = resumen.total_ingresos_efectivo ?? 0;

    const cambio       = resumen.total_cambio ?? 0;
    const gastos       = resumen.total_gastos ?? 0;
    const ajustes      = resumen.total_ajustes ?? 0;
    const montoInicial = resumen.monto_inicial ?? sesion.monto_inicial ?? 0;
    const saldoCalc    = resumen.saldo_calculado ?? sesion.saldo_calculado ?? 0;
    const monto_entregar = Math.max(0, saldoCalc - montoInicial);

    // Digital
    const totalQR      = resumen.total_qr ?? sesion.total_qr ?? 0;
    const totalTarjeta = resumen.total_tarjeta ?? sesion.total_tarjeta ?? 0;

    // Grand total (all channels)
    const totalVentas  = resumen.total_ventas_general ?? sesion.total_ventas ?? 0;

    // Cierre físico
    const cierreFisico = sesion.monto_cierre_fisico;
    const diferencia   = sesion.diferencia;

    // Now
    const generadoEn = fmtBO(new Date().toISOString());

    // ── HEADER ────────────────────────────────────────────────────────────────
    doc.setFillColor(...C.dark);
    doc.rect(0, 0, W, 30, 'F');

    doc.setTextColor(...C.white);
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.text('Taboada System', margin, 11);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 174, 192);
    doc.text('Reporte de Arqueo de Caja', margin, 17);
    doc.text(`Generado: ${generadoEn}`, margin, 23);
    doc.text(`ID Sesión: ${sesion.id}`, margin, 28);

    // Status badge
    const isClosed = sesion.estado !== 'ABIERTA';
    const badgeColor: [number, number, number] = isClosed ? C.green : C.amber;
    const badgeLabel = isClosed ? '✓ CERRADA' : '● ABIERTA';
    doc.setFillColor(...badgeColor);
    doc.roundedRect(W - margin - 26, 8, 26, 9, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(badgeLabel, W - margin - 13, 13.5, { align: 'center' });

    y = 38;

    // ── SESIÓN INFO ───────────────────────────────────────────────────────────
    doc.setFillColor(...C.light);
    doc.roundedRect(margin, y, W - margin * 2, 24, 3, 3, 'F');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text(sesion.cajero_name, margin + 4, y + 8);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray);
    doc.text(`Apertura: ${fmtBO(sesion.abierta_at)}`, margin + 4, y + 14.5);
    doc.text(
        `Cierre:   ${sesion.cerrada_at ? fmtBO(sesion.cerrada_at) : 'Sesión aún abierta'}`,
        margin + 4, y + 20,
    );

    // Right: saldo
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.primary);
    doc.text(fmtMoney(saldoCalc), W - margin - 4, y + 14, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray);
    doc.text('Saldo calculado en caja', W - margin - 4, y + 20, { align: 'right' });

    y += 30;

    // ── SECCIÓN 1: FLUJO DE EFECTIVO FÍSICO ──────────────────────────────────
    y = drawSectionTitle(doc, '1. Flujo de Efectivo Físico (Cajón)', y, W, margin);

    const BOX_H_1 = 56;
    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.border);
    doc.roundedRect(margin, y, W - margin * 2, BOX_H_1, 3, 3, 'FD');
    y += 3;

    y = drawFormulaRow(doc, '(+) Fondo Fijo / Apertura', '— Efectivo con que arrancó la caja', montoInicial, y, margin, W, C.primary);
    y = drawFormulaRow(doc, '(+) Ventas en Efectivo', '— Pagos recibidos en billetes/monedas', efVentas, y, margin, W, C.green);
    if (efIngresos > 0) {
        y = drawFormulaRow(doc, '(+) Ingresos Manuales Efectivo', '— Depósitos adicionales registrados', efIngresos, y, margin, W, C.green);
    }
    y = drawDivider(doc, y, margin, W);
    y = drawFormulaRow(doc, '(-) Vuelto / Cambio entregado', '— Efectivo devuelto a clientes', -cambio, y, margin, W, C.red);
    y = drawFormulaRow(doc, '(-) Gastos de Caja', '— Egresos físicos registrados en el turno', -gastos, y, margin, W, C.red);
    if (ajustes !== 0) {
        y = drawFormulaRow(doc, '(±) Ajustes', '— Correcciones manuales autorizadas', ajustes, y, margin, W, C.amber);
    }
    y = drawDivider(doc, y, margin, W);
    y = drawFormulaRow(doc, '= Saldo Esperado en Cajón', 'Apertura + Ef. neto ventas − Cambio − Gastos', saldoCalc, y, margin, W, C.dark, true);
    y += 5;

    // ── SECCIÓN 2: CANALES DIGITALES ─────────────────────────────────────────
    y = drawSectionTitle(doc, '2. Cobros Digitales (van directo al banco, NO al cajón)', y, W, margin);

    const BOX_H_2 = 24;
    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.border);
    doc.roundedRect(margin, y, W - margin * 2, BOX_H_2, 3, 3, 'FD');
    y += 3;

    y = drawFormulaRow(doc, 'QR (Billetera digital)', '— Suma de pagos QR del período', totalQR, y, margin, W, C.sky);
    y = drawFormulaRow(doc, 'Tarjeta / POS',           '— Suma de pagos con tarjeta del período', totalTarjeta, y, margin, W, C.purple);
    y += 5;

    // ── SECCIÓN 3: RESUMEN FINANCIERO TOTAL ──────────────────────────────────
    y = drawSectionTitle(doc, '3. Resumen Total de Ventas (coincide con Reporte Diario)', y, W, margin);

    const BOX_H_3 = 32;
    doc.setFillColor(246, 248, 255);
    doc.setDrawColor(...C.primary);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, W - margin * 2, BOX_H_3, 3, 3, 'FD');
    doc.setLineWidth(0.2);
    y += 3;

    y = drawFormulaRow(doc, 'Total Efectivo Neto Vendido',  '= Ventas ef. − Vuelto + Ing. manuales', efVentas - cambio + efIngresos, y, margin, W, C.green);
    y = drawFormulaRow(doc, 'Total QR',                      '= Suma pagos QR período', totalQR, y, margin, W, C.sky);
    y = drawFormulaRow(doc, 'Total Tarjeta',                 '= Suma pagos tarjeta período', totalTarjeta, y, margin, W, C.purple);
    y = drawDivider(doc, y, margin, W);
    y = drawFormulaRow(doc, '= TOTAL VENTAS BRUTAS', '= Efectivo neto + QR + Tarjeta', totalVentas, y, margin, W, C.primary, true);
    y += 5;

    // ── SECCIÓN 4: CIERRE FÍSICO (si aplica) ─────────────────────────────────
    if (cierreFisico != null) {
        y = drawSectionTitle(doc, '4. Verificación Física del Cajón', y, W, margin);

        const BOX_H_4 = 26;
        const difOk   = (diferencia ?? 0) >= 0;
        doc.setFillColor(...(difOk ? C.success_bg : C.error_bg));
        doc.setDrawColor(...(difOk ? C.green : C.red));
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, y, W - margin * 2, BOX_H_4, 3, 3, 'FD');
        doc.setLineWidth(0.2);
        y += 3;

        y = drawFormulaRow(doc, 'Saldo Calculado (Sistema)',    '= Fondo + Ventas − Cambio − Gastos', saldoCalc, y, margin, W);
        y = drawFormulaRow(doc, 'Conteo Físico (Cajero)',       '— Billetes y monedas contadas al cierre', cierreFisico, y, margin, W);
        y = drawDivider(doc, y, margin, W);
        const difLabel = (diferencia ?? 0) >= 0 ? '= SOBRANTE' : '= FALTANTE';
        y = drawFormulaRow(doc, difLabel, '= Conteo físico − Saldo calculado', diferencia ?? 0, y, margin, W, difOk ? C.green : C.red, true);
        if (sesion.notas_cierre) {
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...C.gray);
            doc.text(`Notas: "${sesion.notas_cierre}"`, margin + 3, y + 3);
            y += 6;
        }
        y += 5;
    }

    // ── SECCIÓN 5: DESGLOSE DE ENTREGA ───────────────────────────────────────
    y = drawSectionTitle(doc, cierreFisico != null ? '5. Efectivo a Entregar' : '4. Efectivo a Entregar', y, W, margin);

    const BOX_H_5 = 18;
    doc.setFillColor(...C.light);
    doc.setDrawColor(...C.border);
    doc.roundedRect(margin, y, W - margin * 2, BOX_H_5, 3, 3, 'FD');
    y += 3;

    y = drawFormulaRow(doc, 'Fondo Fijo (queda en caja)',  '— Se repone para el siguiente turno', montoInicial, y, margin, W);
    y = drawFormulaRow(doc, 'Monto a Entregar a Administración', '= Saldo calculado − Fondo fijo', monto_entregar, y, margin, W, C.primary, true);
    y += 8;

    // ── SECCIÓN 6: BITÁCORA DE MOVIMIENTOS ───────────────────────────────────
    const secN = cierreFisico != null ? '6' : '5';
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text(`${secN}. Bitácora de Movimientos (${resumen.movimientos.length})`, margin, y);
    y += 5;

    const movRows = resumen.movimientos.map(m => [
        fmtTime(m.fecha),
        subtipoLabel(m.subtipo),
        m.tipo,
        m.descripcion ?? '—',
        m.cajero_name ?? '—',
        `${m.tipo === 'INGRESO' ? '+' : '-'}${Number(m.monto).toFixed(2)}`,
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Hora (BO)', 'Método', 'Flujo', 'Descripción', 'Cajero', 'Monto (Bs.)']],
        body: movRows,
        margin: { left: margin, right: margin },
        styles: {
            fontSize: 7.5,
            cellPadding: 2.5,
            lineColor: C.border,
            lineWidth: 0.2,
        },
        headStyles: {
            fillColor: C.dark,
            textColor: C.white,
            fontStyle: 'bold',
            fontSize: 7.5,
        },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 22 },
            2: { cellWidth: 14 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 26 },
            5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell(data) {
            if (data.section === 'body') {
                const row = resumen.movimientos[data.row.index];
                if (!row) return;
                if (data.column.index === 1) {
                    const [r, g, b] = subtipoColor(row.subtipo);
                    data.cell.styles.textColor = [r, g, b];
                    data.cell.styles.fontStyle = 'bold';
                }
                if (data.column.index === 5) {
                    data.cell.styles.textColor = row.tipo === 'EGRESO' ? C.red
                        : row.subtipo === 'VENTA_QR'      ? C.sky
                        : row.subtipo === 'VENTA_TARJETA'  ? C.purple
                        : C.green;
                }
                if (row.subtipo === 'VENTA_QR' || row.subtipo === 'VENTA_TARJETA') {
                    data.cell.styles.fillColor = [240, 245, 255];
                }
            }
        },
        alternateRowStyles: { fillColor: C.light },
    });

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } })
        .internal.getNumberOfPages();

    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        const pageH = doc.internal.pageSize.getHeight();
        doc.setDrawColor(...C.border);
        doc.line(margin, pageH - 14, W - margin, pageH - 14);

        doc.setFontSize(7);
        doc.setTextColor(...C.gray);
        doc.setFont('helvetica', 'normal');
        doc.text('Taboada System — Documento de uso interno. Horas en hora Bolivia (UTC-4).', margin, pageH - 8);
        doc.text(`Página ${p} de ${totalPages}`, W - margin, pageH - 8, { align: 'right' });

        // Stamp on every page
        doc.setFontSize(6.5);
        doc.text(`Generado: ${generadoEn}`, margin, pageH - 4);
    }

    // ── SAVE ─────────────────────────────────────────────────────────────────
    const dateStr = fmtBO(sesion.abierta_at, { year: 'numeric', month: '2-digit', day: '2-digit' })
        .replace(/\//g, '-');
    doc.save(`caja_${sesion.cajero_name.replace(/\s+/g, '_')}_${dateStr}.pdf`);
}
