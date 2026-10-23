/**
 * Officer Position-Based Access Control Rules
 *
 * Rules:
 * - Super Admin & Admin: Full access across all modules.
 * - President & Vice President: Full access across all modules (identical executive access).
 * - Secretary: PSITS Members, Officers, Officer Elections, Institution Members, Events, Reports, Announcements, PSITS Community, Stream Events.
 * - Treasurer: Payment Tracking, Reports, PSITS Members, Institution Members, Events, Announcements, PSITS Community.
 * - Auditor: Payment Tracking, Reports, PSITS Members, Institution Members, Officer Elections, Announcements, PSITS Community.
 * - Business Manager: Partners, Events, Reports, Payment Tracking, Announcements, PSITS Community.
 * - Public Information Officer (PIO) & Press Relations Officer (PRO): Announcements, Stream Events, Events, PSITS Community, Partners, PSITS Members.
 * - Protocol Officer & Sergeant-at-Arms: Events, Stream Events, Officer Elections, PSITS Members, Announcements, PSITS Community.
 * - General Officer / Representative / Other: Events, PSITS Members, Announcements, PSITS Community, Stream Events.
 */

const MODULE_PATHS = {
  dashboard: '/dashboard',
  members: '/members',
  officers: '/officers',
  elections: '/elections',
  events: '/events',
  payments: '/payments',
  institution_members: '/institution-members',
  reports: '/reports',
  forum: '/forum',
  announcements: '/announcements',
  partners: '/partners',
  stream_events: '/stream-events',
};

function normalizePosition(rawPosition) {
  return String(rawPosition || '').trim().toLowerCase();
}

function getOfficerAllowedModules(positionTitle) {
  const pos = normalizePosition(positionTitle);

  // 1. Executive: President & Vice President have identical full access to all modules
  if (
    pos.includes('president') ||
    pos.includes('vp') ||
    pos.includes('exec')
  ) {
    return [
      'dashboard',
      'members',
      'officers',
      'elections',
      'events',
      'payments',
      'institution_members',
      'reports',
      'forum',
      'announcements',
      'partners',
      'stream_events',
    ];
  }

  // 2. Secretary
  if (pos.includes('secretary')) {
    return [
      'dashboard',
      'members',
      'officers',
      'elections',
      'events',
      'institution_members',
      'reports',
      'announcements',
      'forum',
      'stream_events',
    ];
  }

  // 3. Treasurer / Finance
  if (pos.includes('treasurer') || pos.includes('finance')) {
    return [
      'dashboard',
      'payments',
      'reports',
      'members',
      'institution_members',
      'events',
      'announcements',
      'forum',
    ];
  }

  // 4. Auditor
  if (pos.includes('auditor') || pos.includes('audit')) {
    return [
      'dashboard',
      'payments',
      'reports',
      'members',
      'institution_members',
      'elections',
      'announcements',
      'forum',
    ];
  }

  // 5. Business Manager
  if (pos.includes('business') || pos.includes('marketing') || pos.includes('commercial')) {
    return [
      'dashboard',
      'partners',
      'events',
      'reports',
      'payments',
      'announcements',
      'forum',
    ];
  }

  // 6. Public Information Officer (PIO) & Press Relations Officer (PRO)
  if (
    pos.includes('pio') ||
    pos.includes('pro') ||
    pos.includes('information') ||
    pos.includes('press') ||
    pos.includes('public relations') ||
    pos.includes('media')
  ) {
    return [
      'dashboard',
      'announcements',
      'stream_events',
      'events',
      'forum',
      'partners',
      'members',
    ];
  }

  // 7. Protocol Officer & Sergeant-at-Arms
  if (
    pos.includes('protocol') ||
    pos.includes('sergeant') ||
    pos.includes('sgt') ||
    pos.includes('arms') ||
    pos.includes('peace') ||
    pos.includes('marshal')
  ) {
    return [
      'dashboard',
      'events',
      'stream_events',
      'elections',
      'members',
      'announcements',
      'forum',
    ];
  }

  // 8. General / Committee / Representative
  return [
    'dashboard',
    'events',
    'members',
    'announcements',
    'forum',
    'stream_events',
  ];
}

function canOfficerAccessModule(positionTitle, moduleKey) {
  const allowed = getOfficerAllowedModules(positionTitle);
  const normalizedKey = String(moduleKey || '').trim().toLowerCase().replace(/-/g, '_');
  return allowed.includes(normalizedKey);
}

function canOfficerAccessPath(positionTitle, pathname) {
  const path = String(pathname || '').toLowerCase();
  const allowed = getOfficerAllowedModules(positionTitle);

  for (const mod of allowed) {
    const routePath = MODULE_PATHS[mod];
    if (routePath && (path === routePath || path.startsWith(`${routePath}/`))) {
      return true;
    }
  }

  // Always accessible
  if (
    path === '/' ||
    path === '/dashboard' ||
    path.startsWith('/settings') ||
    path.startsWith('/notifications') ||
    path.startsWith('/unauthorized')
  ) {
    return true;
  }

  return false;
}

function requireOfficerModule(moduleKey, options = {}) {
  const { allowMembers = false } = options;
  return (req, res, next) => {
    const role = req.user?.role;
    if (role === 'super_admin' || role === 'admin') {
      return next();
    }
    if (allowMembers && (role === 'member' || role === 'institution')) {
      return next();
    }
    if (role === 'officer') {
      const position = req.user?.position || req.user?.officer_position;
      if (canOfficerAccessModule(position, moduleKey)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        message: `Access denied. Your officer position (${position || 'Officer'}) does not have permission to access the ${moduleKey.replace(/_/g, ' ')} module.`,
      });
    }
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  };
}

module.exports = {
  MODULE_PATHS,
  normalizePosition,
  getOfficerAllowedModules,
  canOfficerAccessModule,
  canOfficerAccessPath,
  requireOfficerModule,
};
