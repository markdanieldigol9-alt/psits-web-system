const { pool } = require('./db');

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listPartners(_req, res) {
  const [rows] = await pool.execute('SELECT * FROM partners ORDER BY created_at DESC');
  return res.json({ success: true, partners: rows.map(toPartnerDto) });
}

async function createPartner(req, res) {
  const body = req.body || {};
  const company = String(body.company || '').trim();
  if (!company) return res.status(400).json({ success: false, message: 'Company name is required.' });

  const type = body.type ? String(body.type).trim() : '';
  const contactPerson = body.contactPerson ? String(body.contactPerson).trim() : '';
  const location = body.location ? String(body.location).trim() : '';
  const email = body.email ? String(body.email).trim() : '';
  const phone = body.phone ? String(body.phone).trim() : '';
  const website = body.website ? String(body.website).trim() : null;

  const [result] = await pool.execute(
    `INSERT INTO partners (company, type, contact_person, location, email, phone, website, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [company, type, contactPerson, location, email, phone, website, req.user?.id || null]
  );

  const [rows] = await pool.execute('SELECT * FROM partners WHERE id = ? LIMIT 1', [result.insertId]);
  return res.status(201).json({ success: true, partner: toPartnerDto(rows[0]) });
}

async function updatePartner(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

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
  const [rows] = await pool.execute('SELECT * FROM partners WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Partner not found.' });
  return res.json({ success: true, partner: toPartnerDto(rows[0]) });
}

async function deletePartner(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const [result] = await pool.execute('DELETE FROM partners WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Partner not found.' });
  return res.json({ success: true });
}

function toContributionDto(row) {
  return {
    id: String(row.id),
    partnerId: String(row.partner_id),
    eventId: row.event_id ? String(row.event_id) : null,
    eventTitle: row.event_title || null,
    eventStartDate: row.event_start_date || null,
    eventEndDate: row.event_end_date || null,
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
    `SELECT pc.*, e.title AS event_title, e.start_date AS event_start_date, e.end_date AS event_end_date, e.status AS event_status
     FROM partner_contributions pc
     LEFT JOIN events e ON e.id = pc.event_id
     WHERE pc.partner_id = ?
     ORDER BY pc.created_at DESC`,
    [id]
  );
  return res.json({ success: true, contributions: rows.map(toContributionDto) });
}

async function createPartnerContribution(req, res) {
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
    `SELECT pc.*, e.title AS event_title, e.start_date AS event_start_date, e.end_date AS event_end_date, e.status AS event_status
     FROM partner_contributions pc
     LEFT JOIN events e ON e.id = pc.event_id
     WHERE pc.id = ? LIMIT 1`,
    [result.insertId]
  );

  return res.status(201).json({ success: true, contribution: toContributionDto(rows[0]) });
}

async function updatePartnerContribution(req, res) {
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
    `SELECT pc.*, e.title AS event_title, e.start_date AS event_start_date, e.end_date AS event_end_date, e.status AS event_status
     FROM partner_contributions pc
     LEFT JOIN events e ON e.id = pc.event_id
     WHERE pc.id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Contribution not found.' });
  return res.json({ success: true, contribution: toContributionDto(rows[0]) });
}

async function deletePartnerContribution(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const [result] = await pool.execute('DELETE FROM partner_contributions WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Contribution not found.' });
  return res.json({ success: true });
}

module.exports = {
  listPartners,
  createPartner,
  updatePartner,
  deletePartner,
  listPartnerContributions,
  createPartnerContribution,
  updatePartnerContribution,
  deletePartnerContribution,
};

