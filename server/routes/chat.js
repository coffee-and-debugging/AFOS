const express = require('express');
const prisma = require('../prisma');
const events = require('../lib/events');
const { requireAuth, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');
// Developed by Unique Adhikari

// Staff chat: one conversation per pair of roles (kitchen ↔ admin, kitchen ↔ cashier, cashier ↔ admin).
// Messages reach only the two roles in the conversation, live over the event stream.
const router = express.Router();
router.use(requireAuth(ROLES.STAFF));

const CHAT_ROLES = ROLES.STAFF;
const MAX_LENGTH = 1000;

function peerRole(value, me) {
  const role = String(value || '');
  if (!CHAT_ROLES.includes(role) || role === me) throw new HttpError(400, 'Choose who to chat with');
  return role;
}

const between = (a, b) => ({ OR: [{ fromRole: a, toRole: b }, { fromRole: b, toRole: a }] });

// Unread messages for my role, per sender role: { admin: 2, chef: 0, … }
router.get('/unread', asyncHandler(async (req, res) => {
  const me = req.user.role;
  const rows = await prisma.chatMessage.groupBy({ by: ['fromRole'], where: { toRole: me, readAt: null }, _count: { _all: true } });
  res.json(Object.fromEntries(CHAT_ROLES.filter((r) => r !== me).map((r) => [r, rows.find((x) => x.fromRole === r)?._count._all ?? 0])));
}));

// Latest messages with one role, oldest first
router.get('/', asyncHandler(async (req, res) => {
  const me = req.user.role;
  const peer = peerRole(req.query.with, me);
  const messages = await prisma.chatMessage.findMany({ where: between(me, peer), orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(messages.reverse());
}));

router.post('/', asyncHandler(async (req, res) => {
  const me = req.user.role;
  const to = peerRole(req.body?.to, me);
  const body = String(req.body?.body || '').trim();
  if (!body) throw new HttpError(400, 'Type a message');
  if (body.length > MAX_LENGTH) throw new HttpError(400, `Messages can be up to ${MAX_LENGTH} characters`);
  const message = await prisma.chatMessage.create({ data: { fromRole: me, toRole: to, fromName: req.user.name, body } });
  events.publish('chat.message', message, [me, to]);
  res.status(201).json(message);
}));

// Marks everything a role sent me as read
router.post('/read', asyncHandler(async (req, res) => {
  const me = req.user.role;
  const peer = peerRole(req.body?.with, me);
  await prisma.chatMessage.updateMany({ where: { fromRole: peer, toRole: me, readAt: null }, data: { readAt: new Date() } });
  events.publish('chat.read', { role: me, with: peer }, [me]); // clears the badge on my other screens
  res.json({ success: true });
}));

module.exports = router;
