const fs = require('fs');
const file = 'src/services/mobile/email.service.ts';
let content = fs.readFileSync(file, 'utf8');

const replacements = {
  'Ã°Å¸Å’Â ': '🌍 ',
  'Ã°Å¸â€œÂ§': '📧',
  'Ã°Å¸â€œÂ¸': '📸',
  'Ã°Å¸Å½â€°': '🎉',
  'Ã¢Å“â€¦': '✅',
  'Ã°Å¸â€ â€™': '🔒',
  'Ã°Å¸â€˜Â¤': '👤',
  'Ã°Å¸â€œÂ¨': '📬',
  'Ã°Å¸Å¡â‚¬': '🚀',
  'Ã°Å¸â€™Â¼': '💼',
  'Ã°Å¸Â¤Â Ã‚Â ': '🤝 ',
  'Ã°Å¸â€œÅ ': '📊',
  'Ã¢Â Â±Ã¯Â¸Â ': '⏱️ ',
  'Ã°Å¸â€ â€˜': '🔑',
  'Ã°Å¸â€™Â¬': '💬',
  'Ã°Å¸â€œÂ±Ã‚Â ': '📱 ',
  'Ã°Å¸â€™Â¡': '💡',
  'Ã°Å¸â€œË†': '📈',
  'Ã°Å¸Å½Â¯': '🎯',
  'Ã°Å¸â€˜â€¹': '👋',
  'Ã°Å¸â€™Â°': '💰',
  'Ã¢â€šÂ¹': '₹',
  'Ã¢â‚¬â€ ': '— ',
  '??': '🔄',
  '?': '🛡️'
};

for (const [k, v] of Object.entries(replacements)) {
  content = content.split(k).join(v);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed mojibake emojis!');
