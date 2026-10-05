import type { User } from '@/shared/types';

export type UserInterfaceKey =
  | 'super_admin'
  | 'admin'
  | 'officer'
  | 'member_individual'
  | 'member_institutional'
  | 'member_industry';

export function getUserInterfaceKey(user: User | null | undefined): UserInterfaceKey {
  if (!user) return 'member_individual';

  if (user.role === 'super_admin') return 'super_admin';
  if (user.role === 'admin') return 'admin';
  if (user.role === 'officer') return 'officer';

  if (user.memberType === 'institution') return 'member_institutional';
  if (user.memberType === 'industry') return 'member_industry';
  return 'member_individual';
}

export function getUserInterfaceLabel(user: User | null | undefined): string {
  const key = getUserInterfaceKey(user);
  switch (key) {
    case 'super_admin':
      return 'Admin';
    case 'admin':
      return 'Admin';
    case 'officer':
      return 'Officer';
    case 'member_institutional':
      return 'Member Institutional';
    case 'member_industry':
      return 'Member Industry';
    default:
      return 'Member Individual';
  }
}

export function getUserDisplayName(user: { fullName?: string; sectorDetails?: string; memberType?: string; representativeName?: string } | null | undefined): string {
  if (!user) return 'User';
  if (user.memberType === 'institution') {
    return user.sectorDetails?.trim() || user.fullName?.trim() || user.representativeName?.trim() || 'Institution Member';
  }
  if (user.memberType === 'industry') {
    return user.sectorDetails?.trim() || user.fullName?.trim() || user.representativeName?.trim() || 'Industry Member';
  }
  return user.fullName?.trim() || user.representativeName?.trim() || user.sectorDetails?.trim() || 'Member';
}

export function getUserInitial(user: { fullName?: string; sectorDetails?: string; memberType?: string; representativeName?: string } | null | undefined): string {
  const name = getUserDisplayName(user);
  return name.charAt(0).toUpperCase() || 'U';
}


