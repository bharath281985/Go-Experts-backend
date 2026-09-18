import { prisma } from "../../config/database.js";

export async function adminHasPermission(adminId: string | null | undefined, moduleName: string, actions: string[] | null = null) {
  if (!adminId) return false;
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    if (!admin || !admin.role) return false;

    const perms = (admin.role.rolePermissions || []).map((rp: any) => rp.permission || null).filter(Boolean);
    if (!perms.length) return false;

    const matches = perms.filter((p: any) => String(p.module).toLowerCase() === String(moduleName).toLowerCase());
    if (!matches.length) return false;

    if (!actions || actions.length === 0) return true; // any permission on module

    // Check action match
    for (const m of matches) {
      const act = String(m.action || "").toLowerCase();
      for (const a of actions) {
        if (act === String(a).toLowerCase()) return true;
      }
    }

    return false;
  } catch (err) {
    console.error("permission-check error:", err);
    return false;
  }
}

export default adminHasPermission;
