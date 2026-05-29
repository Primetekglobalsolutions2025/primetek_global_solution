import { describe, it, expect } from 'vitest';
import {
  changePasswordSchema,
  clientProfileSchema,
  employeeProfileUpdateSchema,
  fullApplicationSchema,
} from '@/lib/validations';

describe('Validation Schemas — validations.ts', () => {
  describe('changePasswordSchema', () => {
    it('under 12 characters -> fails', () => {
      const res = changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'Short12!',
        confirmPassword: 'Short12!',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('at least 12 characters');
      }
    });

    it('no uppercase letter -> fails', () => {
      const res = changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'shortpass123!',
        confirmPassword: 'shortpass123!',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('uppercase');
      }
    });

    it('no lowercase letter -> fails', () => {
      const res = changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'SHORTPASS123!',
        confirmPassword: 'SHORTPASS123!',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('lowercase');
      }
    });

    it('no number -> fails', () => {
      const res = changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'ShortPassWords!',
        confirmPassword: 'ShortPassWords!',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('number');
      }
    });

    it('no special character -> fails', () => {
      const res = changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'ShortPassword123',
        confirmPassword: 'ShortPassword123',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('special character');
      }
    });

    it('passwords do not match -> fails', () => {
      const res = changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'ValidPass123!',
        confirmPassword: 'DifferentPass123!',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("Passwords don't match");
      }
    });

    it('valid password >= 12 characters -> passes', () => {
      const res = changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'ValidPass123!',
        confirmPassword: 'ValidPass123!',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('clientProfileSchema', () => {
    it('valid complete profile -> passes', () => {
      const res = clientProfileSchema.safeParse({
        client_name: 'Test Client',
        client_company: 'Test Corp',
        client_email: 'client@example.com',
        client_phone: '1234567890',
        client_address: '123 Main St',
        client_role: 'Engineer',
        client_linkedin: 'https://linkedin.com/in/test',
        education_bachelors: 'BS CS',
        education_masters: 'MS CS',
        status: 'pending',
        role_category: 'IT',
      });
      expect(res.success).toBe(true);
    });

    it('missing client_name -> fails', () => {
      const res = clientProfileSchema.safeParse({
        client_company: 'Test Corp',
      });
      expect(res.success).toBe(false);
    });

    it('client_name over 200 characters -> fails', () => {
      const res = clientProfileSchema.safeParse({
        client_name: 'a'.repeat(201),
      });
      expect(res.success).toBe(false);
    });

    it('invalid email format -> fails', () => {
      const res = clientProfileSchema.safeParse({
        client_name: 'Test',
        client_email: 'not-an-email',
      });
      expect(res.success).toBe(false);
    });

    it('invalid LinkedIn URL -> fails', () => {
      const res = clientProfileSchema.safeParse({
        client_name: 'Test',
        client_linkedin: 'not-a-url',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('employeeProfileUpdateSchema', () => {
    it('valid name and phone -> passes', () => {
      const res = employeeProfileUpdateSchema.safeParse({
        name: 'John Doe',
        phone: '+919876543210',
      });
      expect(res.success).toBe(true);
    });

    it('name under 2 chars -> fails', () => {
      const res = employeeProfileUpdateSchema.safeParse({
        name: 'A',
      });
      expect(res.success).toBe(false);
    });

    it('phone with alphabetic characters -> fails', () => {
      const res = employeeProfileUpdateSchema.safeParse({
        name: 'John Doe',
        phone: '123-abc-456',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('fullApplicationSchema', () => {
    it('valid application -> passes', () => {
      const res = fullApplicationSchema.safeParse({
        job_id: 'some-job-id',
        name: 'Applicant',
        email: 'applicant@example.com',
      });
      expect(res.success).toBe(true);
    });

    it('missing job_id -> fails', () => {
      const res = fullApplicationSchema.safeParse({
        name: 'Applicant',
        email: 'applicant@example.com',
      });
      expect(res.success).toBe(false);
    });
  });
});
