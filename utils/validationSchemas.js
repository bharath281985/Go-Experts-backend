const { z } = require('zod');

const registerSchema = z.object({
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    roles: z.array(z.enum(['freelancer', 'client'])).optional(),
    categories: z.array(z.string()).optional(),
    location: z.string().optional(),
    work_preference: z.string().optional(),
    experience_level: z.string().optional(),
    availability: z.string().optional(),
    budget_range: z.string().optional()
});

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters')
});

module.exports = {
    registerSchema,
    loginSchema
};
