import { z } from 'zod';
const passwordComplexity = z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');
export const loginSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        password: z.string().min(1, 'Password is required'),
        deviceId: z.string().optional(),
        deviceName: z.string().optional(),
        platform: z.enum(['android', 'ios', 'macos', 'web']).optional(),
        fcmToken: z.string().optional(),
        appVersion: z.string().optional()
    })
});
export const registerSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        password: passwordComplexity,
        fullName: z.string().min(2, 'Name must be at least 2 characters'),
        role: z.enum(['freelancer', 'client', 'investor', 'founder']),
        phone: z.string().min(6, 'Phone number is too short').optional(),
        countryCode: z.string().min(2, 'Country code is invalid').optional(),
        deviceId: z.string().optional(),
        deviceName: z.string().optional(),
        platform: z.enum(['android', 'ios', 'macos', 'web']).optional(),
        fcmToken: z.string().optional(),
        appVersion: z.string().optional()
    })
});
export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address')
    })
});
export const resetPasswordSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        otp: z.string().min(1, 'OTP is required'),
        newPassword: passwordComplexity
    })
});
export const changePasswordSchema = z.object({
    body: z.object({
        oldPassword: z.string().min(1, 'Old password is required'),
        newPassword: passwordComplexity
    })
});
export const updateProfileSchema = z.object({
    body: z.object({
        fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
        phone: z.string().optional(),
        country: z.string().optional(),
        city: z.string().optional(),
        location: z.string().optional(),
        headline: z.string().optional(),
        bio: z.string().optional(),
        skills: z.union([z.array(z.string()), z.string()]).optional(),
        skillIds: z.union([z.array(z.string()), z.string()]).optional(),
        category: z.string().optional(),
        categoryId: z.string().optional(),
    }),
});
export const sendOtpSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address').optional(),
        phone: z.string().optional(),
        countryCode: z.string().optional(),
        mobile: z.string().optional(),
    }).refine((data) => !!(data.email || data.phone || data.mobile), {
        message: 'Either email, phone, or mobile is required',
        path: ['email'],
    }),
});
export const verifyOtpSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address').optional(),
        phone: z.string().optional(),
        countryCode: z.string().optional(),
        mobile: z.string().optional(),
        code: z.string().optional(),
        otp: z.string().optional(),
    }),
});
