const translate = require('@iamtraction/google-translate');

// Vietnamese texts to translate
const vietnameseTexts = [
  'CÔNG TY CỔ PHẦN GIAO NHẬN VẬN TẢI GIA HUY (GHTRANS)',
  '2 Đường Số 12, Khu đô thị Him Lam, Quận 7, Thành phố Hồ Chí Minh',
  'Thế Lân',
  'Linh Tạ',
  'Mail đạt tối giới hạn tối đa 200 Mail/ngày và không gửi được',
  'Tăng giới hạn Mail lên 250Mail/ngày cho user',
  'Đã hoàn thành'
];

async function translateTexts() {
  console.log('🔄 Translating Vietnamese texts to English...\n');
  
  for (const text of vietnameseTexts) {
    try {
      const result = await translate({
        text: text,
        source: 'vi',
        target: 'en'
      });
      
      console.log(`📝 Vietnamese: ${text}`);
      console.log(`🌐 English: ${result.translation}`);
      console.log('---\n');
    } catch (error) {
      console.error(`❌ Error translating "${text}":`, error.message);
    }
  }
}

translateTexts();
