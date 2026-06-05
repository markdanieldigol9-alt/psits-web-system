// User Types
export type UserRole = 'super_admin' | 'admin' | 'officer' | 'member';
export type MemberType = 'student' | 'individual' | 'industry' | 'institution';
export type Sector = 'school' | 'industry' | 'institution';

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  contactNumber: string;
  sector: Sector;
  sectorDetails?: string;
  memberType?: MemberType;
  birthdate?: string;
  address?: string;
  gender?: string;
  occupation?: string;
  representativeName?: string;
  representativeName2?: string;
  position?: string;
  representativePosition2?: string;
  companyEmail?: string;
  website?: string;
  membershipMode?: 'new' | 'renew';
  membershipStartedAt?: string | null;
  membershipExpiresAt?: string | null;
  status?: string | null;
  profileImage?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface RegisterData {
  fullName: string;
  email: string;
  contactNumber: string;
  sector: Sector;
  sectorDetails?: string;
  username: string;
  password?: string;
  confirmPassword?: string;
  memberType?: MemberType;
  address?: string;
  gender?: string;
  occupation?: string;
  representativeName?: string;
  representativeName2?: string;
  position?: string;
  representativePosition2?: string;
  companyEmail?: string;
  website?: string;
  membershipMode?: 'new' | 'renew';
  paymentProof?: string; // base64
  referenceNumber?: string;
  termsAccepted?: boolean;
}

// Event Types
export type EventStatus = 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  registrationFee: number;
  capacity: number;
  registeredCount: number;
  status: EventStatus;
  hasStreaming: boolean;
  streamingUrl?: string;
  isEsports?: boolean;
  esportsGame?: string;
  esportsBracketFormat?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  memberId: string;
  registrationDate: Date;
  paymentStatus: 'pending' | 'verified' | 'rejected';
  attended: boolean;
  qrCode?: string;
}

// Payment Types
export type PaymentMethod = 'gcash' | 'paypal' | 'paymaya' | 'bank_transfer';
export type PaymentStatus = 'pending' | 'verified' | 'rejected';

export interface Payment {
  id: string;
  eventId: string;
  memberId: string;
  amount: number;
  method: PaymentMethod;
  proofUrl: string;
  status: PaymentStatus;
  verifiedBy?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Announcement Types
export interface Announcement {
  id: string;
  title: string;
  content: string;
  targetAudience: UserRole[];
  createdBy: string;
  scheduleDate?: Date;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: Date;
}

// Industry Partner Types
export interface IndustryPartner {
  id: string;
  name: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  website?: string;
  agreements?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Reports & Analytics
export interface ReportData {
  totalMembers: number;
  activeMembers: number;
  totalEvents: number;
  totalRevenue: number;
  memberGrowth: Array<{
    date: string;
    count: number;
  }>;
  revenueByMethod: Record<PaymentMethod, number>;
}
