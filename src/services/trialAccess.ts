// src/services/trialAccess.ts
// Helper functions to check trial access and limits

interface TrialLimitCheck {
  hasAccess: boolean;
  remaining?: number;
  limit?: number;
  isUnlimited: boolean;
}

interface UserWithPlan {
  plan?: string;
  packages?: string[];
  trialActive?: boolean;
  trialEndsAt?: string;
  trialLimits?: {
    coverLetters?: number;
    recruiterLookups?: number;
    savedJobs?: number;
  };
}

/**
 * Check if user has active trial access
 */
export function hasTrialAccess(user: UserWithPlan): boolean {
  // If user has a plan, they don't need trial access
  if (user.plan && user.plan !== 'none') {
    return false;
  }

  // Check if trial is active
  if (!user.trialActive) {
    return false;
  }

  // Check if trial has expired
  if (!user.trialEndsAt) {
    return false;
  }

  const trialEndsAt = new Date(user.trialEndsAt);
  const now = new Date();
  
  return trialEndsAt > now;
}

/**
 * Check if user has access to cover letter generation
 */
export async function checkCoverLetterAccess(user: UserWithPlan, userId: number): Promise<TrialLimitCheck> {
  // Check if user has a paid plan
  const packagesArr = Array.isArray(user.packages) ? user.packages : [];
  const entitled = packagesArr.includes('find-track') || packagesArr.includes('fast-track');
  
  if (entitled) {
    return { hasAccess: true, isUnlimited: true };
  }

  // Check if user has trial access
  if (hasTrialAccess(user)) {
    const limit = user.trialLimits?.coverLetters || 10;
    
    // Count existing cover letters for this user
    const count = await strapi.db.query('api::cover-letter.cover-letter').count({
      where: { user: userId }
    });
    
    const remaining = Math.max(0, limit - count);
    
    return {
      hasAccess: remaining > 0,
      remaining,
      limit,
      isUnlimited: false
    };
  }

  // No access
  return { hasAccess: false, isUnlimited: false };
}

/**
 * Check if user has access to recruiter lookups
 */
export async function checkRecruiterLookupAccess(user: UserWithPlan, userId: number): Promise<TrialLimitCheck> {
  // Check if user has a paid plan
  const packagesArr = Array.isArray(user.packages) ? user.packages : [];
  const entitled = packagesArr.includes('find-track') || packagesArr.includes('fast-track');
  
  if (entitled) {
    return { hasAccess: true, isUnlimited: true };
  }

  // Check if user has trial access
  if (hasTrialAccess(user)) {
    const limit = user.trialLimits?.recruiterLookups || 10;
    
    // Count existing recruiter lookups for this user
    const count = await strapi.db.query('api::linkedin-recruiter.linkedin-recruiter').count({
      where: { owner: userId }
    });
    
    const remaining = Math.max(0, limit - count);
    
    return {
      hasAccess: remaining > 0,
      remaining,
      limit,
      isUnlimited: false
    };
  }

  // No access
  return { hasAccess: false, isUnlimited: false };
}

/**
 * Check if user can save more jobs
 */
export async function checkSavedJobsAccess(user: UserWithPlan, userId: number): Promise<TrialLimitCheck> {
  // Check if user has a paid plan
  const packagesArr = Array.isArray(user.packages) ? user.packages : [];
  const entitled = packagesArr.includes('find-track') || packagesArr.includes('fast-track');
  
  if (entitled) {
    return { hasAccess: true, isUnlimited: true };
  }

  // Check if user has trial access
  if (hasTrialAccess(user)) {
    const limit = user.trialLimits?.savedJobs || 20;
    
    // Count existing saved jobs for this user
    const count = await strapi.db.query('api::saved-job.saved-job').count({
      where: { owner: userId }
    });
    
    const remaining = Math.max(0, limit - count);
    
    return {
      hasAccess: remaining > 0,
      remaining,
      limit,
      isUnlimited: false
    };
  }

  // No access
  return { hasAccess: false, isUnlimited: false };
}

