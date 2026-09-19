import os

path = 'e:/bhanu/goexperts_backend/Go-Experts-backend/src/modules/mobile/connections/controllers/connections.controller.ts'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

start = code.find('export const rejectInvitation = async')
end = code.find('// DELETE /connections/invitations/:id', start)
if end == -1:
    end = code.find('export const ', start + 1)
    if end == -1:
        end = len(code)

replacement = """export const rejectInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const invitation = await prisma.connectionInvitation.findUnique({ where: { id } });

    if (!invitation || (invitation.receiverId !== req.user.id && invitation.senderId !== req.user.id)) {
      return res.status(404).json(errorResponse('Invitation not found', 'NOT_FOUND'));
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json(errorResponse('Invitation is no longer pending', 'INVALID_STATUS'));
    }

    // Sender is withdrawing their own invitation -> Delete it
    if (invitation.senderId === req.user.id) {
       await prisma.connectionInvitation.delete({ where: { id } });
       return res.json(successResponse('Invitation withdrawn successfully', { id }));
    }

    // Receiver is rejecting it -> Update status
    const updated = await prisma.connectionInvitation.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date() }
    });

    // Clear any orphaned Direct Message conversations between the two users
    await prisma.conversation.deleteMany({
      where: {
        OR: [
          { userA: invitation.senderId, userB: invitation.receiverId },
          { userA: invitation.receiverId, userB: invitation.senderId }
        ],
        projectId: null
      }
    });

    return res.json(successResponse('Invitation rejected successfully', updated));
  } catch (error) { next(error); }
};

"""

code = code[:start] + replacement + code[end:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)
print('Done')
