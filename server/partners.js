const { pool } = require('./db');
const { canOfficerAccessModule } = require('./officerPermissions');

function canManagePartners(user) {
  if (!user) return false;
  const role = user.role;
  const memberType = user.member_type;
  const sector = user.sector;
  if (['super_admin', 'admin'].includes(role)) return true;
  if (role === 'officer') {
    return canOfficerAccessModule(user.position || user.officer_position, 'partners');
  }
  if (role === 'member' && (memberType === 'industry' || sector === 'industry')) return true;
  return false;
}

function requirePartnerManager(req, res, next) {
  if (canManagePartners(req.user)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Forbidden: Only administrators, officers, and industry members are permitted to modify partners and deals.',
  });
}

async function syncIndustryPartner(userId) {
  if (!userId) return null;
  try {
    const [userRows] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!userRows.length) return null;
    const u = userRows[0];
    const isIndustry = u.member_type === 'industry' || u.sector === 'industry';
    if (!isIndustry) return null;

    const company = (u.sector_details && u.sector_details.trim()) || (u.full_name && u.full_name.trim()) || 'Industry Partner';
    const contactPerson = (u.representative_name && u.representative_name.trim()) || (u.full_name && u.full_name.trim()) || '';
    const location = (u.address && u.address.trim()) || 'Region XII';
    const email = (u.company_email && u.company_email.trim()) || (u.email && u.email.trim()) || '';
    const phone = (u.contact_number && u.contact_number.trim()) || '';
    const website = (u.website && u.website.trim()) || null;

    // Check if partner exists by user_id
    const [existingByUserId] = await pool.execute(
      'SELECT id FROM partners WHERE user_id = ? LIMIT 1',
      [u.id]
    );

    if (existingByUserId.length) {
      const pId = existingByUserId[0].id;
      await pool.execute(
        `UPDATE partners 
         SET company = ?, type = 'Industry', contact_person = ?, location = ?, email = ?, phone = ?, website = ?
         WHERE id = ?`,
        [company, contactPerson, location, email, phone, website, pId]
      );
      return pId;
    }

    // Check if partner exists by company name or email without user_id
    const [existingByName] = await pool.execute(
      'SELECT id FROM partners WHERE company = ? OR (email = ? AND email <> "") LIMIT 1',
      [company, email]
    );

    if (existingByName.length) {
      const pId = existingByName[0].id;
      await pool.execute(
        `UPDATE partners 
         SET user_id = ?, type = 'Industry', contact_person = COALESCE(NULLIF(?, ''), contact_person), location = COALESCE(NULLIF(?, ''), location), phone = COALESCE(NULLIF(?, ''), phone), website = COALESCE(?, website)
         WHERE id = ?`,
        [u.id, contactPerson, location, phone, website, pId]
      );
      return pId;
    }

    // Insert new partner
    const [result] = await pool.execute(
      `INSERT INTO partners (user_id, company, type, contact_person, location, email, phone, website, created_by, partnership_status)
       VALUES (?, ?, 'Industry', ?, ?, ?, ?, ?, ?, 'active')`,
      [u.id, company, contactPerson, location, email, phone, website, u.id]
    );
    return result.insertId;
  } catch (err) {
    console.error('Error syncing industry partner for user ' + userId + ':', err);
    return null;
  }
}

async function syncAllIndustryPartners() {
  try {
    const [industryUsers] = await pool.query(
      `SELECT id FROM users 
       WHERE (member_type = 'industry' OR sector = 'industry')
         AND role = 'member'`
    );
    for (const u of industryUsers) {
      await syncIndustryPartner(u.id);
    }
  } catch (err) {
    console.error('Error syncing all industry partners:', err);
  }
}

