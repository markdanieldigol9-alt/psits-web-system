import axios from 'axios';
import type { AxiosInstance } from 'axios';

// In dev, Vite can proxy `/api` to the Node server (see `PSITS/vite.config.ts`).
// In prod, set `VITE_API_URL` if the API is hosted elsewhere.
const getApiBaseUrl = () => {
  const fromEnv = (import.meta as any)?.env?.VITE_API_URL;
  if (fromEnv) return String(fromEnv).trim();
  const fromGlobal = (globalThis as any).__VITE_API_URL__;
  if (fromGlobal) return String(fromGlobal).trim();
  return '';
};

const API_BASE_URL = getApiBaseUrl() || '/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle responses and errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        
        if (error.response?.data?.message) {
          error.message = error.response.data.message;
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Authentication
  login(email: string, password: string) {
    return this.client.post('/auth/login', { email, password });
  }

  verifyPassword(password: string) {
    return this.client.post('/auth/verify-password', { password });
  }

  register(data: any) {
    return this.client.post('/auth/register', data);
  }

  renewLookup(data: { renewAccountId: string; contactNumber: string }) {
    return this.client.post('/auth/renew-lookup', data);
  }

  logout() {
    return this.client.post('/auth/logout');
  }

  // Admin Account Management
  createSuperAdmin(email: string, password: string, fullName: string) {
    return this.client.post('/auth/create-admin', { 
      email, 
      password, 
      fullName,
      role: 'super_admin'
    });
  }

  createAdmin(data: any) {
    return this.client.post('/auth/create-admin', data);
  }

  // Profile
  getMe() {
    return this.client.get('/me');
  }

  updateMe(data: any) {
    return this.client.put('/me', data);
  }

  uploadAvatar(file: File) {
    return this.client.post('/uploads/avatar', file, {
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        'x-filename': encodeURIComponent(file.name),
      },
    });
  }

  // Users/Members
  getMembers(filters?: any) {
    return this.client.get('/members', { params: filters });
  }

  getMember(id: string) {
    return this.client.get(`/members/${id}`);
  }

  getMemberDetails(id: string) {
    return this.client.get(`/members/${id}/details`);
  }

  createMember(data: any) {
    return this.client.post('/members', data);
  }

  updateMember(id: string, data: any) {
    return this.client.put(`/members/${id}`, data);
  }

  changeMemberStatus(id: string, status: string, reason?: string) {
    return this.client.post(`/members/${id}/status`, { status, reason });
  }

  getMemberStatusLogs(id: string) {
    return this.client.get(`/members/${id}/status-logs`);
  }

  deleteMember(id: string) {
    return this.client.delete(`/members/${id}`);
  }

  resendApprovalEmail(id: string) {
    return this.client.post(`/members/${id}/resend-approval-email`);
  }

  /** Fetch list of officers (optional status filter: 'active', 'past', 'all') */
  getOfficers(status?: string) {
    return this.client.get('/officers', { params: status ? { status } : undefined });
  }

  /** Assign a member user to an officer position */
  assignOfficer(userId: string, position: string, startDate?: string, endDate?: string) {
    return this.client.post('/officers/assign', { userId, position, startDate, endDate });
  }

  /** Create new officer account directly */
  createOfficer(data: any) {
    return this.client.post('/officers', data);
  }

  /** Update existing officer details or position */
  updateOfficer(id: string, data: any) {
    return this.client.put(`/officers/${id}`, data);
  }

  /** Archive officer (reverts role back to member) */
  deleteOfficer(id: string) {
    return this.client.delete(`/officers/${id}`);
  }

  // Officer Positions
  /** Fetch all dynamic officer positions for assignment and election forms */
  getOfficerPositions() {
    return this.client.get('/officer-positions');
  }

  /** Create a new dynamic officer position title (Admin only) */
  createOfficerPosition(data: { name: string; description?: string }) {
    return this.client.post('/officer-positions', data);
  }

  /** Delete a custom officer position title (Admin only) */
  deleteOfficerPosition(id: string | number) {
    return this.client.delete(`/officer-positions/${id}`);
  }

  // Events
  getEvents(filters?: any) {
    return this.client.get('/events', { params: filters });
  }

  getEvent(id: string) {
    return this.client.get(`/events/${id}`);
  }

  createEvent(data: any) {
    return this.client.post('/events', data);
  }

  updateEvent(id: string, data: any) {
    return this.client.put(`/events/${id}`, data);
  }

  deleteEvent(id: string) {
    return this.client.delete(`/events/${id}`);
  }

  // Live Events
  getLiveEvents(filters?: any) {
    return this.client.get('/live-events', { params: filters });
  }

  getLiveSessions(filters?: any) {
    return this.client.get('/live-sessions', { params: filters });
  }

  getLiveEventsByEvent(eventId: string) {
    return this.client.get(`/events/${eventId}/live-sessions`);
  }

  getLiveSession(id: string) {
    return this.client.get(`/live-sessions/${id}`);
  }

  getLiveEvent(id: string) {
    return this.client.get(`/live-events/${id}`);
  }

  createLiveEvent(data: any) {
    return this.client.post('/live-events', data);
  }

  createLiveSession(data: any) {
    return this.client.post('/live-sessions', data);
  }

  updateLiveEvent(id: string, data: any) {
    return this.client.put(`/live-events/${id}`, data);
  }

  updateLiveSession(id: string, data: any) {
    return this.client.put(`/live-sessions/${id}`, data);
  }

  deleteLiveEvent(id: string) {
    return this.client.delete(`/live-events/${id}`);
  }

  deleteLiveSession(id: string) {
    return this.client.delete(`/live-sessions/${id}`);
  }

  startLiveEvent(id: string) {
    return this.client.post(`/live-events/${id}/start`);
  }

  startLiveSession(id: string) {
    return this.client.post(`/live-sessions/${id}/start`);
  }

  endLiveEvent(id: string) {
    return this.client.post(`/live-events/${id}/end`);
  }

  endLiveSession(id: string) {
    return this.client.post(`/live-sessions/${id}/end`);
  }

  cancelLiveEvent(id: string) {
    return this.client.post(`/live-events/${id}/cancel`);
  }

  cancelLiveSession(id: string) {
    return this.client.post(`/live-sessions/${id}/cancel`);
  }

  joinLiveEvent(id: string) {
    return this.client.post(`/live-events/${id}/join`);
  }

  joinLiveSession(id: string) {
    return this.client.post(`/live-sessions/${id}/join`);
  }

  leaveLiveEvent(id: string) {
    return this.client.post(`/live-events/${id}/leave`);
  }

  getLiveEventParticipants(id: string) {
    return this.client.get(`/live-events/${id}/participants`);
  }

  updateLiveEventParticipant(id: string, userId: string, data: any) {
    return this.client.put(`/live-events/${id}/participants/${userId}`, data);
  }

  updateLiveEventPermissions(id: string, data: any) {
    return this.client.put(`/live-events/${id}/permissions`, data);
  }

  getLiveEventChatMessages(id: string) {
    return this.client.get(`/live-events/${id}/chat`);
  }

  createLiveEventChatMessage(id: string, message: string) {
    return this.client.post(`/live-events/${id}/chat`, { message });
  }

  validateLiveEventRoomCode(roomCode: string) {
    return this.client.post('/live-events/validate-room-code', { roomCode });
  }

  getLiveEventCounts(id: string) {
    return this.client.get(`/live-events/${id}/counts`);
  }

  async uploadLiveEventRecording(id: string, file: File, onProgress?: (pct: number) => void) {
    const buffer = await file.arrayBuffer();
    return this.client.put(`/live-events/${id}/recording`, buffer, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': file.name,
      },
      onUploadProgress: (evt) => {
        if (!onProgress) return;
        const total = evt.total || file.size || 0;
        if (!total) return;
        onProgress(Math.round((evt.loaded / total) * 100));
      },
    });
  }

  downloadLiveEventRecording(id: string) {
    return this.client.get(`/live-events/${id}/recording/download`, { responseType: 'blob' });
  }

  // Event Registration
  registerForEvent(eventId: string, data: any) {
    return this.client.post(`/events/${eventId}/register`, data);
  }

  getEventRegistrations(eventId: string) {
    return this.client.get(`/events/${eventId}/registrations`);
  }

  getMyEventRegistrations() {
    return this.client.get('/events/registrations/my');
  }

  approveEventRegistration(registrationId: string, data: any) {
    return this.client.put(`/events/registrations/${registrationId}/approval`, data);
  }

  // Payments
  getPayments(filters?: any) {
    return this.client.get('/payments', { params: filters });
  }

  uploadPaymentProof(dataUrl: string) {
    return this.client.post('/uploads/payment-proof', { dataUrl });
  }

  uploadTeamProfile(dataUrl: string, fileName?: string) {
    return this.client.post('/uploads/team-profile', { dataUrl, fileName });
  }

  uploadAnnouncementImage(dataUrl: string) {
    return this.client.post('/uploads/announcement-image', { dataUrl });
  }

  uploadEventBanner(dataUrl: string) {
    return this.client.post('/uploads/event-banner', { dataUrl });
  }

  createPayment(data: any) {
    return this.client.post('/payments', data);
  }

  submitPayment(eventId: string, data: any) {
    return this.client.post(`/events/${eventId}/payment`, data);
  }

  verifyPayment(paymentId: string, data: any) {
    return this.client.put(`/payments/${paymentId}/verify`, data);
  }

  getPaymentStatusLogs(paymentId: string) {
    return this.client.get(`/payments/${paymentId}/logs`);
  }

  // Announcements
  getAnnouncements() {
    return this.client.get('/announcements');
  }

  createAnnouncement(data: any) {
    return this.client.post('/announcements', data);
  }

  updateAnnouncement(id: string, data: any) {
    return this.client.put(`/announcements/${id}`, data);
  }

  deleteAnnouncement(id: string) {
    return this.client.delete(`/announcements/${id}`);
  }

  // Announcement interactions
  getAnnouncementComments(announcementId: string) {
    return this.client.get(`/announcements/${announcementId}/comments`);
  }

  createAnnouncementComment(announcementId: string, content: string) {
    return this.client.post(`/announcements/${announcementId}/comments`, { content });
  }

  deleteAnnouncementComment(announcementId: string, commentId: string) {
    return this.client.delete(`/announcements/${announcementId}/comments/${commentId}`);
  }

  getAnnouncementLikes(announcementId: string) {
    return this.client.get(`/announcements/${announcementId}/likes`);
  }

  setAnnouncementLike(announcementId: string, like: boolean) {
    return this.client.post(`/announcements/${announcementId}/likes`, { like });
  }

  // Industry Partners
  getPartners() {
    return this.client.get('/partners');
  }

  createPartner(data: any) {
    return this.client.post('/partners', data);
  }

  updatePartner(id: string, data: any) {
    return this.client.put(`/partners/${id}`, data);
  }

  deletePartner(id: string) {
    return this.client.delete(`/partners/${id}`);
  }

  getPartnerContributions(partnerId: string) {
    return this.client.get(`/partners/${partnerId}/contributions`);
  }

  createPartnerContribution(partnerId: string, data: any) {
    return this.client.post(`/partners/${partnerId}/contributions`, data);
  }

  updatePartnerContribution(contributionId: string, data: any) {
    return this.client.put(`/partners/contributions/${contributionId}`, data);
  }

  deletePartnerContribution(contributionId: string) {
    return this.client.delete(`/partners/contributions/${contributionId}`);
  }

  // Reports
  getReports(type: string, filters?: any) {
    return this.client.get(`/reports/${type}`, { params: filters });
  }

  getElectionReport(id: string) {
    return this.client.get(`/reports/elections/${id}`);
  }

  getPartnerContributionsReport() {
    return this.client.get('/reports/partners/contributions');
  }

  // Audit logs
  getAuditLogs(filters?: any) {
    return this.client.get('/audit-logs', { params: filters });
  }

  // Institution Members
  getInstitutionMembers(filters?: any) {
    return this.client.get('/institution-members', { params: filters });
  }

  bulkUploadInstitutionMembers(members: any[]) {
    return this.client.post('/institution-members/bulk', { members });
  }

  approveInstitutionMember(id: string, data: any) {
    return this.client.put(`/institution-members/${id}/approval`, data);
  }

  // Elections
  getElections(filters?: any) {
    return this.client.get('/elections', { params: filters });
  }

  getElection(id: string) {
    return this.client.get(`/elections/${id}`);
  }

  createElection(data: any) {
    return this.client.post('/elections', data);
  }

  updateElection(id: string, data: any) {
    return this.client.put(`/elections/${id}`, data);
  }

  addElectionCandidate(electionId: string, data: any) {
    return this.client.post(`/elections/${electionId}/candidates`, data);
  }

  updateElectionCandidate(electionId: string, candidateId: string, data: any) {
    return this.client.put(`/elections/${electionId}/candidates/${candidateId}`, data);
  }

  markElectionWinner(electionId: string, candidateId: string) {
    return this.client.post(`/elections/${electionId}/candidates/${candidateId}/winner`);
  }

  checkVoted(electionId: string) {
    return this.client.get(`/elections/${electionId}/voted`);
  }

  castVote(electionId: string, votes: Record<string, string>) {
    return this.client.post(`/elections/${electionId}/vote`, { votes });
  }

  deleteElection(id: string) {
    return this.client.delete(`/elections/${id}`);
  }

  deleteElectionCandidate(electionId: string, candidateId: string) {
    return this.client.delete(`/elections/${electionId}/candidates/${candidateId}`);
  }

  uploadForumVideo(file: File) {
    return this.client.post('/uploads/forum-video', file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-filename': encodeURIComponent(file.name),
      },
    });
  }

  uploadForumImage(file: File) {
    return this.client.post('/uploads/forum-image', file, {
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        'x-filename': encodeURIComponent(file.name),
      },
    });
  }

  getForumPosts(filters?: any) {
    return this.client.get('/forum/posts', { params: filters });
  }

  createForumPost(data: any) {
    return this.client.post('/forum/posts', data);
  }

  updateForumPost(id: string, data: any) {
    return this.client.put(`/forum/posts/${id}`, data);
  }

  deleteForumPost(id: string) {
    return this.client.delete(`/forum/posts/${id}`);
  }

  getForumComments(postId: string) {
    return this.client.get(`/forum/posts/${postId}/comments`);
  }

  addForumComment(postId: string, content: string, parentId?: string | null) {
    return this.client.post(`/forum/posts/${postId}/comments`, { content, parentId: parentId || null });
  }

  setForumLike(postId: string, liked: boolean) {
    return this.client.post(`/forum/posts/${postId}/like`, { liked });
  }

  getPublicSettings() {
    return this.client.get('/settings/public');
  }

  updateSettings(settings: Record<string, string>) {
    return this.client.put('/settings', { settings });
  }

  uploadQrCode(dataUrl: string) {
    return this.client.post('/uploads/qr-code', { dataUrl });
  }

  getOfficerContacts() {
    return this.client.get('/account/officer-contacts');
  }

  requestAccountReactivation(data: { message?: string }) {
    return this.client.post('/account/reactivation-request', data);
  }

  getNotifications() {
    return this.client.get('/notifications');
  }

  markNotificationRead(id: string) {
    return this.client.patch(`/notifications/${id}/read`);
  }

  markAllNotificationsRead() {
    return this.client.patch('/notifications/mark-all-read');
  }

  deleteNotification(id: string) {
    return this.client.delete(`/notifications/${id}`);
  }

  clearAllNotifications() {
    return this.client.delete('/notifications');
  }
}

export default new ApiService();
