import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../../config/db.js';
import { successResponse, errorResponse } from '../../../core/response.js';
import { AuthRequest } from '../../../middleware/auth.js';
import bcrypt from 'bcrypt';

// Schemas for input validation
const inviteSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.string().optional(),
  department: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  emailVerified: z.boolean().optional(),
  permittedDashboards: z.array(z.string()).min(1, 'At least 1 dashboard must be permitted'),
  permissions: z.any().optional()
});

const updatePermissionsSchema = z.object({
  name: z.string().optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  status: z.string().optional(),
  permittedDashboards: z.array(z.string()).min(1, 'At least 1 dashboard must be permitted').optional(),
  permissions: z.any().optional()
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

    const total = members.length;
    return res.json({ success: true, rows: members, total });
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

    const { name, email, role, department, password, emailVerified, permittedDashboards, permissions } = validationResult.data;
    const lowerEmail = email.toLowerCase().trim();

    // Check if target user exists in the system, if not create one
    let targetUser = await prisma.user.findFirst({
      where: { email: lowerEmail }
    }).catch(() => null);

    const initialPassword = password || 'GoExperts@2025';

    if (!targetUser) {
      const hashedPassword = await bcrypt.hash(initialPassword, 10);
      targetUser = await prisma.user.create({
        data: {
          fullName: name,
          email: lowerEmail,
          password: hashedPassword,
          role: permittedDashboards[0] || 'client',
          verified: emailVerified ?? true,
          status: 'ACTIVE'
        }
      });
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

    // Store permittedDashboards + modulePermissions JSON
    const mergedPermissions = {
      permittedDashboards: permittedDashboards,
      modulePermissions: permissions?.modulePermissions || {},
      capabilities: permissions?.capabilities || []
    };

    const newMember = await (prisma as any).teamMember.create({
      data: {
        ownerId: user.id,
        userId: targetUser.id,
        email: targetUser.email,
        role: role || 'Member',
        permissions: mergedPermissions,
        status: emailVerified ? 'Active' : 'Invited'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Team member added',
      data: newMember,
      credentials: { email: lowerEmail, password: initialPassword }
    });
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

    const { name, role, department, status, permittedDashboards, permissions } = validationResult.data;

    const existingMember = await (prisma as any).teamMember.findFirst({
      where: { id: memberId, ownerId: user.id }
    }).catch(() => null);

    if (!existingMember) {
      return res.status(404).json(errorResponse('Team member not found'));
    }

    let mergedPermissions = existingMember.permissions || {};
    if (permittedDashboards || permissions) {
      mergedPermissions = {
        ...mergedPermissions,
        ...(permittedDashboards ? { permittedDashboards } : {}),
        ...(permissions?.modulePermissions ? { modulePermissions: permissions.modulePermissions } : {}),
        ...(permissions?.capabilities ? { capabilities: permissions.capabilities } : {})
      };
    }

    const updated = await (prisma as any).teamMember.update({
      where: { id: memberId },
      data: {
        ...(permissions || permittedDashboards ? { permissions: mergedPermissions } : {}),
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
