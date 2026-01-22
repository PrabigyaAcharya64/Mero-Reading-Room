/**
 * Returns the current "business date" identifier (YYYY-MM-DD).
 * A business day starts at 6:00 AM.
 * Before 6:00 AM, it is considered the previous day.
 * Uses local time.
 */
export const getBusinessDate = () => {
    const now = new Date();

    // If it's before 6 AM, subtract 1 day
    if (now.getHours() < 6) {
        now.setDate(now.getDate() - 1);
    }

    // Format as YYYY-MM-DD using local time
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};
