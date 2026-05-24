import type { User } from '@/shared/types';

const SUPER_ADMIN_CREDENTIALS = {
  email: 'admin@psits.com',
  password: 'AdminPsits@123',
};

const SUPER_ADMIN_USER: User = {
  id: 'super-admin-001',
  email: 'admin@psits.com',
  username: 'admin',
  fullName: 'Super Admin / Head',
  role: 'super_admin',
  contactNumber: '09123456789',
  sector: 'institution',
  memberType: 'institution',
  profileImage: undefined,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Initialize super admin account in database/storage
 * This function creates the initial super admin account
 */
export const initializeSuperAdmin = async () => {
  try {
    // Store in localStorage for now (for development)
    const superAdminAccounts = localStorage.getItem('_admin_accounts');
    const accounts = superAdminAccounts ? JSON.parse(superAdminAccounts) : [];

    // Check if super admin already exists
    const adminExists = accounts.some((acc: any) => acc.email === SUPER_ADMIN_CREDENTIALS.email);

    if (!adminExists) {
      accounts.push({
        ...SUPER_ADMIN_CREDENTIALS,
        user: SUPER_ADMIN_USER,
      });
      localStorage.setItem('_admin_accounts', JSON.stringify(accounts));
      console.log('✓ Super Admin account initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing super admin:', error);
  }
};

/**
 * Verify super admin credentials
 */
export const verifySuperAdminCredentials = (email: string, password: string): User | null => {
  if (email === SUPER_ADMIN_CREDENTIALS.email && password === SUPER_ADMIN_CREDENTIALS.password) {
    return SUPER_ADMIN_USER;
  }
  
  // Check if there are other registered admin accounts
  try {
    const superAdminAccounts = localStorage.getItem('_admin_accounts');
    if (superAdminAccounts) {
      const accounts = JSON.parse(superAdminAccounts);
      const account = accounts.find((acc: any) => acc.email === email && acc.password === password);
      if (account) {
        return account.user;
      }
    }
  } catch (error) {
    console.error('Error verifying credentials:', error);
  }

  return null;
};

/**
 * Get all admin accounts
 */
export const getAdminAccounts = () => {
  try {
    const superAdminAccounts = localStorage.getItem('_admin_accounts');
    return superAdminAccounts ? JSON.parse(superAdminAccounts) : [];
  } catch (error) {
    console.error('Error getting admin accounts:', error);
    return [];
  }
};

/**
 * Check if email exists as admin
 */
export const isAdminEmail = (email: string): boolean => {
  return email === SUPER_ADMIN_CREDENTIALS.email || getAdminAccounts().some((acc: any) => acc.email === email);
};

/**
 * Remove all persisted data and reinitialize system
 */
export const resetSystem = () => {
  try {
    // Clear only the keys we know this app uses
    localStorage.removeItem('_admin_accounts');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    // any other keys (e.g. for members) can be cleared or left to the browser
    console.log('System storage cleared');
  } catch (err) {
    console.error('Error resetting system:', err);
  }
  // re-seed super admin
  initializeSuperAdmin();
};

/**
 * Ensure the system has required baseline data (super admin, etc.)
 * Call this on application startup.
 */
export const initializeSystem = async () => {
  await initializeSuperAdmin();
  // future seeds (members, events, etc.) can go here
};
