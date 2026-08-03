import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { uploadedFileUrl } from '../../../../utils/uploaded-file.js';
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
        const profile = await prisma.freelancerProfile.findUnique({ where: { userId: req.user.id }, include: { user: { select: { email: true, fullName: true, avatarUrl: true, phone: true } } } });
        if (!profile)
            return res.status(404).json(errorResponse('Profile not found', 'NOT_FOUND'));
        if (profile.user) {
            profile.user.avatarUrl = profile.user.avatarUrl ? profile.user.avatarUrl.replace(/^https?:\/\/[^\/]+/i, '') : null;
            const split = splitPhone(profile.user.phone);
            profile.user.phoneCode = split.phoneCode;
            profile.user.phoneNumber = split.phoneNumber;
        }
        const isUUID = (val) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
        const skillIds = profile.skills ? profile.skills.split(',').map(s => s.trim()).filter(isUUID) : [];
        let skillsArray = [];
        if (skillIds.length > 0) {
            const skillsList = await prisma.skill.findMany({
                where: { id: { in: skillIds } },
                select: { id: true, name: true }
            });
            skillsArray = skillsList.map(s => ({
                skillId: s.id,
                skillName: s.name
            }));
        }
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
        const { id, userId, skills, ...restProfile } = profile;
        const data = {
            id,
            userId,
            skills: skillsArray,
            industry: profile.industry || null,
            industryName,
            ...restProfile
        };
        return res.json(successResponse('Profile retrieved', data));
    }
    catch (error) {
        next(error);
    }
};
export const updateProfile = async (req, res, next) => {
    try {
        const { bio, skills, skillIds, languages, education, experience, availability, hourlyRate, portfolio, certificates, socialLinks, industry, phoneCode, phoneNumber } = req.body;
        const rawSkillIds = skillIds ?? skills;
        const skillsValue = Array.isArray(rawSkillIds)
            ? rawSkillIds.join(',')
            : rawSkillIds;
        let avatarUrl = undefined;
        if (req.file) {
            avatarUrl = uploadedFileUrl(req.file);
        }
        const combinedPhone = phoneCode && phoneNumber ? `${phoneCode}${phoneNumber}` : undefined;
        const [profile] = await Promise.all([
            prisma.freelancerProfile.upsert({
                where: { userId: req.user.id },
                update: { skills: skillsValue, experience, hourlyRate, industry },
                create: { userId: req.user.id, skills: skillsValue, experience, hourlyRate, industry }
            }),
            prisma.user.update({
                where: { id: req.user.id },
                data: {
                    ...(avatarUrl ? { avatarUrl } : {}),
                    ...(combinedPhone ? { phone: combinedPhone } : {})
                }
            })
        ]);
        const updatedUser = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true, fullName: true, avatarUrl: true, phone: true }
        });
        if (updatedUser) {
            updatedUser.avatarUrl = updatedUser.avatarUrl ? updatedUser.avatarUrl.replace(/^https?:\/\/[^\/]+/i, '') : null;
            const split = splitPhone(updatedUser.phone);
            updatedUser.phoneCode = split.phoneCode;
            updatedUser.phoneNumber = split.phoneNumber;
        }
        return res.json(successResponse('Profile updated successfully'));
    }
    catch (error) {
        next(error);
    }
};
export const uploadAvatar = async (req, res, next) => {
    try {
        return res.json(successResponse('Avatar uploaded', { url: '/uploads/mock-avatar.jpg' }));
    }
    catch (error) {
        next(error);
    }
};
export const uploadCoverImage = async (req, res, next) => {
    try {
        return res.json(successResponse('Cover image uploaded', { url: '/uploads/mock-cover.jpg' }));
    }
    catch (error) {
        next(error);
    }
};
export const uploadResume = async (req, res, next) => {
    try {
        return res.json(successResponse('Resume uploaded', { url: '/uploads/mock-resume.pdf' }));
    }
    catch (error) {
        next(error);
    }
};
export const uploadKyc = async (req, res, next) => {
    try {
        return res.json(successResponse('KYC uploaded', { url: '/uploads/mock-kyc.pdf' }));
    }
    catch (error) {
        next(error);
    }
};
export const getProfileCompletion = async (req, res, next) => {
    try {
        const [user, profile] = await Promise.all([
            prisma.user.findUnique({ where: { id: req.user.id } }),
            prisma.freelancerProfile.findUnique({ where: { userId: req.user.id } })
        ]);
        const steps = [
            { step: 'Basic Info', done: !!user?.fullName },
            { step: 'Bio', done: !!user?.bio },
            { step: 'Skills', done: !!profile?.skills },
            { step: 'Hourly Rate', done: !!profile?.hourlyRate },
            { step: 'Experience Level', done: !!profile?.experience },
            { step: 'Avatar', done: !!user?.avatarUrl }
        ];
        const done = steps.filter(s => s.done).length;
        return res.json(successResponse('Profile completion', { percentage: Math.round((done / steps.length) * 100), steps }));
    }
    catch (error) {
        next(error);
    }
};
