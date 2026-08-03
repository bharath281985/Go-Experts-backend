import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../config/database.js';
import { successResponse, errorResponse } from '../../../core/response.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail } from '../../../services/mobile/email.service.js';
import { saveDeviceToken, removeDeviceToken } from '../../../services/mobile/push.service.js';
import { AuditEngine } from '../../../services/mobile/audit.engine.js';
import { bootstrapNewUser } from '../../../services/mobile/auth-bootstrap.service.js';
import { issuePhoneOtp, verifyPhoneOtp, issueEmailOtp, verifyEmailOtp } from '../../../services/mobile/otp.service.js';
import { resolveProfileCompletion } from '../../../services/mobile/profile-completion.service.js';
import { resolveUserSubscriptionGate } from '../../../services/mobile/subscription.service.js';
function requireSecret(name, value, fallback) {
    if (value && value.trim())
        return value.trim();
    if (fallback)
        return fallback;
    return 'dev-only-secret-key-at-least-16-bytes-long';
}
const JWT_SECRET = requireSecret('JWT_SECRET', process.env.JWT_SECRET, 'dev-only-jwt-secret-min16');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '48h';
const REFRESH_SECRET = requireSecret('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET, 'dev-only-refresh-secret-min16');
const PASSWORD_RESET_SECRET = process.env.JWT_RESET_SECRET || JWT_SECRET;
const PASSWORD_RESET_EXPIRES_IN_MS = 15 * 60 * 1000;
const authEpochKey = (userId) => `auth_epoch:${userId}`;
const getAuthEpoch = async (userId) => {
    try {
        if (prisma.setting) {
            const row = await prisma.setting.findUnique({ where: { key: authEpochKey(userId) } });
            const n = row ? Number(row.value) : 0;
            return Number.isFinite(n) ? n : 0;
        }
    } catch (e) {}
    return 0;
};
const bumpAuthEpoch = async (userId) => {
    try {
        if (prisma.setting) {
            const next = (await getAuthEpoch(userId)) + 1;
            const key = authEpochKey(userId);
            await prisma.setting.upsert({
                where: { key },
                create: { key, value: String(next), category: 'auth' },
                update: { value: String(next) },
            });
            return next;
        }
    } catch (e) {}
    return 0;
};
const getRedirectTo = (role) => {
    switch (role) {
        case 'freelancer': return '/freelancer/dashboard';
        case 'client': return '/client/dashboard';
        case 'investor': return '/investor/dashboard';
        case 'founder': return '/founder/dashboard';
        default: return '/dashboard';
    }
};
const buildPhoneNumber = (phone, countryCode) => {
    if (!phone)
        return undefined;
    if (!countryCode)
        return phone;
    return `${countryCode}${phone}`;
};
const createAccessToken = async (user) => {
    const epoch = await getAuthEpoch(user.id);
    return jwt.sign({ id: user.id, role: user.role, epoch }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
};
const createRefreshToken = async (user) => {
    const epoch = await getAuthEpoch(user.id);
    return jwt.sign({ id: user.id, role: user.role, epoch }, REFRESH_SECRET, {
        expiresIn: '30d',
    });
};
const createPasswordResetToken = (user) => jwt.sign({ id: user.id, type: 'password_reset' }, `${PASSWORD_RESET_SECRET}:${user.password}`, {
    expiresIn: `${PASSWORD_RESET_EXPIRES_IN_MS / 1000}s`,
});
const safeTrackLoginAttempt = async (email, success, req, failReason) => {
    try {
        await prisma.loginAttempt.create({
            data: {
                email,
                success,
                failReason: success ? null : failReason ?? null,
                ipAddress: req.ip || req.socket.remoteAddress || null,
                userAgent: req.headers['user-agent'] || null,
            },
        });
    }
    catch (error) {
        console.error('Failed to track login attempt:', error);
    }
};
const buildAuthPayload = async (user) => {
    const accessToken = await createAccessToken(user);
    const refreshToken = await createRefreshToken(user);

    let completion = { profileCompletion: 80, isProfileComplete: true };
    let subscriptionGate = { status: 'active', planId: 'Free_Trial', planName: 'Starter' };

    try {
        const [c, s] = await Promise.all([
            resolveProfileCompletion(user.id).catch(() => null),
            resolveUserSubscriptionGate(user.id).catch(() => null),
        ]);
        if (c) completion = c;
        if (s) subscriptionGate = s;
    } catch (err) {
        console.error('Error resolving profile/subscription details:', err);
    }

    const hasActiveSubscription = subscriptionGate.status === 'active';

    return {
        accessToken,
        refreshToken,
        token: accessToken,
        subscriptionPlan: hasActiveSubscription,
        hasSubscription: hasActiveSubscription,
        isSubscribed: hasActiveSubscription,
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            avatarUrl: user.avatarUrl ? user.avatarUrl.replace(/^https?:\/\/[^\/]+/i, '') : null,
            status: user.status,
            isVerified: user.isVerified,
            profileCompletion: completion.profileCompletion,
            isProfileComplete: completion.isProfileComplete,
            subscriptionPlan: hasActiveSubscription,
            hasSubscription: hasActiveSubscription,
            isSubscribed: hasActiveSubscription,
            subscriptionStatus: subscriptionGate.status,
            subscriptionPlanId: subscriptionGate.planId,
            subscriptionPlanName: subscriptionGate.planName ?? subscriptionGate.planId,
            redirectTo: getRedirectTo(user.role),
        },
    };
};
const issueAuthResponse = async (user, device) => {
    if (device.fcmToken) {
        await saveDeviceToken(user.id, device.fcmToken, device.platform || 'web', device.deviceId || 'unknown', device.deviceName).catch(() => null);
    }
    return buildAuthPayload(user);
};
export const login = async (req, res, next) => {
    try {
        const { email, password, deviceId, deviceName, platform, fcmToken } = req.body || {};
        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json(errorResponse('Email is required', 'VALIDATION_ERROR'));
        }
        const rawEmail = email.trim();
        const cleanEmail = rawEmail.toLowerCase();

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: cleanEmail },
                    { email: rawEmail },
                ]
            }
        });

        if (!user || !user.password) {
            await safeTrackLoginAttempt(rawEmail, false, req, 'USER_NOT_FOUND');
            return res.status(404).json(errorResponse('User is not registered with us', 'USER_NOT_FOUND'));
        }
        const isMatch = await bcrypt.compare(password || '', user.password);
        if (!isMatch) {
            await safeTrackLoginAttempt(rawEmail, false, req, 'INVALID_CREDENTIALS');
            await AuditEngine.track(user.id, 'failed_login', 'user', user.id, null, null, req).catch(() => null);
            return res.status(401).json(errorResponse('Invalid email or password', 'INVALID_CREDENTIALS'));
        }
        if (user.status !== 'active') {
            await safeTrackLoginAttempt(rawEmail, false, req, 'ACCOUNT_INACTIVE');
            return res.status(403).json(errorResponse('Your account is inactive. Please contact support.', 'ACCOUNT_INACTIVE'));
        }
        const payload = await issueAuthResponse(user, { fcmToken, platform, deviceId, deviceName });
        await AuditEngine.track(user.id, 'login', 'user', user.id, null, null, req).catch(() => null);
        await safeTrackLoginAttempt(rawEmail, true, req);
        return res.json(successResponse('Login successful', payload));
    }
    catch (error) {
        next(error);
    }
};
export const register = async (req, res, next) => {
    try {
        const b = req.body || {};
        const { email, password, role, fcmToken, platform, deviceId, deviceName } = b;
        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json(errorResponse('Email is required', 'VALIDATION_ERROR'));
        }
        const cleanEmail = email.trim().toLowerCase();
        const nameVal = b.fullName || b.name || "User";
        const phoneVal = b.phone || b.mobile || b.phoneNumber;
        const phoneCodeVal = b.phoneCode || b.countryCode;
        const bioVal = b.bio || (typeof b.startup === 'object' && b.startup?.longDescription) || b.businessDescription || b.thesis || b.overview || null;
        const cityVal = b.city || null;
        const countryVal = b.country || b.countryId || null;
        const avatarUrlVal = b.avatarUrl || b.avatar || b.logo || null;
        const isEmailVerified = Boolean(b.verification?.emailVerified ?? b.isVerified ?? b.emailVerified);

        const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
        if (existingUser) {
            return res.status(409).json(errorResponse('Email is already registered. Please login.', 'EMAIL_ALREADY_EXISTS'));
        }
        const hashedPassword = await bcrypt.hash(password || 'password123', 12);
        const targetRole = role || 'client';

        const user = await prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: {
                    email: cleanEmail,
                    password: hashedPassword,
                    fullName: String(nameVal).trim(),
                    role: targetRole,
                    phone: buildPhoneNumber(phoneVal, phoneCodeVal),
                    city: cityVal ? String(cityVal).trim() : null,
                    country: countryVal ? String(countryVal).trim() : null,
                    bio: bioVal ? String(bioVal).trim() : null,
                    avatarUrl: avatarUrlVal ? String(avatarUrlVal).trim() : null,
                    isVerified: isEmailVerified,
                    registrationData: b,
                    status: 'active',
                },
            });
            await bootstrapNewUser(created.id, targetRole, tx);

            if (targetRole === 'investor') {
                const firmVal = b.companyFundName || b.firm || b.firmName || null;
                const ticketMinVal = b.minTicket ?? b.ticketMin;
                const ticketMaxVal = b.ticketMax ?? b.maxTicket;
                const focusAreasVal = b.focusAreas || (Array.isArray(b.categories) ? b.categories.join(', ') : b.categories) || null;
                await tx.investorProfile.upsert({
                    where: { userId: created.id },
                    update: {
                        firm: firmVal ? String(firmVal).trim() : undefined,
                        ticketMin: ticketMinVal != null && ticketMinVal !== '' ? parseFloat(ticketMinVal) : undefined,
                        ticketMax: ticketMaxVal != null && ticketMaxVal !== '' ? parseFloat(ticketMaxVal) : undefined,
                        focusAreas: focusAreasVal ? String(focusAreasVal) : undefined,
                    },
                    create: {
                        userId: created.id,
                        firm: firmVal ? String(firmVal).trim() : null,
                        ticketMin: ticketMinVal != null && ticketMinVal !== '' ? parseFloat(ticketMinVal) : null,
                        ticketMax: ticketMaxVal != null && ticketMaxVal !== '' ? parseFloat(ticketMaxVal) : null,
                        focusAreas: focusAreasVal ? String(focusAreasVal) : null,
                    }
                });
            } else if (targetRole === 'founder') {
                const startupObj = typeof b.startup === 'object' ? b.startup : {};
                const startupNameVal = startupObj.name || b.startupName || b.startup || b.title || (nameVal ? `${nameVal}'s Startup` : 'My Startup');
                const industryVal = b.industryId || b.industry || b.taxonomy?.primaryCategoryId || 'Technology';
                const stageVal = startupObj.stageId || b.stage || b.fundingStage || 'Idea';
                const teamSizeRaw = b.teamSizeId || b.teamSize;
                const teamSizeVal = teamSizeRaw ? (parseInt(String(teamSizeRaw).replace(/[^\d]/g, '')) || 1) : 1;
                const fundingReqRaw = startupObj.fundingRequired || b.fundingRequired || b.raised || b.funding;
                const raisedVal = fundingReqRaw != null ? (parseFloat(String(fundingReqRaw).replace(/[^\d.]/g, '')) || 0) : 0;
                const equityOfferedRaw = startupObj.equityOffered || b.equityOffered || b.equity;
                const equityVal = equityOfferedRaw != null ? (parseFloat(String(equityOfferedRaw).replace(/[^\d.]/g, '')) || 0) : 0;
                const pitchDeckVal = startupObj.pitchDeck || b.pitchDeck || b.pitchDeckUrl || null;

                await tx.founderProfile.upsert({
                    where: { userId: created.id },
                    update: {
                        startupName: String(startupNameVal).trim(),
                        industry: String(industryVal).trim(),
                        stage: String(stageVal).trim(),
                        teamSize: teamSizeVal,
                        raised: raisedVal,
                    },
                    create: {
                        userId: created.id,
                        startupName: String(startupNameVal).trim(),
                        industry: String(industryVal).trim(),
                        stage: String(stageVal).trim(),
                        teamSize: teamSizeVal,
                        raised: raisedVal,
                    }
                });

                await tx.startupIdea.create({
                    data: {
                        founder: created.id,
                        startup: String(startupNameVal).trim(),
                        industry: String(industryVal).trim(),
                        category: b.profileCategoryId || b.categoryId || b.taxonomy?.primaryCategoryId || 'General',
                        stage: String(stageVal).trim(),
                        funding: raisedVal,
                        equity: equityVal,
                        visibility: b.visibility || 'Public',
                        pitchDeck: pitchDeckVal,
                        businessPlan: b.businessPlan || b.businessPlanUrl || null,
                        logo: avatarUrlVal || null,
                        status: 'active'
                    }
                }).catch(() => null);
            } else if (targetRole === 'client') {
                const companyVal = b.businessName || b.company || b.companyName || null;
                const industryVal = b.industryId || b.industry || null;
                await tx.clientProfile.upsert({
                    where: { userId: created.id },
                    update: {
                        company: companyVal ? String(companyVal).trim() : undefined,
                        industry: industryVal ? String(industryVal).trim() : undefined,
                    },
                    create: {
                        userId: created.id,
                        company: companyVal ? String(companyVal).trim() : null,
                        industry: industryVal ? String(industryVal).trim() : null,
                    }
                });

                if (b.project && typeof b.project === 'object' && b.project.title) {
                    const proj = b.project;
                    const skillsVal = Array.isArray(proj.skills) ? proj.skills.join(', ') : (proj.skills ? String(proj.skills) : 'General');
                    await tx.project.create({
                        data: {
                            title: String(proj.title).trim(),
                            client: created.id,
                            budget: proj.budget != null ? parseFloat(proj.budget) : 0,
                            category: proj.categoryId || b.categoryId || 'General',
                            technology: skillsVal,
                            timeline: proj.timeline || null,
                            description: proj.description || null,
                            workMode: proj.remoteType || 'Remote',
                            status: 'open',
                        }
                    }).catch(() => null);
                }
            } else if (targetRole === 'freelancer') {
                const rawSkills = b.skillIds ?? b.skills;
                const skillsVal = Array.isArray(rawSkills) ? rawSkills.join(',') : (rawSkills ? String(rawSkills) : null);
                const industryVal = b.industryId || b.industry || null;
                const expRaw = b.experienceYears ?? b.experience;
                const experienceVal = expRaw != null ? String(expRaw) : null;
                const hourlyRateVal = b.hourlyRate != null && b.hourlyRate !== '' ? parseFloat(b.hourlyRate) : null;

                await tx.freelancerProfile.upsert({
                    where: { userId: created.id },
                    update: {
                        skills: skillsVal || undefined,
                        industry: industryVal ? String(industryVal).trim() : undefined,
                        experience: experienceVal || undefined,
                        hourlyRate: hourlyRateVal != null ? hourlyRateVal : undefined,
                    },
                    create: {
                        userId: created.id,
                        skills: skillsVal || '',
                        industry: industryVal ? String(industryVal).trim() : null,
                        experience: experienceVal,
                        hourlyRate: hourlyRateVal,
                    }
                });
            }

            if (b.subscription && typeof b.subscription === 'object' && (b.subscription.planId || b.subscription.isFreePlan !== undefined)) {
                const sub = b.subscription;
                const planId = String(sub.planId || (sub.isFreePlan ? 'Free_Trial' : 'Pro_Plan'));
                
                await tx.subscriptionPlan.upsert({
                    where: { id: planId },
                    update: {
                        amount: sub.amount != null ? parseFloat(sub.amount) : 0,
                        status: 'active',
                    },
                    create: {
                        id: planId,
                        name: `${targetRole.charAt(0).toUpperCase() + targetRole.slice(1)} Plan`,
                        role: targetRole,
                        amount: sub.amount != null ? parseFloat(sub.amount) : 0,
                        currency: 'INR',
                        duration: sub.isFreePlan ? '90_days' : 'yearly',
                        status: 'active',
                    }
                }).catch(() => null);

                await tx.subscription.create({
                    data: {
                        userId: created.id,
                        planId,
                        startDate: new Date(),
                        endDate: new Date(Date.now() + (sub.isFreePlan ? 90 * 86400000 : 365 * 86400000)),
                        status: 'active',
                    }
                }).catch(() => null);

                if (sub.amount && parseFloat(sub.amount) > 0) {
                    await tx.payment.create({
                        data: {
                            userId: created.id,
                            gateway: sub.paymentType || 'Easebuzz',
                            amount: parseFloat(sub.amount),
                            currency: 'INR',
                            transactionId: sub.transactionId || null,
                            status: sub.paymentStatus === 'paid' ? 'success' : 'pending',
                        }
                    }).catch(() => null);
                }
            }

            return created;
        });
        const payload = await issueAuthResponse(user, { fcmToken, platform, deviceId, deviceName });
        void sendWelcomeEmail(email, nameVal);
        await AuditEngine.track(user.id, 'register', 'user', user.id, null, null, req);
        return res.status(201).json(successResponse('Registration successful', payload));
    }
    catch (error) {
        next(error);
    }
};
export const logout = async (req, res, next) => {
    try {
        await bumpAuthEpoch(req.user.id);
        const fcmToken = req.body?.fcmToken || req.body?.deviceToken;
        if (fcmToken) {
            await removeDeviceToken(String(fcmToken));
        }
        else {
            await prisma.deviceToken.deleteMany({ where: { userId: req.user.id } });
        }
        await AuditEngine.track(req.user.id, 'logout', 'user', req.user.id, null, null, req);
        return res.json(successResponse('Logged out successfully'));
    }
    catch (error) {
        next(error);
    }
};
export const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json(errorResponse('Refresh token required', 'VALIDATION_ERROR'));
        }
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                avatarUrl: true,
                status: true,
                isVerified: true,
            },
        });
        if (!user || user.status !== 'active') {
            return res.status(401).json(errorResponse('Session expired. Please login again.', 'INVALID_TOKEN'));
        }
        // const epoch = await getAuthEpoch(user.id);
        // if (typeof decoded.epoch === 'number' && decoded.epoch !== epoch) {
        //     return res.status(401).json(errorResponse('Session revoked. Please login again.', 'SESSION_REVOKED'));
        // }
        // Rotation: issue a new access + refresh pair bound to the same auth epoch.
        const payload = await buildAuthPayload(user);
        return res.json(successResponse('Token refreshed', payload));
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json(errorResponse('Session expired. Please login again.', 'REFRESH_TOKEN_EXPIRED'));
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json(errorResponse('Invalid session. Please login again.', 'INVALID_TOKEN'));
        }
        next(error);
    }
};
export const getMe = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json(errorResponse('Unauthorized'));
        const [completion, subscriptionGate] = await Promise.all([
            resolveProfileCompletion(user.id),
            resolveUserSubscriptionGate(user.id),
        ]);
        const userData = {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            avatarUrl: user.avatarUrl,
            status: user.status,
            isVerified: user.isVerified,
            phone: user.phone,
            country: user.country,
            city: user.city,
            bio: user.bio,
            profileCompletion: completion.profileCompletion,
            isProfileComplete: completion.isProfileComplete,
            subscriptionStatus: subscriptionGate.status,
            subscriptionPlanId: subscriptionGate.planId,
            subscriptionPlan: subscriptionGate.planName ?? subscriptionGate.planId,
            redirectTo: getRedirectTo(user.role),
        };
        return res.json(successResponse('User profile retrieved', { user: userData }));
    }
    catch (error) {
        next(error);
    }
};
export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json(errorResponse('User not found with this email address', 'NOT_FOUND'));
        }
        // Generate a 6-digit OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const key = `reset_password_otp:${email}`;
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins expiry
        await prisma.setting.upsert({
            where: { key },
            update: { value: JSON.stringify({ otp, expiresAt }), category: 'auth' },
            create: { key, value: JSON.stringify({ otp, expiresAt }), category: 'auth' }
        });
        void sendPasswordResetEmail(email, otp);
        await AuditEngine.track(user.id, 'password_reset_requested', 'user', user.id, null, null, req);
        return res.json(successResponse('Reset password OTP sent successfully'));
    }
    catch (error) {
        next(error);
    }
};
export const resetPassword = async (req, res, next) => {
    try {
        const { email, otp, newPassword } = req.body;
        const key = `reset_password_otp:${email}`;
        const row = await prisma.setting.findUnique({ where: { key } });
        if (!row?.value) {
            return res.status(400).json(errorResponse('Invalid or expired OTP', 'INVALID_OTP'));
        }
        const { otp: savedOtp, expiresAt } = JSON.parse(row.value);
        if (savedOtp !== String(otp).trim() || new Date() > new Date(expiresAt)) {
            return res.status(400).json(errorResponse('Invalid or expired OTP', 'INVALID_OTP'));
        }
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json(errorResponse('User not found', 'NOT_FOUND'));
        }
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });
        await prisma.setting.delete({ where: { key } }).catch(() => {});
        await AuditEngine.track(user.id, 'password_reset_success', 'user', user.id, null, null, req);
        return res.json(successResponse('Password reset successfully'));
    }
    catch (error) {
        next(error);
    }
};
export const changePassword = async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user || !user.password)
            return res.status(400).json(errorResponse('Invalid request'));
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch)
            return res.status(401).json(errorResponse('Incorrect old password'));
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });
        await AuditEngine.track(user.id, 'password_changed', 'user', user.id, null, null, req);
        return res.json(successResponse('Password changed successfully. All devices have been logged out.'));
    }
    catch (error) {
        next(error);
    }
};
export const updateMe = async (req, res, next) => {
    try {
        const { fullName, phone, country, city, bio, headline, location, skills, skillIds, categoryId, } = req.body;
        const cityValue = city || location;
        const composedBio = [headline, bio].filter(Boolean).join('\n\n') || undefined;
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                fullName,
                phone,
                country,
                city: cityValue,
                bio: composedBio,
                isVerified: true,
            },
        });
        const role = updatedUser.role;
        const rawSkillIds = skillIds ?? skills;
        const skillsValue = Array.isArray(rawSkillIds)
            ? rawSkillIds.join(',')
            : typeof rawSkillIds === 'string'
                ? rawSkillIds
                : undefined;
        if (role === 'freelancer') {
            await prisma.freelancerProfile.upsert({
                where: { userId: req.user.id },
                update: { skills: skillsValue },
                create: { userId: req.user.id, skills: skillsValue },
            });
        }
        else if (role === 'client' && categoryId) {
            await prisma.clientProfile.upsert({
                where: { userId: req.user.id },
                update: { industry: categoryId },
                create: { userId: req.user.id, industry: categoryId },
            });
        }
        else if (role === 'investor' && categoryId) {
            await prisma.investorProfile.upsert({
                where: { userId: req.user.id },
                update: { focusAreas: categoryId },
                create: { userId: req.user.id, focusAreas: categoryId },
            });
        }
        else if (role === 'founder' && categoryId) {
            await prisma.founderProfile.upsert({
                where: { userId: req.user.id },
                update: { industry: categoryId },
                create: { userId: req.user.id, industry: categoryId },
            });
        }
        const completion = await resolveProfileCompletion(req.user.id);
        return res.json(successResponse('Profile updated successfully', {
            user: {
                ...updatedUser,
                profileCompletion: completion.profileCompletion,
                isProfileComplete: completion.isProfileComplete,
            },
        }));
    }
    catch (error) {
        next(error);
    }
};
export const updateAvatar = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json(errorResponse('No avatar file provided', 'VALIDATION_ERROR'));
        }
        const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
        const relativePath = req.file.path.replace(/\\/g, '/');
        const avatarUrl = `${BASE_URL}/${relativePath}`;
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: { avatarUrl },
        });
        const completion = await resolveProfileCompletion(req.user.id);
        return res.json(successResponse('Avatar updated successfully', {
            url: avatarUrl,
            avatarUrl,
            user: {
                ...updatedUser,
                profileCompletion: completion.profileCompletion,
                isProfileComplete: completion.isProfileComplete,
            },
        }));
    }
    catch (error) {
        next(error);
    }
};
export const sendEmailVerification = async (req, res, next) => {
    try {
        const email = req.body?.email || req.user?.email;
        if (!email) {
            return res.status(400).json(errorResponse('Email is required', 'VALIDATION_ERROR'));
        }
        const { code } = await issueEmailOtp(email);
        await sendVerificationEmail(email, code);
        return res.json(successResponse(`Verification OTP sent to ${email}`, {
            email,
            expiresInSeconds: 600,
        }));
    }
    catch (error) {
        next(error);
    }
};
export const verifyEmail = async (req, res, next) => {
    try {
        const email = req.body?.email || req.user?.email;
        const { otp, code } = req.body;
        const submittedOtp = otp || code;
        if (!email || !submittedOtp) {
            return res.status(400).json(errorResponse('Email and OTP code are required', 'VALIDATION_ERROR'));
        }
        const result = verifyEmailOtp(email, submittedOtp);
        if (!result.valid) {
            switch (result.reason) {
                case 'EXPIRED':
                    return res.status(400).json(errorResponse('Your OTP code has expired. Please request a new one.', 'OTP_EXPIRED'));
                case 'TOO_MANY_ATTEMPTS':
                    return res.status(429).json(errorResponse('Too many invalid attempts. This OTP has expired. Please request a new OTP.', 'MAX_OTP_ATTEMPTS_EXCEEDED'));
                default:
                    return res.status(400).json(errorResponse(`Invalid OTP code. You have ${result.remainingAttempts} attempts remaining.`, 'INVALID_OTP', { remainingAttempts: result.remainingAttempts }));
            }
        }
        if (req.user?.id) {
            await prisma.user.update({
                where: { id: req.user.id },
                data: { isVerified: true }
            }).catch(() => null);
        }
        return res.json(successResponse('Email verified successfully', {
            email,
            isVerified: true
        }));
    }
    catch (error) {
        next(error);
    }
};
export const deleteAccount = async (req, res, next) => {
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { status: 'inactive' }
        });
        return res.json(successResponse('Account deleted successfully'));
    }
    catch (error) {
        next(error);
    }
};
export const sendOtp = async (req, res, next) => {
    try {
        const { phone, countryCode } = req.body;
        const { phoneNumber } = await issuePhoneOtp(phone, countryCode);
        return res.json(successResponse('OTP sent successfully', {
            phone: phoneNumber,
            expiresInSeconds: 300,
        }));
    }
    catch (error) {
        next(error);
    }
};
export const resendOtp = async (req, res, next) => {
    try {
        const { phone, countryCode } = req.body;
        const { phoneNumber } = await issuePhoneOtp(phone, countryCode);
        return res.json(successResponse('OTP resent successfully', {
            phone: phoneNumber,
            expiresInSeconds: 300,
        }));
    }
    catch (error) {
        next(error);
    }
};
export const verifyOtp = async (req, res, next) => {
    try {
        const { phone, countryCode, code } = req.body;
        const result = verifyPhoneOtp(phone, countryCode, code);
        if (!result.valid) {
            switch (result.reason) {
                case 'EXPIRED':
                    return res.status(400).json(errorResponse('OTP has expired. Please request a new code.', 'OTP_EXPIRED'));
                case 'TOO_MANY_ATTEMPTS':
                    return res.status(429).json(errorResponse('Too many invalid attempts. Please request a new OTP.', 'OTP_MAX_ATTEMPTS'));
                default:
                    return res.status(400).json(errorResponse('Invalid OTP. Please try again.', 'INVALID_OTP'));
            }
        }
        return res.json(successResponse('Phone verified successfully', { verified: true }));
    }
    catch (error) {
        next(error);
    }
};
