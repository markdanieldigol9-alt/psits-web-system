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
  suspendedReason?: string | null;
  avatarUrl?: string | null;
  profileImage?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfficerContact {
  id: string;
  fullName: string;
  email: string;
  role: string;
  position?: string;
  contactNumber?: string;
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
  paymentMethod?: string;
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
  bannerUrl?: string;
  themeColor?: string;
  customBadge?: string;
  requiresCoach?: boolean;
  hasModerator?: boolean;
  moderatorOfficerId?: string | null;
  moderatorOfficerName?: string | null;
  moderatorIds?: string[];
  moderatorNames?: string | null;
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
export type PaymentMethod = 'through_officer' | 'bank_transfer' | 'cheque' | 'gcash' | 'cash_officer' | 'paymaya' | 'paypal' | string;
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
  meta?: Record<string, any> | null;
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

// Event Institution Delegation Leaderboard Types
export interface EventLeaderboardParticipant {
  id: string;
  participantKey?: string;
  fullName: string;
  email?: string;
  contactNumber?: string;
  gender?: string;
  position?: string;
  status?: string;
  isCheckedIn?: boolean;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
}

export interface EventWinnerRecord {
  id: string;
  eventId: string;
  rankPosition: number;
  awardTitle: string;
  institutionName: string;
  participantName: string;
  points: number;
  scoreOrNotes?: string;
  createdAt?: string;
}

export interface OverallCompetitionStanding {
  rank: number;
  institutionName: string;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  totalMedals: number;
  totalPoints: number;
  eventsWonCount: number;
  inVenueAttendees?: number;
  isOverallChampion?: boolean;
  awards?: Array<{
    id: string;
    eventId: string;
    eventTitle: string;
    eventType?: string;
    rankPosition: number;
    awardTitle: string;
    participantName: string;
    points: number;
    scoreOrNotes?: string;
  }>;
}

export interface EventAttendanceParticipant {
  participantKey: string;
  registrationSource: string;
  recordId: number | string;
  fullName: string;
  email?: string;
  contactNumber?: string;
  institutionName: string;
  position?: string;
  registrationStatus: string;
  isCheckedIn: boolean;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  registeredAt?: string | null;
}

export type AttendanceTimeAction = 'time_in' | 'time_out' | 'undo_time_out' | 'auto_time_out' | 'reset';

export interface EventAttendanceSchedule {
  startAt?: string | null;
  endAt?: string | null;
  timeInOpensAt?: string | null;
  timeInOpensBeforeMinutes: number;
  lateGraceMinutes: number;
}

export interface EventAttendanceBreakdown {
  institutionName: string;
  registeredCount: number;
  checkedInCount: number;
  attendanceRate: number;
}

export interface EventAttendanceData {
  event: {
    id: string;
    title: string;
    status: string;
    location?: string;
    startAt?: string;
    endAt?: string;
    capacity?: number;
    themeColor?: string;
  };
  summary: {
    totalRegistered: number;
    totalCheckedIn: number;
    notCheckedIn: number;
    currentlyInVenue?: number;
    totalTimedOut?: number;
    totalLate?: number;
    attendanceRate: number;
    totalInstitutions: number;
  };
  schedule?: EventAttendanceSchedule;
  institutionBreakdown: EventAttendanceBreakdown[];
  participants: EventAttendanceParticipant[];
}

export interface EventLeaderboardInstitution {
  rank: number;
  institutionId: string;
  institutionName: string;
  institutionEmail?: string;
  institutionAvatar?: string | null;
  registrationId?: string | null;
  registeredCount: number;
  checkedInCount?: number;
  attendanceRate?: number;
  participants: EventLeaderboardParticipant[];
}

export interface EventLeaderboardSummary {
  totalInstitutions: number;
  totalRegisteredParticipants: number;
  totalCheckedInParticipants?: number;
  overallAttendanceRate?: number;
}

export interface InstitutionLeaderboardData {
  events: Array<{
    id: string;
    title: string;
    date: string;
    time?: string;
    location?: string;
    status: string;
  }>;
  selectedEvent: {
    id: string;
    title: string;
    date: string;
    time?: string;
    startAt?: string | null;
    endAt?: string | null;
    location?: string;
    status: string;
  } | null;
  summary: EventLeaderboardSummary;
  leaderboard: EventLeaderboardInstitution[];
  eventWinners?: EventWinnerRecord[];
  overallStandings?: OverallCompetitionStanding[];
}

