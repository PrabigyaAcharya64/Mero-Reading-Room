/**
 * Format date string or timestamp to readable format
 * @param {string|Date|number} dateInput - Date string, Date object, or timestamp
 * @returns {string} Formatted date string like "Jan 25, 2026"
 */
export const formatDate = (dateInput) => {
    if (!dateInput) return '-';

    try {
        const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

        if (isNaN(date.getTime())) return '-';

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return '-';
    }
};

/**
 * Format date for input fields (YYYY-MM-DD)
 * @param {string|Date|number} dateInput - Date string, Date object, or timestamp
 * @returns {string} Date in YYYY-MM-DD format
 */
export const formatDateForInput = (dateInput) => {
    if (!dateInput) return '';

    try {
        const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

        if (isNaN(date.getTime())) return '';

        return date.toISOString().split('T')[0];
    } catch (error) {
        console.error('Error formatting date for input:', error);
        return '';
    }
};

/**
 * Check if a date is in the past
 * @param {string|Date|number} dateInput - Date to check
 * @returns {boolean} True if date is in the past
 */
export const isPastDate = (dateInput) => {
    if (!dateInput) return false;

    try {
        const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
        return date < new Date();
    } catch (error) {
        return false;
    }
};
