import type { User } from '@/shared/types';

export type UserInterfaceKey =
  | 'super_admin'
  | 'admin'
  | 'officer'
  | 'member_individual'
  | 'member_institutional'
  | 'member_industry';

export interface UserRoleConfig {
  key: UserInterfaceKey;
  roleName: string;
  roleSubtitle: string;
  portalTitle: string;
  badgeLabel: string;
  pillClasses: string;
  dotColor: string;
  heroGradient: string;
  avatarGradient: string;
}

export function getUserInterfaceKey(user: User | null | undefined): UserInterfaceKey {
  if (!user) return 'member_individual';

  if (user.role === 'super_admin') return 'super_admin';
  if (user.role === 'admin') return 'admin';
  if (user.role === 'officer') return 'officer';

  // Explicit memberType takes absolute precedence
  const rawMemberType = user.memberType || (user as any)?.member_type;
  const memberType = typeof rawMemberType === 'string' ? rawMemberType.toLowerCase() : '';
  if (memberType === 'individual' || memberType === 'student' || memberType === 'school') {
    return 'member_individual';
  }
  if (memberType === 'institution') {
    return 'member_institutional';
  }
  if (memberType === 'industry') {
    return 'member_industry';
  }

  // Fallback for accounts missing memberType:
  const sector = user.sector?.toLowerCase();
  const position = user.position?.toLowerCase() || '';
  if (sector === 'institution' && (user.sectorDetails || user.representativeName) && !position.includes('student')) {
    return 'member_institutional';
  }
  if (sector === 'industry' && (user.sectorDetails || user.representativeName)) {
    return 'member_industry';
  }

  return 'member_individual';
}

/**
 * Returns role-tailored presentation configuration (design tokens, gradients, badges, portal titles).
 */
export function getUserRoleConfig(user: User | null | undefined): UserRoleConfig {
  const key = getUserInterfaceKey(user);

  switch (key) {
    case 'super_admin':
      return {
        key: 'super_admin',
        roleName: 'Super Admin',
        roleSubtitle: 'Full Governance & System Administration',
        portalTitle: 'System Governance Portal • Region XII',
        badgeLabel: 'Super Admin',
        pillClasses:
          'bg-purple-50/90 dark:bg-purple-950/50 border border-purple-200/90 dark:border-purple-800/70 text-purple-700 dark:text-purple-300',
        dotColor: 'bg-purple-500',
        heroGradient: 'from-purple-900 via-indigo-900 to-[#060E20]',
        avatarGradient: 'from-purple-600 via-indigo-600 to-blue-500',
      };

    case 'admin':
      return {
        key: 'admin',
        roleName: 'Administrator',
        roleSubtitle: 'System Administration & Management',
        portalTitle: 'Governance Portal • PSITS Region XII',
        badgeLabel: 'Admin',
        pillClasses:
          'bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200/90 dark:border-blue-800/70 text-blue-700 dark:text-cyan-300',
        dotColor: 'bg-blue-500',
        heroGradient: 'from-blue-700 via-indigo-900 to-[#060E20]',
        avatarGradient: 'from-blue-600 via-indigo-600 to-cyan-500',
      };

    case 'officer': {
      const position = user?.position ? user.position.trim() : 'Executive Officer';
      return {
        key: 'officer',
        roleName: 'Executive Officer',
        roleSubtitle: position,
        portalTitle: `Officer Operational Desk • ${position}`,
        badgeLabel: user?.position ? `Officer • ${user.position}` : 'Officer',
        pillClasses:
          'bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200/90 dark:border-amber-800/70 text-amber-800 dark:text-amber-300',
        dotColor: 'bg-amber-500',
        heroGradient: 'from-blue-700 via-slate-900 to-amber-950/60',
        avatarGradient: 'from-amber-500 via-indigo-600 to-blue-600',
      };
    }

    case 'member_institutional': {
      const schoolName = user?.sectorDetails?.trim() || 'Institution Chapter';
      return {
        key: 'member_institutional',
        roleName: 'Institutional Chapter',
        roleSubtitle: schoolName,
        portalTitle: `Institutional Chapter Portal • ${schoolName}`,
        badgeLabel: 'Institution Chapter',
        pillClasses:
          'bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200/90 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300',
        dotColor: 'bg-emerald-500',
        heroGradient: 'from-emerald-700 via-teal-900 to-[#060E20]',
        avatarGradient: 'from-emerald-600 via-teal-600 to-cyan-500',
      };
    }

    case 'member_industry':
      return {
        key: 'member_industry',
        roleName: 'Industry Partner',
        roleSubtitle: user?.sectorDetails?.trim() || 'Corporate Tech Partner',
        portalTitle: 'Industry Partner Portal • PSITS Region XII',
        badgeLabel: 'Industry Partner',
        pillClasses:
          'bg-violet-50/90 dark:bg-violet-950/50 border border-violet-200/90 dark:border-violet-800/70 text-violet-800 dark:text-violet-300',
        dotColor: 'bg-violet-500',
        heroGradient: 'from-violet-800 via-indigo-900 to-[#060E20]',
        avatarGradient: 'from-violet-600 via-indigo-600 to-cyan-500',
      };

    default:
      return {
        key: 'member_individual',
        roleName: 'Student Member',
        roleSubtitle: 'Collegiate Member',
        portalTitle: 'Student Member Portal • Region XII',
        badgeLabel: 'Student Member',
        pillClasses:
          'bg-sky-50/90 dark:bg-blue-950/50 border border-sky-200/90 dark:border-blue-800/70 text-blue-700 dark:text-cyan-300',
        dotColor: 'bg-cyan-400',
        heroGradient: 'from-blue-600 via-indigo-600 to-cyan-600',
        avatarGradient: 'from-blue-600 via-indigo-600 to-cyan-500',
      };
  }
}

