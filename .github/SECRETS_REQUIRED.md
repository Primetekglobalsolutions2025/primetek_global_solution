# Secrets and Branch Protection Configuration

This document outlines the required GitHub Secrets and Repository Branch Protection settings needed to fully configure the CI/CD pipeline for the Next.js HR portal.

---

## Required GitHub Secrets

Configure the following secrets under **Settings → Secrets and variables → Actions → Repository secrets** in your GitHub repository:

| Secret Name | Description | Where to get it |
| :--- | :--- | :--- |
| **TEST_SUPABASE_URL** | Supabase URL for test project | Supabase dashboard → Project Settings → API |
| **TEST_SUPABASE_ANON_KEY** | Anon key for test project | Supabase dashboard → Project Settings → API |
| **TEST_SUPABASE_SERVICE_ROLE_KEY** | Service role key for test project | Supabase dashboard → Project Settings → API |
| **TEST_JWT_SECRET** | JWT secret for test environment | Generate: `openssl rand -base64 32` |
| **TEST_CRON_SECRET** | Cron secret for test environment | Generate: `openssl rand -base64 32` |
| **NEXT_PUBLIC_GEOAPIFY_API_KEY** | Geoapify map tiles API key | [geoapify.com](https://www.geoapify.com) → My Projects |
| **VERCEL_TOKEN** | Vercel deployment token | [vercel.com](https://vercel.com) → Settings → Tokens |
| **VERCEL_ORG_ID** | Vercel organization ID | [vercel.com](https://vercel.com) → Settings → General |
| **VERCEL_PROJECT_ID** | Vercel project ID | [vercel.com](https://vercel.com) → Project → Settings → General |

### Important Environmental Guidelines

1. **Test Environment Isolation (`TEST_*`)**:
   - All `TEST_*` secrets must use a separate test Supabase project (not production or local staging). This corresponds to the variables in `.env.test`.
   - Running test suites modifies database state, so deploying to or testing on production/live databases is highly dangerous.

2. **Production Environment Credentials**:
   - Production Supabase credentials are managed directly within Vercel's environment variables dashboard (`vercel.com` → Project Settings → Environment Variables), not via GitHub Secrets.
   - Vercel CLI builds pull configuration securely from the environment using `vercel pull`.

3. **Git Cleanliness**:
   - Never commit or push local environment files (`.env.local`, `.env.production.local`, etc.) to the Git repository. These are explicitly ignored by `.gitignore`.

---

## Branch Protection Rules for `main`

To prevent untested code from reaching production, enforce strict status checks and PR workflows on the `main` branch:

1. Navigate to the GitHub repository **Settings**.
2. Click **Branches** on the left menu.
3. Click **Add branch ruleset** or **Add rule** for the `main` branch.
4. Apply the following configurations:
   - **Branch pattern name**: `main`
   - **Require a pull request before merging**:
     - Enable this option to ensure all additions are peer-reviewed.
   - **Require status checks to pass before merging**:
     - Enable this option.
     - Search and select the following status checks:
       - `lint-and-typecheck` (defined in `ci.yml`)
       - `unit-and-integration-tests` (defined in `ci.yml`)
       - `build-check` (defined in `ci.yml`)
       - `e2e-tests` (defined in `e2e.yml`)
     - **Require branches to be up to date before merging**: Enable this to prevent merge conflicts.
   - **Do not allow bypassing the above settings**: Ensure administrators are subject to the same test rules.
