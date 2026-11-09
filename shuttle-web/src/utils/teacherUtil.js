export function cleanTeacherBaseName(name) {
  if (!name) return '';
  const str = String(name).trim();
  if (!str || ['미정', '미지정', '미배정'].includes(str)) return str;
  return str.replace(/(?:\s*(?:선생님|교사))+/g, '').trim();
}

export function formatTeacherName(name) {
  if (!name) return '';
  const str = String(name).trim();
  if (!str || ['미정', '미지정', '미배정'].includes(str)) return str;
  const base = cleanTeacherBaseName(str);
  return base ? `${base} 선생님` : '선생님';
}

export default formatTeacherName;
