/**
 * Standardizes date formatting across the application to ensure consistency with Bolivia time (La Paz).
 * Backend dates are stored in UTC but often serialized without a timezone indicator (Z).
 * This utility ensures they are treated as UTC and displayed in the user's local time using es-BO locale.
 */

export const formatDate = (dateStr: string | Date | undefined, opts?: Intl.DateTimeFormatOptions) => {
    if (!dateStr) return '–';
    
    // If it's already a Date object, use it directly
    if (dateStr instanceof Date) {
        return dateStr.toLocaleString('es-BO', opts);
    }

    // Ensure the ISO string is treated as UTC by the browser by adding 'Z' if missing
    const isoStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    
    return new Date(isoStr).toLocaleString('es-BO', opts);
};

export const formatFullDate = (dateStr: string | Date | undefined) => {
    return formatDate(dateStr, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

export const formatOnlyDate = (dateStr: string | Date | undefined) => {
    return formatDate(dateStr, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

export const formatOnlyTime = (dateStr: string | Date | undefined) => {
    return formatDate(dateStr, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

/**
 * Returns today's date in YYYY-MM-DD format as per Bolivia (UTC-4) time.
 * Prevents the "tomorrow" bug when accessed late at night (UTC shift).
 */
export const getBoliviaTodayISO = () => {
    // Current time in UTC
    const now = new Date();
    // Offset for Bolivia (-4h = -240m)
    const boOffset = -4 * 60;
    // Adjust to Bolivia local time in ms
    const boTime = new Date(now.getTime() + (boOffset - now.getTimezoneOffset()) * 60000);
    
    return boTime.toISOString().split('T')[0];
};