export function getUserInterfaceLabel(user: User | null | undefined): string {
  if (!user) return 'Member';
  return getUserRoleConfig(user).badgeLabel;
}

export function getUserDisplayName(
  user:
    | {
        fullName?: string;
        sectorDetails?: string;
        sector?: string;
        memberType?: string;
        representativeName?: string;
      }
    | null
    | undefined
): string {
  if (!user) return 'User';
  const memberType = user.memberType?.toLowerCase();
  if (memberType === 'individual' || memberType === 'student' || memberType === 'school') {
    return user.fullName?.trim() || 'Member';
  }
  if (memberType === 'institution') {
    return (
      user.sectorDetails?.trim() ||
      user.fullName?.trim() ||
      user.representativeName?.trim() ||
      'Institution Member'
    );
  }
  if (memberType === 'industry') {
    return (
      user.sectorDetails?.trim() ||
      user.fullName?.trim() ||
      user.representativeName?.trim() ||
      'Industry Member'
    );
  }
  if (user.sector === 'institution' && (user.sectorDetails || user.representativeName)) {
    return (
      user.sectorDetails?.trim() ||
      user.fullName?.trim() ||
      user.representativeName?.trim() ||
      'Institution Member'
    );
  }
  if (user.sector === 'industry' && (user.sectorDetails || user.representativeName)) {
    return (
      user.sectorDetails?.trim() ||
      user.fullName?.trim() ||
      user.representativeName?.trim() ||
      'Industry Member'
    );
  }
  return (
    user.fullName?.trim() ||
    user.representativeName?.trim() ||
    user.sectorDetails?.trim() ||
    'Member'
  );
}

export function getUserInitial(
  user:
    | {
        fullName?: string;
        sectorDetails?: string;
        sector?: string;
        memberType?: string;
        representativeName?: string;
      }
    | null
    | undefined
): string {
  const name = getUserDisplayName(user);
  return name.charAt(0).toUpperCase() || 'U';
}
