/**
 * money.ts
 * 
 * Este utilitario previene el error clásico de IEEE 754 en Javascript (ej: 0.1 + 0.2 = 0.30000000000000004).
 * Al recibir montos (numéricos o strings), los procesa y redondea a exactamente 2 decimales
 * de forma bancaria estricta, empatando con el 'Decimal128' de MongoDB en el backend.
 */

export function roundMoney(amount: number | string): number {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return 0;
    
    // Método de Epsilon absoluto para estabilizar flotantes en JS
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function formatMoney(amount: number | string): string {
    const rounded = roundMoney(amount);
    return rounded.toFixed(2);
}

export function addMoney(a: number | string, b: number | string): number {
    return roundMoney(roundMoney(a) + roundMoney(b));
}

export function subMoney(a: number | string, b: number | string): number {
    return roundMoney(roundMoney(a) - roundMoney(b));
}

export function mulMoney(a: number | string, multiplier: number | string): number {
    return roundMoney(roundMoney(a) * roundMoney(multiplier));
}
