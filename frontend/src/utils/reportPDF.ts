/**
 * reportPDF.ts
 * Centralised PDF export for ALL report views.
 * Uses jsPDF + jsPDF-autoTable.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
    dark:    [15,  23,  42]  as [number,number,number],
    primary: [79,  70, 229]  as [number,number,number],
    green:   [22, 163,  74]  as [number,number,number],
    amber:   [245,158,  11]  as [number,number,number],
    red:     [239, 68,  68]  as [number,number,number],
    gray:    [107,114, 128]  as [number,number,number],
    sky:     [14, 165, 233]  as [number,number,number],
    light:   [248,250, 252]  as [number,number,number],
    white:   [255,255, 255]  as [number,number,number],
};

const bs = (n: number) =>
    `Bs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function nowBO(): string {
    return new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' });
}

/** Draws the standard header band and returns the Y position after it */
function drawHeader(doc: jsPDF, title: string, subtitle: string): number {
    const pw = doc.internal.pageSize.getWidth();

    // Dark band
    doc.setFillColor(...C.dark);
    doc.roundedRect(0, 0, pw, 32, 0, 0, 'F');

    // Accent bar
    doc.setFillColor(...C.primary);
    doc.rect(0, 0, 6, 32, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...C.white);
    doc.text(title, 14, 13);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(180, 190, 210);
    doc.text(subtitle, 14, 22);

    // Generation timestamp
    doc.setFontSize(8);
    doc.setTextColor(140, 150, 170);
    doc.text(`Generado: ${nowBO()}`, pw - 14, 22, { align: 'right' });

    return 38;
}

