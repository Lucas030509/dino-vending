/**
 * Formats a currency amount to a standard string (e.g., "1,234.50")
 * @param {number|string} amount 
 * @returns {string}
 */
export const formatCurrency = (amount) => {
    const val = parseFloat(amount || 0);
    if (isNaN(val)) return '0.00';
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Parses a database date string (YYYY-MM-DD or ISO) and returns formatted DD/MM/YYYY.
 * Safe against Timezone shifts and ISO timestamps.
 * @param {string} dateString 
 * @returns {string}
 */
export const formatDateDDMMYYYY = (dateString) => {
    if (!dateString) return '-';
    // Remove time part if present (robust against '02T00:00:00')
    const cleanDate = dateString.split('T')[0];
    const [year, month, day] = cleanDate.split('-');
    return `${day}/${month}/${year}`;
};

/**
 * Returns the current date in Mexico City timezone as YYYY-MM-DD.
 * Used for initializing new records correctly regardless of user location.
 * @returns {string}
 */
export const getMexicoCityDate = () => {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
};
