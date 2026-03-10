/**
 * cajaPDF.ts
 * Generates a polished PDF report for a single caja session.
 * Uses jsPDF + jsPDF-autoTable (browser-only, no server round-trip).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CajaSesionResumen, ResumenCaja } from '../hooks/useCaja';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
    dark: [15, 23, 42] as [number, number, number],   // slate-900
    primary: [79, 70, 229] as [number, number, number],   // indigo-600
    green: [22, 163, 74] as [number, number, number],
    sky: [14, 165, 233] as [number, number, number],
    purple: [168, 85, 247] as [number, number, number],
    amber: [245, 158, 11] as [number, number, number],
    red: [239, 68, 68] as [number, number, number],
    gray: [107, 114, 128] as [number, number, number],
    light: [248, 250, 252] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
};

// Cell color per subtipo
function subtipoColor(subtipo: string): [number, number, number] {
    switch (subtipo) {
        case 'VENTA_EFECTIVO': return C.green;
        case 'VENTA_QR': return C.sky;
        case 'VENTA_TARJETA': return C.purple;
        case 'CAMBIO': return C.amber;
        case 'GASTO': return C.red;
        case 'APERTURA': return C.primary;
        default: return C.gray;
    }
}

function subtipoLabel(subtipo: string): string {
    const m: Record<string, string> = {
        APERTURA: 'Apertura',
        VENTA_EFECTIVO: 'Efectivo',
        VENTA_QR: 'QR',
        VENTA_TARJETA: 'Tarjeta',
        CAMBIO: 'Cambio',
        GASTO: 'Gasto',
        AJUSTE: 'Ajuste',
    };
    return m[subtipo] ?? subtipo;
}

function fmtMoney(n: number) { return `Bs. ${n.toFixed(2)}`; }
function fmtDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-BO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function generarPDFSesion(
    sesion: CajaSesionResumen,
    resumen: ResumenCaja,
): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = margin;

    // ── Header bar ────────────────────────────────────────────────────────────
    doc.setFillColor(...C.dark);
    doc.rect(0, 0, W, 28, 'F');

    doc.setTextColor(...C.white);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Taboada System — Reporte de Caja', margin, 11);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 174, 192);
    doc.text(`Generado: ${fmtDate(new Date().toISOString())}`, margin, 18);
    doc.text(`Sesión ID: ${sesion.id}`, margin, 23);

    doc.setFontSize(9);
    const statusLabel = sesion.estado === 'ABIERTA' ? 'ABIERTA' : 'CERRADA';
    doc.setTextColor(...C.white);
    doc.text(statusLabel, W - margin, 11, { align: 'right' });

    y = 36;

    // ── Session info block ────────────────────────────────────────────────────
    doc.setFillColor(...C.light);
    doc.roundedRect(margin, y, W - margin * 2, 28, 3, 3, 'F');

    doc.setTextColor(...C.dark);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(sesion.cajero_name, margin + 4, y + 7);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray);
    doc.text(`Apertura: ${fmtDate(sesion.abierta_at)}`, margin + 4, y + 14);
    doc.text(`Cierre:   ${fmtDate(sesion.cerrada_at)}`, margin + 4, y + 20);

    // right side: saldo
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.primary);
    doc.text(fmtMoney(sesion.saldo_calculado), W - margin - 4, y + 13, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray);
    doc.text('Saldo calculado en caja', W - margin - 4, y + 19, { align: 'right' });

    y += 34;

    // ── KPI grid (6 cards in 2 rows × 3) ─────────────────────────────────────
    const kpis = [
        { label: 'Monto inicial', value: fmtMoney(sesion.monto_inicial), color: C.primary },
        { label: 'Ef. recibido', value: fmtMoney(sesion.total_efectivo), color: C.green },
        { label: 'Cambio dado', value: fmtMoney(sesion.total_cambio), color: C.amber },
        { label: 'QR', value: fmtMoney(sesion.total_qr), color: C.sky },
        { label: 'Tarjeta', value: fmtMoney(sesion.total_tarjeta), color: C.purple },
        { label: 'Gastos', value: fmtMoney(sesion.total_gastos), color: C.red },
        { label: 'Total ventas', value: fmtMoney(sesion.total_ventas), color: C.dark },
        { label: 'Transacciones', value: String(sesion.num_transacciones), color: C.gray },
        { label: 'Ef. neto (caja)', value: fmtMoney(sesion.total_efectivo - sesion.total_cambio), color: C.green },
    ];

    const cols = 3;
    const cardW = (W - margin * 2 - 4 * (cols - 1)) / cols;
    const cardH = 16;
    const gapX = 4, gapY = 4;

    kpis.forEach((k, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = margin + col * (cardW + gapX);
        const cy = y + row * (cardH + gapY);

        doc.setFillColor(...C.white);
        doc.setDrawColor(...C.border);
        doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'FD');

        // accent left bar
        doc.setFillColor(...k.color);
        doc.rect(cx, cy, 2.5, cardH, 'F');

        doc.setFontSize(7);
        doc.setTextColor(...C.gray);
        doc.setFont('helvetica', 'normal');
        doc.text(k.label, cx + 5, cy + 5.5);

        doc.setFontSize(10);
        doc.setTextColor(...C.dark);
        doc.setFont('helvetica', 'bold');
        doc.text(k.value, cx + 5, cy + 12);
    });

    y += Math.ceil(kpis.length / cols) * (cardH + gapY) + 6;

    // ── Closing info (if closed) ───────────────────────────────────────────────
    if (sesion.monto_cierre_fisico != null) {
        doc.setFillColor(...C.light);
        doc.roundedRect(margin, y, W - margin * 2, 22, 3, 3, 'F');

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.dark);
        doc.text('Cierre de caja', margin + 4, y + 6);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.gray);
        doc.text(`Conteo físico: ${fmtMoney(sesion.monto_cierre_fisico)}`, margin + 4, y + 13);

        if (sesion.diferencia != null) {
            const difColor = sesion.diferencia >= 0 ? C.green : C.red;
            const difLabel = sesion.diferencia >= 0
                ? `+${fmtMoney(sesion.diferencia)} (sobrante)`
                : `${fmtMoney(sesion.diferencia)} (faltante)`;
            doc.text('Diferencia:', margin + 60, y + 13);
            doc.setTextColor(...difColor);
            doc.setFont('helvetica', 'bold');
            doc.text(difLabel, margin + 84, y + 13);
        }

        if (sesion.notas_cierre) {
            doc.setTextColor(...C.gray);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.5);
            doc.text(`Notas: "${sesion.notas_cierre}"`, margin + 4, y + 19);
        }

        y += 28;
    }

    // ── Movements table ────────────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text(`Movimientos de la sesión (${resumen.movimientos.length})`, margin, y + 6);
    y += 10;

    const movRows = resumen.movimientos.map(m => [
        new Date(m.fecha).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        subtipoLabel(m.subtipo),
        m.tipo,
        m.descripcion,
        m.cajero_name,
        `${m.tipo === 'INGRESO' ? '+' : '-'}${Number(m.monto).toFixed(2)}`,
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Hora', 'Método', 'Flujo', 'Descripción', 'Cajero', 'Monto (Bs.)']],
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
            0: { cellWidth: 22 },
            1: { cellWidth: 22 },
            2: { cellWidth: 16 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 28 },
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
                        : row.subtipo === 'VENTA_QR' ? C.sky
                            : row.subtipo === 'VENTA_TARJETA' ? C.purple
                                : C.green;
                }
                if (row.subtipo === 'VENTA_QR' || row.subtipo === 'VENTA_TARJETA') {
                    data.cell.styles.fillColor = [240, 245, 255];
                }
            }
        },
        alternateRowStyles: { fillColor: C.light },
    });

    // ── Footer on each page ────────────────────────────────────────────────────
    const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } })
        .internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        const pageH = doc.internal.pageSize.getHeight();
        doc.setDrawColor(...C.border);
        doc.line(margin, pageH - 12, W - margin, pageH - 12);
        doc.setFontSize(7);
        doc.setTextColor(...C.gray);
        doc.setFont('helvetica', 'normal');
        doc.text('Taboada System — Documento de uso interno', margin, pageH - 7);
        doc.text(`Página ${p} de ${totalPages}`, W - margin, pageH - 7, { align: 'right' });
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    const dateStr = new Date(sesion.abierta_at).toISOString().slice(0, 10);
    doc.save(`caja_${sesion.cajero_name.replace(/\s+/g, '_')}_${dateStr}.pdf`);
}
