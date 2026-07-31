import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';
const splitPhone = (phoneStr) => {
    let phoneCode = null;
    let phoneNumber = phoneStr || null;
    if (phoneStr) {
        const prefixes = ['+971', '+91', '+44', '+61', '+86', '+81', '+49', '+33', '+55', '+65', '+60', '+64', '+1', '+7'];
        const matchedPrefix = prefixes.find(p => phoneStr.startsWith(p));
        if (matchedPrefix) {
            phoneCode = matchedPrefix;
            phoneNumber = phoneStr.slice(matchedPrefix.length);
        } else if (phoneStr.startsWith('+')) {
            const match = phoneStr.match(/^(\+\d{1,3})(\d{7,15})$/);
            if (match) {
                phoneCode = match[1];
                phoneNumber = match[2];
            }
        }
    }
    return { phoneCode, phoneNumber };
};
export const getProfile = async (req, res, next) => {
    try {
        const profile = await prisma.investorProfile.findUnique({
            where: { userId: req.user.id },
            include: { user: { select: { email: true, fullName: true, avatarUrl: true, bio: true, phone: true, country: true, city: true } } }
        });
        if (!profile)
            return res.status(404).json(errorResponse('Investor profile not found', 'NOT_FOUND'));
        if (profile.user) {
            profile.user.avatarUrl = profile.user.avatarUrl ? profile.user.avatarUrl.replace(/^https?:\/\/[^\/]+/i, '') : null;
            const split = splitPhone(profile.user.phone);
            profile.user.phoneCode = split.phoneCode;
            profile.user.phoneNumber = split.phoneNumber;
        }
        return res.json(successResponse('Profile retrieved', profile));
    }
    catch (error) {
        next(error);
    }
};
export const updateProfile = async (req, res, next) => {
    try {
        const { firm, ticketMin, ticketMax, focusAreas, bio, fullName, phoneCode, phoneNumber } = req.body;
        let avatarUrl = undefined;
        if (req.file) {
            avatarUrl = uploadedFileUrl(req.file);
        }
        const combinedPhone = phoneCode && phoneNumber ? `${phoneCode}${phoneNumber}` : undefined;
        const [profile] = await Promise.all([
            prisma.investorProfile.upsert({
                where: { userId: req.user.id },
                update: { firm, ticketMin: ticketMin ? parseFloat(ticketMin) : undefined, ticketMax: ticketMax ? parseFloat(ticketMax) : undefined, focusAreas },
                create: { userId: req.user.id, firm, ticketMin: ticketMin ? parseFloat(ticketMin) : undefined, ticketMax: ticketMax ? parseFloat(ticketMax) : undefined, focusAreas }
            }),
            prisma.user.update({
                where: { id: req.user.id },
                data: {
                    ...(fullName ? { fullName } : {}),
                    ...(bio ? { bio } : {}),
                    ...(avatarUrl ? { avatarUrl } : {}),
                    ...(combinedPhone ? { phone: combinedPhone } : {})
                }
            })
        ]);
        const updatedUser = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true, fullName: true, avatarUrl: true, bio: true, phone: true, country: true, city: true }
        });
        if (updatedUser) {
            updatedUser.avatarUrl = updatedUser.avatarUrl ? updatedUser.avatarUrl.replace(/^https?:\/\/[^\/]+/i, '') : null;
            const split = splitPhone(updatedUser.phone);
            updatedUser.phoneCode = split.phoneCode;
            updatedUser.phoneNumber = split.phoneNumber;
        }
        return res.json(successResponse('Profile updated', {
            ...profile,
            user: updatedUser
        }));
    }
    catch (error) {
        next(error);
    }
};
export const uploadAvatar = async (req, res, next) => {
    try {
        if (!req.file)
            return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
        const url = uploadedFileUrl(req.file);
        await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } });
        return res.status(201).json(successResponse('Avatar uploaded', { url }));
    }
    catch (error) {
        next(error);
    }
};
export const uploadCover = async (req, res, next) => {
    try {
        return respondWithUploadedFile(req, res, 'Cover uploaded');
    }
    catch (error) {
        next(error);
    }
};
export const uploadDocuments = async (req, res, next) => {
    try {
        return respondWithUploadedFile(req, res, 'Document uploaded');
    }
    catch (error) {
        next(error);
    }
};
export const getProfileCompletion = async (req, res, next) => {
    try {
        const [user, profile] = await Promise.all([
            prisma.user.findUnique({ where: { id: req.user.id } }),
            prisma.investorProfile.findUnique({ where: { userId: req.user.id } })
        ]);
        const steps = [
            { step: 'Basic info', done: !!user?.fullName },
            { step: 'Bio', done: !!user?.bio },
            { step: 'Firm', done: !!profile?.firm },
            { step: 'Investment range', done: !!profile?.ticketMin },
            { step: 'Focus areas', done: !!profile?.focusAreas },
            { step: 'Avatar', done: !!user?.avatarUrl }
        ];
        const done = steps.filter(s => s.done).length;
        return res.json(successResponse('Profile completion', { percentage: Math.round((done / steps.length) * 100), steps }));
    }
    catch (error) {
        next(error);
    }
};
