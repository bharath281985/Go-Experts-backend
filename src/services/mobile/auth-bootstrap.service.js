"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapNewUser = exports.bootstrapUserResources = exports.createRoleProfile = exports.isValidRole = void 0;
const db_js_1 = require("../config/db.js");
const VALID_ROLES = ['freelancer', 'client', 'investor', 'founder'];
const isValidRole = (role) => VALID_ROLES.includes(role);
exports.isValidRole = isValidRole;
const createRoleProfile = async (userId, role, db = db_js_1.prisma) => {
    switch (role) {
        case 'freelancer':
            await db.freelancerProfile.create({ data: { userId } });
            break;
        case 'client':
            await db.clientProfile.create({ data: { userId } });
            break;
        case 'investor':
            await db.investorProfile.create({ data: { userId } });
            break;
        case 'founder':
            await db.founderProfile.create({ data: { userId } });
            break;
    }
};
exports.createRoleProfile = createRoleProfile;
const bootstrapUserResources = async (userId, db = db_js_1.prisma) => {
    await db.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, balance: 0, currency: 'INR' },
    });
    await db.notificationPreference.upsert({
        where: { userId },
        update: {},
        create: { userId },
    });
};
exports.bootstrapUserResources = bootstrapUserResources;
const bootstrapNewUser = async (userId, role, db = db_js_1.prisma) => {
    await (0, exports.createRoleProfile)(userId, role, db);
    await (0, exports.bootstrapUserResources)(userId, db);
};
exports.bootstrapNewUser = bootstrapNewUser;
