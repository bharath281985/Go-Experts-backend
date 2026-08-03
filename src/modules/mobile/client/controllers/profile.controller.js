import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';
export const getProfile = async (req, res, next) => {
    try {
        const profile = await prisma.clientProfile.findUnique({
            where: { userId: req.user.id },
            include: {
                user: {
                    select: {
                        email: true,
                        fullName: true,
                        avatarUrl: true,
                        phone: true,
                        country: true,
                        city: true,
                    },
                },
            },
        });
        if (!profile)
            return res.status(404).json(errorResponse('Profile not found', 'NOT_FOUND'));
        const phoneStr = profile.user?.phone || null;
        let phoneCode = null;
        let phoneNumber = phoneStr;
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
        const isUUID = (val) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
        let industryName = profile.industry || null;
        if (profile.industry && isUUID(profile.industry)) {
            const ind = await prisma.industry.findUnique({
                where: { id: profile.industry },
                select: { name: true }
            });
            if (ind) {
                industryName = ind.name;
            }
        }
        const { id, userId, company, industry, ...restProfile } = profile;
        const cleanedAvatarUrl = profile.user?.avatarUrl ? profile.user.avatarUrl.replace(/^https?:\/\/[^\/]+/i, '') : null;
        const data = {
            id,
            userId,
            company,
            industry,
            industryName,
            ...restProfile,
            user: {
                ...profile.user,
                avatarUrl: cleanedAvatarUrl,
                phoneCode,
                phoneNumber
            }
        };
        return res.json(successResponse('Profile retrieved', data));
    }
    catch (error) {
        next(error);
    }
};
export const updateProfile = async (req, res, next) => {
    try {
        const { company, industry, phoneCode, phoneNumber } = req.body;
        const profile = await prisma.clientProfile.upsert({
            where: { userId: req.user.id },
            update: { company, industry },
            create: { userId: req.user.id, company, industry },
        });
        let avatarUrl = null;
        if (req.file) {
            avatarUrl = uploadedFileUrl(req.file);
        }
        const combinedPhone = phoneCode && phoneNumber ? `${phoneCode}${phoneNumber}` : undefined;
        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                ...(avatarUrl ? { avatarUrl } : {}),
                ...(combinedPhone ? { phone: combinedPhone } : {})
            }
        });
        const updatedUser = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true, fullName: true, avatarUrl: true, phone: true, country: true, city: true }
        });
        let resPhoneCode = null;
        let resPhoneNumber = updatedUser?.phone || null;
        if (updatedUser?.phone) {
            const prefixes = ['+971', '+91', '+44', '+61', '+86', '+81', '+49', '+33', '+55', '+65', '+60', '+64', '+1', '+7'];
            const matchedPrefix = prefixes.find(p => updatedUser.phone.startsWith(p));
            if (matchedPrefix) {
                resPhoneCode = matchedPrefix;
                resPhoneNumber = updatedUser.phone.slice(matchedPrefix.length);
            } else if (updatedUser.phone.startsWith('+')) {
                const match = updatedUser.phone.match(/^(\+\d{1,3})(\d{7,15})$/);
                if (match) {
                    resPhoneCode = match[1];
                    resPhoneNumber = match[2];
                }
            }
        }
        const cleanedAvatarUrl = updatedUser?.avatarUrl ? updatedUser.avatarUrl.replace(/^https?:\/\/[^\/]+/i, '') : null;
        return res.json(successResponse('Profile updated', {
            ...profile,
            // user: {
            //     email: updatedUser?.email,
            //     fullName: updatedUser?.fullName,
            //     avatarUrl: cleanedAvatarUrl,
            //     phone: updatedUser?.phone,
            //     country: updatedUser?.country,
            //     city: updatedUser?.city,
            //     phoneCode: resPhoneCode,
            //     phoneNumber: resPhoneNumber
            // }
        }));
    }
    catch (error) {
        next(error);
    }
};
export const uploadLogo = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
        }
        const url = uploadedFileUrl(req.file);
        await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } });
        return res.status(201).json(successResponse('Logo uploaded', { url }));
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
        const profile = await prisma.clientProfile.findUnique({ where: { userId: req.user.id } });
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const steps = [
            { step: 'Basic info', done: !!profile },
            { step: 'Company name', done: !!profile?.company },
            { step: 'Industry', done: !!profile?.industry },
            { step: 'Logo', done: !!user?.avatarUrl },
            { step: 'Address', done: !!(user?.city || user?.country) },
        ];
        const completed = steps.filter((s) => s.done).length;
        return res.json(successResponse('Profile completion', {
            percent: Math.round((completed / steps.length) * 100),
            steps,
        }));
    }
    catch (error) {
        next(error);
    }
};
