import { z } from 'zod';

export const inquirySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  company: z.string().optional(),
  phone: z.string().optional(),
  requirement: z.string().min(10, 'Please describe your requirement (min 10 characters)'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const jobSchema = z.object({
  title: z.string().min(3, 'Job title is required'),
  department: z.string().min(1, 'Department is required'),
  location: z.string().min(1, 'Location is required'),
  type: z.enum(['full-time', 'contract', 'remote', 'part-time']),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  requirements: z.string().min(10, 'Requirements must be at least 10 characters'),
  salary_range: z.string().optional(),
  is_active: z.boolean().optional().default(true),
});

export const applicationSchema = z.object({
  job_id: z.string().min(1, 'Job ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  experience_years: z.number().min(0).max(50).optional(),
  cover_letter: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(12, 'New password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});


export const fullApplicationSchema = z.object({
  job_id: z.string().min(1, 'Please select a job'),
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  experience_years: z.any().optional(),
  
  // Profile Details
  client_address: z.string().optional(),
  client_role: z.string().optional(),
  client_linkedin: z.string().optional(),
  role_category: z.enum(['IT', 'Non-IT']).optional().default('IT'),
  education_bachelors: z.string().optional(),
  education_masters: z.string().optional(),
  
  // Assignment
  assigned_to: z.string().optional(),
});


export type InquiryFormData = z.infer<typeof inquirySchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type JobFormData = z.input<typeof jobSchema>;
export type ApplicationFormData = z.input<typeof applicationSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type FullApplicationFormData = z.input<typeof fullApplicationSchema>;

/**
 * Client profile schema for create/update operations.
 * Prevents mass-assignment by only allowing known fields.
 */
export const clientProfileSchema = z.object({
  application_id: z.string().uuid().optional(),
  client_name: z.string().min(1, 'Client name is required').max(200),
  client_company: z.string().max(200).optional().nullable(),
  client_email: z.string().email('Invalid email').optional().nullable(),
  client_phone: z.string().max(30).optional().nullable(),
  client_address: z.string().max(500).optional().nullable(),
  client_role: z.string().max(100).optional().nullable(),
  client_linkedin: z.string().url().optional().nullable().or(z.literal('')),
  education_bachelors: z.string().max(300).optional().nullable(),
  education_masters: z.string().max(300).optional().nullable(),
  resume_url: z.string().url().optional().nullable().or(z.literal('')),
  status: z.enum(['assigned', 'processing', 'completed', 'rejected', 'pending']).optional(),
  role_category: z.enum(['IT', 'Non-IT']).optional().default('IT'),
  assigned_to: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type ClientProfileFormData = z.infer<typeof clientProfileSchema>;

export const employeeProfileUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be under 100 characters'),
  phone: z.string().max(30, 'Phone number must be under 30 characters').regex(/^[+0-9\s-]*$/, 'Invalid phone number format').optional().or(z.literal('')),
});

export type EmployeeProfileUpdateData = z.infer<typeof employeeProfileUpdateSchema>;

export const leaveBalancesSchema = z.object({
  sick: z.number().int('Sick balance must be an integer').nonnegative('Sick balance cannot be negative').max(365, 'Sick balance cannot exceed 365 days'),
  casual: z.number().int('Casual balance must be an integer').nonnegative('Casual balance cannot be negative').max(365, 'Casual balance cannot exceed 365 days'),
  earned: z.number().int('Earned balance must be an integer').nonnegative('Earned balance cannot be negative').max(365, 'Earned balance cannot exceed 365 days'),
});

export type LeaveBalancesData = z.infer<typeof leaveBalancesSchema>;

