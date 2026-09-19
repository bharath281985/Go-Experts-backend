import os

files = [
  'e:/bhanu/goexperts_backend/Go-Experts-backend/src/modules/mobile/client/controllers/messages.controller.ts',
  'e:/bhanu/goexperts_backend/Go-Experts-backend/src/modules/mobile/freelancer/controllers/messages.controller.ts',
  'e:/bhanu/goexperts_backend/Go-Experts-backend/src/modules/mobile/investor/controllers/messages.controller.ts',
  'e:/bhanu/goexperts_backend/Go-Experts-backend/src/modules/mobile/founder/controllers/messages.controller.ts'
]

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()
    
    start = code.find('export const sendMessage = async (req: AuthRequest')
    if start != -1:
        end = code.find('export const markMessageRead = async', start)
        if end != -1:
            code = code[:start] + 'export const sendMessage = chatSendMessage;\n\n' + code[end:]
            with open(path, 'w', encoding='utf-8') as f:
                f.write(code)
print('Done')
