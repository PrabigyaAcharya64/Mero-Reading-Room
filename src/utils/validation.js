/**
 * Input validation and sanitization utilities
 */

/**
 * Validates password strength
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePassword(password) {
  if (!password) {
    return { valid: false, error: 'Password is required.' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter.' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter.' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number.' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character (!@#$%^&*...).' };
  }

  return { valid: true, error: null };
}

/**
 * Sanitizes text input by removing potentially dangerous characters
 * and limiting length
 */
export function sanitizeText(text, maxLength = 1000) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove null bytes and control characters (except newlines and tabs)
  let sanitized = text
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validates and sanitizes email
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required.' };
  }

  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email address is too long.' };
  }

  return { valid: true, error: null, sanitized: trimmed };
}

/**
 * Validates name field
 */
export function validateName(name, fieldName = 'Name') {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: `${fieldName} is required.` };
  }

  const trimmed = name.trim();
  
  if (trimmed.length < 2) {
    return { valid: false, error: `${fieldName} must be at least 2 characters long.` };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: `${fieldName} must be less than 100 characters.` };
  }

  // Check for potentially dangerous patterns
  if (/<script|javascript:|onerror=|onclick=/i.test(trimmed)) {
    return { valid: false, error: `${fieldName} contains invalid characters.` };
  }

  return { valid: true, error: null, sanitized: trimmed };
}

/**
 * Validates menu item name
 */
export function validateMenuItemName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Menu item name is required.' };
  }

  const trimmed = sanitizeText(name, 100);
  
  if (trimmed.length < 2) {
    return { valid: false, error: 'Menu item name must be at least 2 characters long.' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Menu item name must be less than 100 characters.' };
  }

  return { valid: true, error: null, sanitized: trimmed };
}

/**
 * Validates price
 */
export function validatePrice(price, min = 0, max = 10000) {
  if (price === null || price === undefined || price === '') {
    return { valid: false, error: 'Price is required.' };
  }

  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  if (isNaN(numPrice)) {
    return { valid: false, error: 'Price must be a valid number.' };
  }

  if (numPrice < min) {
    return { valid: false, error: `Price must be at least ${min}.` };
  }

  if (numPrice > max) {
    return { valid: false, error: `Price must be less than ${max}.` };
  }

  // Round to 2 decimal places
  const rounded = Math.round(numPrice * 100) / 100;

  return { valid: true, error: null, sanitized: rounded };
}

/**
 * Validates description
 */
export function validateDescription(description, maxLength = 500) {
  if (!description || typeof description !== 'string') {
    return { valid: false, error: 'Description is required.' };
  }

  const sanitized = sanitizeText(description, maxLength);
  
  if (sanitized.length < 5) {
    return { valid: false, error: 'Description must be at least 5 characters long.' };
  }

  if (sanitized.length > maxLength) {
    return { valid: false, error: `Description must be less than ${maxLength} characters.` };
  }

  return { valid: true, error: null, sanitized };
}

/**
 * Validates category
 */
export function validateCategory(category) {
  const validCategories = ['Breakfast', 'Meal', 'Dinner', 'Snacks', 'Drinks'];
  
  if (!category || typeof category !== 'string') {
    return { valid: false, error: 'Category is required.' };
  }

  if (!validCategories.includes(category)) {
    return { valid: false, error: 'Invalid category selected.' };
  }

  return { valid: true, error: null, sanitized: category };
}

/**
 * Validates order note
 */
export function validateOrderNote(note, maxLength = 500) {
  if (!note || note.trim().length === 0) {
    return { valid: true, error: null, sanitized: '' }; // Optional field
  }

  const sanitized = sanitizeText(note, maxLength);
  
  if (sanitized.length > maxLength) {
    return { valid: false, error: `Note must be less than ${maxLength} characters.` };
  }

  return { valid: true, error: null, sanitized };
}