/** Draws a KPI card */
function drawKPI(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, color: [number,number,number] = C.primary) {
    doc.setFillColor(...C.light);
    doc.roundedRect(x, y, w, 20, 3, 3, 'F');
    doc.setFillColor(...color);
    doc.roundedRect(x, y, 3, 20, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.text(label.toUpperCase(), x + 6, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.dark);
    doc.text(value, x + 6, y + 16);
}

/** Footer on every page */
function addFooters(doc: jsPDF) {
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setDrawColor(220, 220, 230);
        doc.line(10, ph - 12, pw - 10, ph - 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...C.gray);
        doc.text('Sistema Taboada  •  Confidencial', 14, ph - 6);
        doc.text(`Pág. ${i} / ${pages}`, pw - 14, ph - 6, { align: 'right' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. REPORTE DE JORNADA DIARIA
// ═══════════════════════════════════════════════════════════════════════════════

export function descargarPDFJornada(report: any, fecha: string, sucursalNombre: string) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    let y = drawHeader(doc, 'Reporte de Jornada Diaria', `${sucursalNombre}  •  ${fecha}`);

    // KPIs
    const { resumen_ventas, gastos, balance_neto } = report;
    const kpiW = (pw - 28) / 4;
    drawKPI(doc, 10, y, kpiW - 2, 'Ventas Brutas', bs(resumen_ventas.total_bruto), C.primary);
    drawKPI(doc, 10 + kpiW, y, kpiW - 2, 'Efectivo', bs(resumen_ventas.por_metodo?.EFECTIVO || 0), C.green);
    drawKPI(doc, 10 + kpiW * 2, y, kpiW - 2, 'Gastos', bs(gastos.total), C.amber);
    drawKPI(doc, 10 + kpiW * 3, y, kpiW - 2, 'Balance Neto', bs(balance_neto), C.dark);
    y += 26;

    // Métodos de pago
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.text('Desglose por Método de Pago', 10, y);
    y += 4;

    const metodos = Object.entries(resumen_ventas.por_metodo || {}) as [string, number][];
    const bodyRows = [
        ...metodos.map(([m, v]) => [m, bs(v)]),
        ['Vueltos Entregados (Cambio)', bs(resumen_ventas.total_cambio || 0)],
        ['Anuladas', `${bs(resumen_ventas.anuladas?.monto || 0)} (${resumen_ventas.anuladas?.cantidad || 0})`],
    ];
    if (resumen_ventas.total_creditos && resumen_ventas.total_creditos > 0) {
        bodyRows.push(['Créditos Otorgados (no afecta efectivo)', bs(resumen_ventas.total_creditos)]);
    }

    autoTable(doc, {
        startY: y,
        head: [['Método', 'Monto (Bs.)']],
        body: bodyRows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Gastos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.text('Detalle de Gastos', 10, y);
    y += 4;

    autoTable(doc, {
        startY: y,
        head: [['Descripción', 'Cajero', 'Hora', 'Monto (Bs.)']],
        body: gastos.detalle?.length
            ? gastos.detalle.map((g: any) => [g.descripcion, g.cajero, g.hora, bs(g.monto)])
            : [['Sin gastos registrados', '', '', '']],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: C.amber, textColor: C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Artículos vendidos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.text('Artículos Vendidos', 10, y);
    y += 4;

    autoTable(doc, {
        startY: y,
        head: [['Producto', 'Cantidad', 'Total (Bs.)']],
        body: report.items_vendidos?.length
            ? report.items_vendidos.map((it: any) => [it.producto, it.cantidad, bs(it.total)])
            : [['Sin artículos', '', '']],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 10, right: 10 },
    });

    addFooters(doc);
    doc.save(`Jornada_${sucursalNombre}_${fecha}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. VENTAS POR HORA
// ═══════════════════════════════════════════════════════════════════════════════

export function descargarPDFHoras(data: any[], fecha: string, sucursalNombre: string, totalVentas: number, picoHora: any) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    let y = drawHeader(doc, 'Ventas por Hora', `${sucursalNombre}  •  ${fecha}`);

    // KPIs
    const kpiW = (pw - 28) / 2;
    drawKPI(doc, 10, y, kpiW - 2, 'Total del Día', bs(totalVentas), C.primary);
    drawKPI(doc, 10 + kpiW, y, kpiW - 2, 'Hora Pico', picoHora?.hour || '—', C.amber);
    y += 26;

    autoTable(doc, {
        startY: y,
        head: [['Hora', 'Transacciones', 'Total (Bs.)']],
        body: data.map((h: any) => [h.hour, h.cantidad_ventas, bs(h.total_ventas)]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: {
            1: { halign: 'center' },
            2: { halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (hookData: any) => {
            if (hookData.section === 'body' && picoHora && hookData.row.raw[0] === picoHora.hour) {
                hookData.cell.styles.fillColor = [255, 251, 235];
                hookData.cell.styles.textColor = [120, 50, 0];
                hookData.cell.styles.fontStyle = 'bold';
            }
        },
        margin: { left: 10, right: 10 },
    });

    addFooters(doc);
    doc.save(`Ventas_por_Hora_${sucursalNombre}_${fecha}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DESEMPEÑO DE STAFF
// ═══════════════════════════════════════════════════════════════════════════════

export function descargarPDFStaff(data: any, periodo: string, sucursalNombre: string) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    let y = drawHeader(doc, 'Desempeño de Personal', `${sucursalNombre}  •  ${periodo}`);

    // Cajeros
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.text('Rendimiento por Cajero', 10, y);
    y += 4;

    autoTable(doc, {
        startY: y,
        head: [['Cajero', 'Ventas', 'Total (Bs.)']],
        body: data?.cajeros?.length
            ? data.cajeros.map((c: any) => [c.nombre, c.cantidad_ventas, bs(c.total_ventas)])
            : [['Sin datos', '', '']],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: C.green, textColor: C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Vendedores
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.text('Rendimiento por Vendedor', 10, y);
    y += 4;

    autoTable(doc, {
        startY: y,
        head: [['Vendedor', 'Ventas', 'Total (Bs.)']],
        body: data?.vendedores?.length
            ? data.vendedores.map((v: any) => [v.nombre, v.cantidad_ventas, bs(v.total_ventas)])
            : [['Sin datos', '', '']],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 10, right: 10 },
    });

    addFooters(doc);
    doc.save(`Desempeño_Personal_${periodo}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. MATRIZ DE VENTAS (por producto / por día)
// ═══════════════════════════════════════════════════════════════════════════════

export function descargarPDFMatriz(data: any, dateList: string[], startDate: string, endDate: string, sucursalNombre: string) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    let y = drawHeader(doc, 'Matriz de Ventas por Día', `${sucursalNombre}  •  ${startDate} al ${endDate}`);

    const shortDates = dateList.map(d => {
        const p = d.split('-');
        return `${p[2]}/${p[1]}`;
    });

    const head = [['Producto', ...shortDates, 'Total']];
    const body = (data?.products || []).map((p: any) => {
        let total = 0;
        const dayCells = dateList.map(d => {
            const qty = p.days[d] || 0;
            total += qty;
            return qty > 0 ? qty.toString() : '-';
        });
        return [p.descripcion, ...dayCells, total.toString()];
    });

    autoTable(doc, {
        startY: y,
        head,
        body,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: 'bold', halign: 'center' },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: {
            0: { cellWidth: 50, fontStyle: 'bold' },
            [dateList.length + 1]: { fillColor: [238, 242, 255], textColor: C.primary, fontStyle: 'bold', halign: 'center' },
        },
        margin: { left: 10, right: 10 },
    });

    addFooters(doc);
    doc.save(`Matriz_Ventas_${startDate}_${endDate}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. INVENTARIO VALORADO
// ═══════════════════════════════════════════════════════════════════════════════

export function descargarPDFInventario(valuatedData: any, fecha: string) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    let y = drawHeader(doc, 'Inventario Valorado', fecha ? `Al ${fecha}` : 'Stock actual');

    // KPIs
    const { total_general_fabrica, total_general_publico, ganancia_potencial } = valuatedData;
    const kpiW = (pw - 28) / 3;
    drawKPI(doc, 10, y, kpiW - 2, 'Valor al Costo (Fábrica)', bs(total_general_fabrica), C.primary);
    drawKPI(doc, 10 + kpiW, y, kpiW - 2, 'Valor de Venta (Público)', bs(total_general_publico), C.green);
    drawKPI(doc, 10 + kpiW * 2, y, kpiW - 2, 'Ganancia Potencial', bs(ganancia_potencial), C.amber);
    y += 26;

    // Por sucursal
    for (const suc of (valuatedData.por_sucursal || [])) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...C.primary);
        doc.text(`Sucursal: ${suc.nombre}`, 10, y);
        y += 4;

        autoTable(doc, {
            startY: y,
            head: [['Producto', 'Categoría', 'Stock', 'Costo Unit.', 'Precio Pub.', 'Total Costo', 'Total Público']],
            body: (suc.items || []).map((it: any) => [
                it.descripcion,
                it.categoria || '—',
                it.stock_actual,
                bs(it.costo_unitario),
                bs(it.precio_publico),
                bs(it.total_costo),
                bs(it.total_publico),
            ]),
            styles: { fontSize: 7.5, cellPadding: 2 },
            headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: C.light },
            columnStyles: {
                2: { halign: 'center' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right', fontStyle: 'bold' },
                6: { halign: 'right', fontStyle: 'bold' },
            },
            margin: { left: 10, right: 10 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        if (y > 180) {
            doc.addPage();
            y = 15;
        }
    }

    addFooters(doc);
    doc.save(`Inventario_Valorado_${fecha || 'actual'}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. AUDITORÍA: INVENTARIO vs CAJA
// ═══════════════════════════════════════════════════════════════════════════════

export function descargarPDFAuditoria(report: any, startDate: string, endDate: string, sucursalNombre: string) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    let y = drawHeader(doc, 'Auditoría: Inventario vs Caja', `${sucursalNombre}  •  ${startDate} al ${endDate}`);

    // ── Sección 1: Movimientos Físicos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.text('1. Movimientos Físicos (Valor al Costo)', 10, y);
    y += 4;

    autoTable(doc, {
        startY: y,
        body: ([
            ['Inventario Inicial (antes del período)', bs(report.inventario_inicial_costo), ''],
            ['(+) Ingresos a Inventario (Pedidos / Compras)', bs(report.ingresos_inventario_costo), 'Entradas registradas en el período'],
            ['(-) Mermas y Salidas Manuales', bs(report.salidas_mermas_costo), 'Mercadería sin cobrar'],
            ['(-) Costo de Ventas (Salió por Caja)', bs(report.costo_ventas), 'Costo unitario al momento de la venta'],
            report.revalorizacion_costos !== 0 ? ['(±) Ajuste por Revalorización', bs(report.revalorizacion_costos), 'Por cambios en costo unitario del catálogo'] : null,
            ['= Inventario Final Calculado', bs(report.inventario_final_costo), 'Stock valorado actual'],
        ] as (string[] | null)[]).filter((r): r is string[] => r !== null),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: C.primary, textColor: C.white },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 100 },
            1: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
            2: { fontSize: 7.5, textColor: [120, 120, 140] },
        },
        margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Sección 2: Rendimiento Financiero
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.text('2. Rendimiento Financiero', 10, y);
    y += 4;

    autoTable(doc, {
        startY: y,
        body: [
            ['Ventas Netas (Ingresos en Caja)', bs(report.ventas_netas), 'Total cobrado por ventas no anuladas'],
            ['(-) Costo de la Mercadería Vendida', bs(report.costo_ventas), 'Costo al momento exacto de cada venta'],
            ['= Ganancia Bruta', bs(report.ganancia_bruta), 'Ingreso - Costo directo'],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: C.light },
        didParseCell: (hookData: any) => {
            if (hookData.section === 'body' && hookData.row.index === 2) {
                hookData.cell.styles.fillColor = [236, 253, 245];
                hookData.cell.styles.textColor = [20, 120, 60];
                hookData.cell.styles.fontStyle = 'bold';
            }
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 100 },
            1: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
            2: { fontSize: 7.5, textColor: [120, 120, 140] },
        },
        margin: { left: 10, right: 10 },
    });

    // Nota al pie
    y = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.gray);
    doc.text('* El costo de ventas se calcula usando el Costo Unitario registrado en el Kárdex al momento exacto de la venta.', 10, y);

    addFooters(doc);
    doc.save(`Auditoria_Inventario_${sucursalNombre}_${startDate}_${endDate}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. FINANZAS Y MÁRGENES
// ═══════════════════════════════════════════════════════════════════════════════

export function descargarPDFFinanzas(report: any[], totals: any, startDate: string, endDate: string, sucursalNombre: string) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    let y = drawHeader(doc, 'Finanzas y Márgenes', `${sucursalNombre}  •  ${startDate} al ${endDate}`);

    // KPIs totales
    const kpiW = (pw - 28) / 4;
    drawKPI(doc, 10, y, kpiW - 2, 'Ventas Públicas', bs(totals?.total_publico || 0), C.primary);
    drawKPI(doc, 10 + kpiW, y, kpiW - 2, 'Comisión Matriz', bs(totals?.margen_distribuidor || 0), C.green);
    drawKPI(doc, 10 + kpiW * 2, y, kpiW - 2, 'Margen Retail', bs(totals?.margen_retail || 0), C.amber);
    drawKPI(doc, 10 + kpiW * 3, y, kpiW - 2, 'Margen Neto', bs(totals?.margen_total || 0), C.dark);
    y += 26;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.text('Evolución Diaria de Márgenes', 10, y);
    y += 4;

    autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Ventas Públicas', 'Costo Fábrica', 'Comisión Matriz (15%)', 'Margen Retail', 'Margen Neto']],
        body: report.map((r: any) => [
            r.fecha,
            bs(r.total_publico),
            bs(r.total_fabrica),
            bs(r.margen_distribuidor),
            bs(r.margen_retail),
            bs(r.margen_total),
        ]),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right', fontStyle: 'bold' },
        },
        margin: { left: 10, right: 10 },
    });

    addFooters(doc);
    doc.save(`Finanzas_Margenes_${startDate}_${endDate}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. REPORTE DE GASTOS DETALLADO
// ═══════════════════════════════════════════════════════════════════════════════

export function descargarPDFGastos(report: any, startDate: string, endDate: string, sucursalNombre: string, categoriaNombre: string) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    let subtitle = `${sucursalNombre}  •  ${startDate} al ${endDate}`;
    if (categoriaNombre !== 'Todas') subtitle += `  •  Cat: ${categoriaNombre}`;

    let y = drawHeader(doc, 'Reporte Detallado de Gastos', subtitle);

    // KPIs
    const kpiW = (pw - 28) / 2;
    drawKPI(doc, 10, y, kpiW - 2, 'Total Gastado', bs(report.total), C.red);
    drawKPI(doc, 10 + kpiW, y, kpiW - 2, 'Nro. de Gastos', report.count.toString(), C.dark);
    y += 26;

    // Tabla por categoría (Resumen)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.text('Resumen por Categoría', 10, y);
    y += 4;

    const catRows = Object.entries(report.por_categoria || {}).map(([cat, monto]) => [cat, bs(monto as number)]);
    autoTable(doc, {
        startY: y,
        head: [['Categoría', 'Monto Total (Bs.)']],
        body: catRows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Detalle de movimientos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.text('Detalle de Movimientos', 10, y);
    y += 4;

    autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Hora', 'Categoría', 'Descripción', 'Cajero', 'Monto (Bs.)']],
        body: report.detalle?.map((d: any) => [
            d.fecha.split('T')[0],
            d.hora,
            d.categoria,
            d.descripcion,
            d.cajero,
            bs(d.monto)
        ]),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 10, right: 10 },
    });

    addFooters(doc);
    doc.save(`Reporte_Gastos_${startDate}_${endDate}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. REPORTE DE VENTAS POR CAJA (SÍNTESIS)
// ═══════════════════════════════════════════════════════════════════════════════

export function descargarPDFVentasCaja(sessions: any[], startDate: string, endDate: string, sucursalNombre: string) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    let y = drawHeader(doc, 'Resumen de Ventas por Caja', `${sucursalNombre}  •  ${startDate} al ${endDate}`);

    const totalVentas = sessions.reduce((acc, s) => acc + (s.total_ventas || 0), 0);
    const totalQR = sessions.reduce((acc, s) => acc + (s.total_qr || 0), 0);
    const totalEfectivo = sessions.reduce((acc, s) => acc + (s.total_efectivo + (s.total_ingresos_ef || 0) - s.total_cambio), 0);
    const totalDescuentos = sessions.reduce((acc, s) => acc + (s.total_descuentos || 0), 0);

    // KPIs
    const kpiW = (pw - 32) / 4;
    drawKPI(doc, 10, y, kpiW - 2, 'Ventas Totales', bs(totalVentas), C.primary);
    drawKPI(doc, 10 + kpiW, y, kpiW - 2, 'Total QR (Digital)', bs(totalQR), C.sky);
    drawKPI(doc, 10 + (kpiW * 2), y, kpiW - 2, 'Ef. Neto (Cajón)', bs(totalEfectivo), C.green);
    drawKPI(doc, 10 + (kpiW * 3), y, kpiW - 2, 'Total Descuentos', bs(totalDescuentos), C.amber);
    y += 28;

    autoTable(doc, {
        startY: y,
        head: [['Fecha Apertura', 'Sucursal', 'Cajero / Sesión', 'Ventas QR', 'Ef. Neto', 'Descuentos', 'Total Ventas', 'Estado']],
        body: sessions.map(s => [
            new Date(s.abierta_at).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            s.sucursal_id,
            s.cajero_name,
            bs(s.total_qr),
            bs(s.total_efectivo + (s.total_ingresos_ef || 0) - s.total_cambio),
            bs(s.total_descuentos || 0),
            bs(s.total_ventas),
            s.estado
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: {
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right', fontStyle: 'bold', textColor: C.amber },
            6: { halign: 'right', fontStyle: 'bold' },
            7: { halign: 'center' }
        },
        margin: { left: 10, right: 10 },
    });

    addFooters(doc);
    doc.save(`Ventas_por_Caja_${startDate}_${endDate}.pdf`);
}
