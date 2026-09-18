const ArabicReshaper = require('arabic-reshaper');
const text = "النشاط الرياضي";
const reshaped = ArabicReshaper.convertArabic(text);
console.log(reshaped);
console.log(reshaped.split('').reverse().join(''));
