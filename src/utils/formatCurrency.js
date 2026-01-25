/**
 * Format amount as Nepali Rupees currency
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'NPR 0.00';

    return new Intl.NumberFormat('en-NP', {
        style: 'currency',
        currency: 'NPR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

/**
 * Format amount as simple number with NPR prefix
 * @param {number} amount - The amount to format
 * @returns {string} Formatted string like "NPR 1,234.00"
 */
export const formatBalance = (amount) => {
    if (amount === null || amount === undefined) return 'NPR 0.00';

    const formatted = new Intl.NumberFormat('en-NP', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);

    return `NPR ${formatted}`;
};
