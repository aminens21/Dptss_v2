import ArabicReshaper from 'arabic-reshaper';

export function reshapeAndReverse(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Check if string contains Arabic characters
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (!arabicRegex.test(text)) return text;
  
  // Reshape the Arabic text
  const reshaped = ArabicReshaper.convertArabic(text);
  
  // Reverse the string, but keep numbers and english words intact?
  // Reversing the whole string is simplest if it's purely Arabic.
  // Let's see if splitting by words works better.
  
  // Actually, if it's mixed text, reversing the whole string might break the order.
  // For a simple table, maybe we can just reverse the whole text node.
  return reshaped.split('').reverse().join('');
}

console.log(reshapeAndReverse("أكاديمية جهة الشرق"));
console.log(reshapeAndReverse("U12 ذكور"));
