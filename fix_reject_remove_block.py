import os

path = 'e:/bhanu/goexperts_backend/Go-Experts-backend/src/modules/mobile/connections/controllers/connections.controller.ts'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

target = """    // Upsert Connection state to BLOCKED
    const [userOneId, userTwoId] = [invitation.senderId, invitation.receiverId].sort();
    await prisma.connection.upsert({
      where: { userOneId_userTwoId: { userOneId, userTwoId } },
      update: { status: 'BLOCKED' },
      create: { userOneId, userTwoId, status: 'BLOCKED' }
    });"""

code = code.replace(target, '')

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)
print('Done')
