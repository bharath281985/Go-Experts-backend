import { Router } from "express";
import { prisma } from "../../config/database.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
const router = Router();
router.use(authMiddleware);
// List roles
router.get("/", async (_req, res) => {
    try {
        const roles = await prisma.role.findMany({
            include: {
                rolePermissions: { include: { permission: true } },
                _count: { select: { adminUsers: true, rolePermissions: true } },
            },
            orderBy: { name: "asc" },
        });
        res.json({ success: true, data: roles });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// Get role by id
router.get("/:id", async (req, res) => {
    try {
        const role = await prisma.role.findUnique({
            where: { id: req.params.id },
            include: {
                rolePermissions: { include: { permission: true } },
            },
        });
        if (!role)
            return res.status(404).json({ success: false, message: "Role not found" });
        res.json({ success: true, data: role });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// Create role
router.post("/", async (req, res) => {
    try {
        const { name, description, status } = req.body;
        if (!name)
            return res.status(400).json({ success: false, message: "name is required" });
        const role = await prisma.role.create({
            data: {
                name,
                description: description || null,
                status: status || "active",
            },
        });
        res.status(201).json({ success: true, data: role });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// Update role
router.put("/:id", async (req, res) => {
    try {
        const { name, description, status } = req.body;
        const role = await prisma.role.update({
            where: { id: req.params.id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(status !== undefined && { status }),
            },
        });
        res.json({ success: true, data: role });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// Delete role
router.delete("/:id", async (req, res) => {
    try {
        await prisma.role.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: "Role deleted" });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
/**
 * Assign / sync RolePermission
 * Body: { permissionId } or { permissionIds: string[] }
 * POST creates assignments; PUT replaces all for role; DELETE removes one or many
 */
router.post("/:id/permissions", async (req, res) => {
    try {
        const roleId = req.params.id;
        const permissionIds = Array.isArray(req.body.permissionIds)
            ? req.body.permissionIds
            : req.body.permissionId
                ? [req.body.permissionId]
                : [];
        if (!permissionIds.length) {
            return res.status(400).json({ success: false, message: "permissionId or permissionIds required" });
        }
        const created = [];
        for (const permissionId of permissionIds) {
            const rp = await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId, permissionId } },
                create: { roleId, permissionId },
                update: {},
                include: { permission: true },
            });
            created.push(rp);
        }
        res.status(201).json({ success: true, data: created });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.put("/:id/permissions", async (req, res) => {
    try {
        const roleId = req.params.id;
        const permissionIds = Array.isArray(req.body.permissionIds) ? req.body.permissionIds : [];
        await prisma.$transaction(async (tx) => {
            await tx.rolePermission.deleteMany({ where: { roleId } });
            if (permissionIds.length) {
                await tx.rolePermission.createMany({
                    data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
                });
            }
        });
        const role = await prisma.role.findUnique({
            where: { id: roleId },
            include: { rolePermissions: { include: { permission: true } } },
        });
        res.json({ success: true, data: role });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.delete("/:id/permissions", async (req, res) => {
    try {
        const roleId = req.params.id;
        const permissionIds = Array.isArray(req.body.permissionIds)
            ? req.body.permissionIds
            : req.body.permissionId
                ? [req.body.permissionId]
                : [];
        if (!permissionIds.length) {
            return res.status(400).json({ success: false, message: "permissionId or permissionIds required" });
        }
        await prisma.rolePermission.deleteMany({
            where: { roleId, permissionId: { in: permissionIds } },
        });
        res.json({ success: true, message: "Permission(s) removed from role" });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
export default router;
/** Standalone permissions list router (mounted at /admin/permissions) */
export const permissionsRouter = Router();
permissionsRouter.use(authMiddleware);
permissionsRouter.get("/", async (_req, res) => {
    try {
        const permissions = await prisma.permission.findMany({
            orderBy: [{ module: "asc" }, { action: "asc" }],
        });
        res.json({ success: true, data: permissions });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
