const { z } = require('zod');

const phoneNumberSchema = z
    .string()
    .regex(/^\d{7,15}$/, 'Phone number must be 7 to 15 digits');

const registerSchema = z.object({
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    whatsapp_country_code: z.string().min(1, 'WhatsApp country code is required'),
    whatsapp_number: phoneNumberSchema,
    business_or_alternative_country_code: z.string().optional(),
    business_or_alternative_number: z.union([phoneNumberSchema, z.literal('')]).optional(),
    roles: z.array(z.enum(['freelancer', 'client', 'investor', 'startup_creator', 'admin'])).optional(),
    categories: z.array(z.string()).optional(),
    location: z.string().optional(),
    work_preference: z.string().optional(),
    experience_level: z.string().optional(),
    availability: z.string().optional(),
    budget_range: z.string().optional(),
    subscription_plan: z.string().optional()
});

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters')
});

module.exports = {
    registerSchema,
    loginSchema
};
