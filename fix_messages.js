const fs = require('fs');
const files = [
  'e:/bhanu/goexperts_backend/Go-Experts-backend/src/modules/mobile/client/controllers/messages.controller.ts',
  'e:/bhanu/goexperts_backend/Go-Experts-backend/src/modules/mobile/freelancer/controllers/messages.controller.ts',
  'e:/bhanu/goexperts_backend/Go-Experts-backend/src/modules/mobile/investor/controllers/messages.controller.ts',
  'e:/bhanu/goexperts_backend/Go-Experts-backend/src/modules/mobile/founder/controllers/messages.controller.ts'
];

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  if (!code.includes('import { sendMessage as chatSendMessage }')) {
    code = code.replace(/import \{ AuthRequest \} from '.*?middlewares\/auth\.js';/, match => match + '\nimport { sendMessage as chatSendMessage } from \\'../../chat/controllers/chat.controller.js\\';');
  }
  
  code = code.replace(/export const sendMessage = async \([\s\S]*?\} catch \(error\) \{ next\(error\); \}\s*\};/, 'export const sendMessage = chatSendMessage;');
  fs.writeFileSync(file, code);
}
console.log('Done');
