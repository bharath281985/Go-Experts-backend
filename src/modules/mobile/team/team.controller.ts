import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../../config/db.js';
import { successResponse, errorResponse } from '../../../core/response.js';
import { AuthRequest } from '../../../middleware/auth.js';

// Schemas for input validation
const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.string().min(1, 'Role is required'),
  permissions: z.record(z.string(), z.array(z.string())).optional()
});

const updatePermissionsSchema = z.object({
  role: z.string().optional(),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
  status: z.string().optional()
});

function normalizeRows(raw: unknown) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return [raw];
  return [];
}

export const listTeamMembers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    // Ensure only owners can manage the team
    const members = normalizeRows(await (prisma as any).teamMember.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            status: true,
          }
        }
      }
    }).catch(() => []));

    return res.json(successResponse('Team members retrieved successfully', members));
  } catch (error) {
    next(error);
  }
};

export const inviteTeamMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    const validationResult = inviteSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      return res.status(400).json(errorResponse(errorMessage));
    }

    const { email, role, permissions } = validationResult.data;
    const lowerEmail = email.toLowerCase().trim();

    // Check if target user exists in the system
    const targetUser = await prisma.user.findFirst({
      where: { email: lowerEmail }
    }).catch(() => null);

    if (!targetUser) {
      return res.status(404).json(errorResponse('User with this email not found on GoExperts'));
    }

    if (targetUser.id === user.id) {
      return res.status(400).json(errorResponse('You cannot invite yourself'));
    }

    // Check if user is already a member of this team
    const existingMember = await (prisma as any).teamMember.findFirst({
      where: { 
        ownerId: user.id,
        userId: targetUser.id 
      }
    }).catch(() => null);

    if (existingMember) {
      return res.status(400).json(errorResponse('User is already in your team'));
    }

    const newMember = await (prisma as any).teamMember.create({
      data: {
        ownerId: user.id,
        userId: targetUser.id,
        email: targetUser.email,
        role: role,
        permissions: permissions || {},
        status: 'Active'
      }
    });

    return res.json(successResponse('Team member invited successfully', newMember));
  } catch (error) {
    next(error);
  }
};

export const updateTeamMemberPermissions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    const { memberId } = req.params;

    const validationResult = updatePermissionsSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      return res.status(400).json(errorResponse(errorMessage));
    }

    const { permissions, role, status } = validationResult.data;

    const existingMember = await (prisma as any).teamMember.findFirst({
      where: { id: memberId, ownerId: user.id }
    }).catch(() => null);

    if (!existingMember) {
      return res.status(404).json(errorResponse('Team member not found'));
    }

    const updated = await (prisma as any).teamMember.update({
      where: { id: memberId },
      data: {
        ...(permissions ? { permissions } : {}),
        ...(role ? { role } : {}),
        ...(status ? { status } : {})
      }
    }).catch((error) => { throw error; });

    return res.json(successResponse('Team member updated successfully', updated));
  } catch (error) {
    next(error);
  }
};

export const removeTeamMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    const { memberId } = req.params;

    const existingMember = await (prisma as any).teamMember.findFirst({
      where: { id: memberId, ownerId: user.id }
    }).catch(() => null);

    if (!existingMember) {
      return res.status(404).json(errorResponse('Team member not found'));
    }

    await (prisma as any).teamMember.delete({
      where: { id: memberId }
    }).catch((error) => { throw error; });

    return res.json(successResponse('Team member removed successfully'));
  } catch (error) {
    next(error);
  }
};
