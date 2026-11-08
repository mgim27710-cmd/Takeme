// Shared formatters and string sanitizers

/**
 * Format teacher name to prevent duplicate "선생님 선생님" or "선생님님"
 * @param {string} name - Raw teacher name
 * @returns {string} Sanitized name with single "선생님" title
 */
export function formatTeacherName(name) {
  if (!name) return '선생님';
  const clean = String(name)
    .trim()
    .replace(/(선생님|선생)+$/g, '')
    .trim();
  return clean ? `${clean} 선생님` : '선생님';
}

/**
 * Format driver name to prevent duplicate "기사님 기사님"
 * @param {string} name - Raw driver name
 * @returns {string} Sanitized name with single "기사님" title
 */
export function formatDriverName(name) {
  if (!name) return '기사님';
  const clean = String(name)
    .trim()
    .replace(/(기사님|기사)+$/g, '')
    .trim();
  return clean ? `${clean} 기사님` : '기사님';
}

/**
 * Format Korean phone numbers: 01012345678 -> 010-1234-5678
 */
export function formatPhoneNumber(phone) {
  if (!phone) return '-';
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