function toPartnerDto(row) {
  return {
    id: String(row.id),
    company: row.company,
    type: row.type,
    contactPerson: row.contact_person,
    location: row.location,
    email: row.email,
    phone: row.phone,
    website: row.website,
    userId: row.user_id ? String(row.user_id) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listPartners(_req, res) {
  await syncAllIndustryPartners();
  const [rows] = await pool.execute('SELECT * FROM partners ORDER BY created_at DESC');
  return res.json({ success: true, partners: rows.map(toPartnerDto) });
}

async function createPartner(req, res) {
  if (!canManagePartners(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden: Only administrators, officers, and industry members can create partners.' });
  }

  const body = req.body || {};
  const company = String(body.company || '').trim();
  if (!company) return res.status(400).json({ success: false, message: 'Company name is required.' });

  const type = body.type ? String(body.type).trim() : 'Industry';
  const contactPerson = body.contactPerson ? String(body.contactPerson).trim() : '';
  const location = body.location ? String(body.location).trim() : '';
  const email = body.email ? String(body.email).trim() : '';
  const phone = body.phone ? String(body.phone).trim() : '';
  const website = body.website ? String(body.website).trim() : null;
  const isIndustryMember = req.user?.role === 'member' && (req.user?.member_type === 'industry' || req.user?.sector === 'industry');
  const userId = isIndustryMember ? req.user.id : (body.userId ? Number(body.userId) : null);

  const [result] = await pool.execute(
    `INSERT INTO partners (user_id, company, type, contact_person, location, email, phone, website, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, company, type, contactPerson, location, email, phone, website, req.user?.id || null]
  );

  const [rows] = await pool.execute('SELECT * FROM partners WHERE id = ? LIMIT 1', [result.insertId]);
  return res.status(201).json({ success: true, partner: toPartnerDto(rows[0]) });
}

async function updatePartner(req, res) {
  if (!canManagePartners(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden: Only administrators, officers, and industry members can update partners.' });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const [partnerRows] = await pool.execute('SELECT * FROM partners WHERE id = ? LIMIT 1', [id]);
  if (!partnerRows.length) return res.status(404).json({ success: false, message: 'Partner not found.' });
  const partner = partnerRows[0];

  const role = req.user?.role;
  const isPrivileged = ['super_admin', 'admin'].includes(role);
  const isOwner = Number(partner.user_id) === Number(req.user?.id) || Number(partner.created_by) === Number(req.user?.id);

  if (!isPrivileged && !isOwner) {
    return res.status(403).json({ success: false, message: 'Forbidden: You can only update your own company partner details.' });
  }

  const body = req.body || {};
  const sets = [];
  const params = [];

  if (typeof body.company === 'string' && body.company.trim()) { sets.push('company = ?'); params.push(body.company.trim()); }
  if (typeof body.type === 'string') { sets.push('type = ?'); params.push(body.type.trim()); }
  if (typeof body.contactPerson === 'string') { sets.push('contact_person = ?'); params.push(body.contactPerson.trim()); }
  if (typeof body.location === 'string') { sets.push('location = ?'); params.push(body.location.trim()); }
  if (typeof body.email === 'string') { sets.push('email = ?'); params.push(body.email.trim()); }
  if (typeof body.phone === 'string') { sets.push('phone = ?'); params.push(body.phone.trim()); }
  if (body.website !== undefined) { sets.push('website = ?'); params.push(body.website ? String(body.website).trim() : null); }

  if (!sets.length) return res.status(400).json({ success: false, message: 'No fields to update.' });
  params.push(id);

  await pool.execute(`UPDATE partners SET ${sets.join(', ')} WHERE id = ?`, params);

  // Sync back to linked user profile if applicable
  if (partner.user_id) {
    try {
      const userSets = [];
      const userParams = [];
      if (typeof body.company === 'string' && body.company.trim()) { userSets.push('sector_details = ?'); userParams.push(body.company.trim()); }
      if (typeof body.contactPerson === 'string' && body.contactPerson.trim()) { userSets.push('representative_name = ?'); userParams.push(body.contactPerson.trim()); }
      if (typeof body.location === 'string' && body.location.trim()) { userSets.push('address = ?'); userParams.push(body.location.trim()); }
      if (typeof body.email === 'string' && body.email.trim()) { userSets.push('company_email = ?'); userParams.push(body.email.trim()); }
      if (typeof body.phone === 'string' && body.phone.trim()) { userSets.push('contact_number = ?'); userParams.push(body.phone.trim()); }
      if (body.website !== undefined) { userSets.push('website = ?'); userParams.push(body.website ? String(body.website).trim() : null); }
      if (userSets.length) {
        userParams.push(partner.user_id);
        await pool.execute(`UPDATE users SET ${userSets.join(', ')} WHERE id = ?`, userParams);
      }
    } catch (userSyncErr) {
      console.error('Failed to sync partner changes back to user:', userSyncErr);
    }
  }

  const [rows] = await pool.execute('SELECT * FROM partners WHERE id = ? LIMIT 1', [id]);
  return res.json({ success: true, partner: toPartnerDto(rows[0]) });
}

async function deletePartner(req, res) {
  if (!canManagePartners(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden: Only administrators, officers, and industry members can delete partners.' });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const [partnerRows] = await pool.execute('SELECT * FROM partners WHERE id = ? LIMIT 1', [id]);
  if (!partnerRows.length) return res.status(404).json({ success: false, message: 'Partner not found.' });
  const partner = partnerRows[0];

  const role = req.user?.role;
  const isPrivileged = ['super_admin', 'admin'].includes(role);
  const isOwner = Number(partner.user_id) === Number(req.user?.id) || Number(partner.created_by) === Number(req.user?.id);

  if (!isPrivileged && !isOwner) {
    return res.status(403).json({ success: false, message: 'Forbidden: You can only delete your own company partner details.' });
  }

  const [result] = await pool.execute('DELETE FROM partners WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Partner not found.' });
  return res.json({ success: true });
}

function toContributionDto(row) {
  const startDate = row.event_start_date ? (row.event_start_date instanceof Date ? row.event_start_date.toISOString() : String(row.event_start_date)) : null;
  const endDate = row.event_end_date ? (row.event_end_date instanceof Date ? row.event_end_date.toISOString() : String(row.event_end_date)) : null;
  return {
    id: String(row.id),
    partnerId: String(row.partner_id),
    eventId: row.event_id ? String(row.event_id) : null,
    eventTitle: row.event_title || null,
    eventStartDate: startDate,
    eventEndDate: endDate,
    eventStatus: row.event_status || null,
    dealTitle: row.deal_title,
    contributionType: row.contribution_type,
    valueAmount: row.value_amount ? Number(row.value_amount) : null,
    description: row.description || '',
    createdAt: row.created_at,
  };
}

async function listPartnerContributions(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid partner id.' });

  const [rows] = await pool.execute(
    `SELECT pc.*, e.title AS event_title, e.start_at AS event_start_date, e.end_at AS event_end_date, e.status AS event_status
     FROM partner_contributions pc
     LEFT JOIN events e ON e.id = pc.event_id
     WHERE pc.partner_id = ?
     ORDER BY pc.created_at DESC`,
    [id]
  );
  return res.json({ success: true, contributions: rows.map(toContributionDto) });
}

async function createPartnerContribution(req, res) {
  if (!canManagePartners(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden: Only administrators, officers, and industry members can create partner contributions.' });
  }

  const partnerId = Number(req.params.id);
  if (!Number.isFinite(partnerId)) return res.status(400).json({ success: false, message: 'Invalid partner id.' });

  const body = req.body || {};
  const dealTitle = String(body.dealTitle || '').trim();
  const contributionType = String(body.contributionType || '').trim();

  if (!dealTitle || !contributionType) {
    return res.status(400).json({ success: false, message: 'Deal title and contribution type are required.' });
  }

  const allowedTypes = ['funds', 'prizes', 'equipment', 'venue', 'services', 'other'];
  if (!allowedTypes.includes(contributionType)) {
    return res.status(400).json({ success: false, message: 'Invalid contribution type.' });
  }

  const eventId = body.eventId ? Number(body.eventId) : null;
  const valueAmount = body.valueAmount !== undefined && body.valueAmount !== null ? Number(body.valueAmount) : null;
  const description = body.description ? String(body.description).trim() : null;

  const [result] = await pool.execute(
    `INSERT INTO partner_contributions (partner_id, event_id, deal_title, contribution_type, value_amount, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [partnerId, eventId, dealTitle, contributionType, valueAmount, description]
  );

  const [rows] = await pool.execute(
    `SELECT pc.*, e.title AS event_title, e.start_at AS event_start_date, e.end_at AS event_end_date, e.status AS event_status
     FROM partner_contributions pc
     LEFT JOIN events e ON e.id = pc.event_id
     WHERE pc.id = ? LIMIT 1`,
    [result.insertId]
  );

  // Sync monetary contribution into payments ledger
  if (valueAmount && Number(valueAmount) > 0) {
    try {
      const [partnerRows] = await pool.execute('SELECT company, contact_person, user_id FROM partners WHERE id = ? LIMIT 1', [partnerId]);
      const partner = partnerRows[0] || {};
      const targetUserId = partner.user_id || req.user?.id || 1;
      const partnerName = partner.company || partner.contact_person || 'Industry Partner';
      const refNum = `SPONSOR-${partnerId}-${result.insertId}`;

      await pool.execute(
        `INSERT INTO payments (
          member_id, member_name, event_id, event, amount, payment_kind,
          payment_method, method, reference_number, status, payment_status, process_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'partner_sponsorship', 'bank_transfer', 'bank_transfer', ?, 'verified', 'paid', 'verified', NOW(), NOW())`,
        [targetUserId, partnerName, eventId, dealTitle, valueAmount, refNum]
      );
    } catch (syncErr) {
      console.error('Failed to sync partner contribution to payments ledger:', syncErr);
    }
  }

  return res.status(201).json({ success: true, contribution: toContributionDto(rows[0]) });
}

async function updatePartnerContribution(req, res) {
  if (!canManagePartners(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden: Only administrators, officers, and industry members can update partner contributions.' });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const body = req.body || {};
  const sets = [];
  const params = [];

  if (typeof body.dealTitle === 'string' && body.dealTitle.trim()) { sets.push('deal_title = ?'); params.push(body.dealTitle.trim()); }
  if (typeof body.contributionType === 'string' && body.contributionType.trim()) { sets.push('contribution_type = ?'); params.push(body.contributionType.trim()); }
  if (body.valueAmount !== undefined) { sets.push('value_amount = ?'); params.push(body.valueAmount ? Number(body.valueAmount) : null); }
  if (body.eventId !== undefined) { sets.push('event_id = ?'); params.push(body.eventId ? Number(body.eventId) : null); }
  if (body.description !== undefined) { sets.push('description = ?'); params.push(body.description ? String(body.description).trim() : null); }

  if (!sets.length) return res.status(400).json({ success: false, message: 'No fields to update.' });
  params.push(id);

  await pool.execute(`UPDATE partner_contributions SET ${sets.join(', ')} WHERE id = ?`, params);
  const [rows] = await pool.execute(
    `SELECT pc.*, e.title AS event_title, e.start_at AS event_start_date, e.end_at AS event_end_date, e.status AS event_status
     FROM partner_contributions pc
     LEFT JOIN events e ON e.id = pc.event_id
     WHERE pc.id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Contribution not found.' });
  return res.json({ success: true, contribution: toContributionDto(rows[0]) });
}

async function deletePartnerContribution(req, res) {
  const role = req.user?.role;
  const isPrivileged = ['super_admin', 'admin'].includes(role);
  if (!isPrivileged) {
    return res.status(403).json({ success: false, message: 'Forbidden: Only administrators can delete partner contributions.' });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const [result] = await pool.execute('DELETE FROM partner_contributions WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Contribution not found.' });

  try {
    await pool.execute("DELETE FROM payments WHERE payment_kind = 'partner_sponsorship' AND reference_number LIKE ?", [`SPONSOR-%-${id}`]);
  } catch {}

  return res.json({ success: true });
}

module.exports = {
  canManagePartners,
  requirePartnerManager,
  syncIndustryPartner,
  syncAllIndustryPartners,
  listPartners,
  createPartner,
  updatePartner,
  deletePartner,
  listPartnerContributions,
  createPartnerContribution,
  updatePartnerContribution,
  deletePartnerContribution,
};

