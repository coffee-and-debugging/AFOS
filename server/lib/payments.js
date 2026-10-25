// Online payments through eSewa (ePay v2) and Khalti (KPG-2 ePayment).
//
// Flow: the guest starts a checkout → we record a PaymentAttempt and send them to the
// gateway → the gateway sends them back → we ask the gateway's own API whether the
// transaction completed for the expected amount, and only then mark the order paid.
// Return-URL parameters are never trusted on their own.
const crypto = require('crypto');
const prisma = require('../prisma');
const config = require('./config');
const events = require('./events');
const logger = require('./logger');
const { HttpError } = require('./http');
const { orderInclude } = require('./orders');

const TIMEOUT_MS = 15_000;
const { esewa: ESEWA, khalti: KHALTI } = config.payments;

const ESEWA_URLS = {
  test: { form: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form', status: 'https://rc.esewa.com.np/api/epay/transaction/status/' },
  live: { form: 'https://epay.esewa.com.np/api/epay/main/v2/form', status: 'https://epay.esewa.com.np/api/epay/transaction/status/' },
}[ESEWA.env];
const KHALTI_API = { test: 'https://dev.khalti.com/api/v2', live: 'https://khalti.com/api/v2' }[KHALTI.env];
const KHALTI_MIN_PAISA = 1000; // Khalti rejects payments under Rs. 10

const enabled = {
  esewa: Boolean(ESEWA.productCode && ESEWA.secretKey),
  khalti: Boolean(KHALTI.secretKey),
};
if (ESEWA.env === 'live' && !enabled.esewa) logger.warn('eSewa is set to live but ESEWA_PRODUCT_CODE / ESEWA_SECRET_KEY are missing; eSewa is disabled');
if (!enabled.khalti) logger.info('Khalti is disabled until KHALTI_SECRET_KEY is set');

const round2 = (n) => Math.round(n * 100) / 100;
// eSewa signs the exact strings sent, so amounts are always formatted the same way
const esewaAmount = (n) => String(round2(n));

/** What the guest payment screen needs to know. Never includes secrets. */
function publicGateways() {
  return [
    { id: 'esewa', name: 'eSewa', enabled: enabled.esewa, testMode: ESEWA.env === 'test', account: ESEWA.account },
    { id: 'khalti', name: 'Khalti', enabled: enabled.khalti, testMode: KHALTI.env === 'test', account: KHALTI.account },
  ];
}

async function callGateway(name, url, init) {
  let res;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    logger.error(`${name} unreachable`, { url, err });
    throw new HttpError(502, `${name} is not responding right now. Please try again or pay at the counter.`);
  }
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/** Loads an order that can still be paid online. */
async function payableOrder(orderId) {
  const order = await prisma.order.findUnique({ where: { id: String(orderId) } });
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.status === 'cancelled') throw new HttpError(409, 'This order was cancelled');
  if (order.paymentStatus === 'paid') throw new HttpError(409, 'This order is already paid');
  if (!(order.totalAmount > 0)) throw new HttpError(400, 'Nothing to pay on this order');
  return order;
}

const billName = (order) => `Bill #${String(order.billNo).padStart(5, '0')}`;

/* ---------------- eSewa ---------------- */

const esewaSign = (message) => crypto.createHmac('sha256', ESEWA.secretKey).update(message).digest('base64');

/** Returns the form the browser must POST to eSewa. */
async function startEsewa(orderId, baseUrl) {
  if (!enabled.esewa) throw new HttpError(503, 'eSewa payments are not set up yet. Please pay at the counter.');
  const order = await payableOrder(orderId);
  const amount = esewaAmount(order.totalAmount);
  // eSewa allows letters, digits and hyphens; unique per attempt so a retry never collides
  const reference = `YF-${order.billNo}-${crypto.randomBytes(5).toString('hex')}`;
  await prisma.paymentAttempt.create({ data: { orderId: order.id, gateway: 'esewa', reference, amount: Number(amount) } });

  const signedFieldNames = 'total_amount,transaction_uuid,product_code';
  const fields = {
    amount,
    tax_amount: '0',
    total_amount: amount,
    transaction_uuid: reference,
    product_code: ESEWA.productCode,
    product_service_charge: '0',
    product_delivery_charge: '0',
    // eSewa appends ?data=… itself, so these must not carry a query string
    success_url: `${baseUrl}/payment/esewa/success`,
    failure_url: `${baseUrl}/payment/esewa/failure/${order.id}`,
    signed_field_names: signedFieldNames,
    signature: esewaSign(`total_amount=${amount},transaction_uuid=${reference},product_code=${ESEWA.productCode}`),
  };
  return { action: ESEWA_URLS.form, fields };
}

/**
 * Reads a field's raw text from eSewa's JSON so the signature is checked against exactly
 * what eSewa signed (e.g. "1000.0", which JSON.parse would turn into 1000).
 */
function rawJsonField(json, field) {
  const m = json.match(new RegExp(`"${field}"\\s*:\\s*("((?:[^"\\\\]|\\\\.)*)"|[^,}\\s]+)`));
  if (!m) return undefined;
  return m[2] !== undefined ? m[2] : m[1];
}

/** eSewa's server-side status check — the authority on whether money moved. */
async function esewaStatus(attempt) {
  const url = `${ESEWA_URLS.status}?${new URLSearchParams({
    product_code: ESEWA.productCode,
    total_amount: esewaAmount(attempt.amount),
    transaction_uuid: attempt.reference,
  })}`;
  const { ok, body } = await callGateway('eSewa', url, { headers: { Accept: 'application/json' } });
  if (!ok) logger.warn('eSewa status check failed', { reference: attempt.reference, body });
  const completed = ok && body.status === 'COMPLETE' && Math.abs(Number(body.total_amount) - attempt.amount) < 0.01;
  return { completed, state: body.status || 'UNKNOWN', gatewayTxnId: body.ref_id || null, raw: body };
}

/** Handles eSewa's success redirect (`data` = base64 JSON). */
async function confirmEsewa(data) {
  if (!data) throw new HttpError(400, 'Missing eSewa response');
  let json;
  let parsed;
  try {
    json = Buffer.from(String(data), 'base64').toString('utf8');
    parsed = JSON.parse(json);
  } catch {
    throw new HttpError(400, 'Unreadable eSewa response');
  }
  const attempt = await prisma.paymentAttempt.findUnique({ where: { reference: String(parsed.transaction_uuid || '') } });
  if (!attempt || attempt.gateway !== 'esewa') throw new HttpError(404, 'Payment not found');

  const signed = String(parsed.signed_field_names || '').split(',').filter(Boolean);
  const message = signed.map((f) => `${f}=${rawJsonField(json, f)}`).join(',');
  const expected = Buffer.from(esewaSign(message));
  const given = Buffer.from(String(parsed.signature || ''));
  if (!signed.length || expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    // Not fatal on its own: the status check below asks eSewa directly and decides.
    logger.warn('eSewa response signature did not verify', { reference: attempt.reference });
  }
  return settle(attempt, await esewaStatus(attempt));
}

/* ---------------- Khalti ---------------- */

const khaltiHeaders = () => ({ Authorization: `Key ${KHALTI.secretKey}`, 'Content-Type': 'application/json' });

/** Creates a Khalti payment and returns the URL to send the guest to. */
async function startKhalti(orderId, baseUrl) {
  if (!enabled.khalti) throw new HttpError(503, 'Khalti payments are not set up yet. Please pay at the counter.');
  const order = await payableOrder(orderId);
  const paisa = Math.round(order.totalAmount * 100);
  if (paisa < KHALTI_MIN_PAISA) throw new HttpError(400, 'Khalti accepts payments of Rs. 10 or more. Please pay at the counter.');

  const attemptId = crypto.randomUUID();
  const { ok, status, body } = await callGateway('Khalti', `${KHALTI_API}/epayment/initiate/`, {
    method: 'POST',
    headers: khaltiHeaders(),
    body: JSON.stringify({
      return_url: `${baseUrl}/payment/khalti/return`,
      website_url: baseUrl,
      amount: paisa,
      purchase_order_id: attemptId,
      purchase_order_name: billName(order),
      // Khalti's sandbox fails without customer_info; the name is all we know about a guest
      customer_info: { name: order.tableNumber ? `Table ${order.tableNumber} guest` : 'Takeaway guest' },
    }),
  });
  if (!ok || !body.pidx || !body.payment_url) {
    logger.error('Khalti initiate failed', { status, body });
    throw new HttpError(502, status === 401 ? 'Khalti rejected the merchant key. Please pay at the counter.' : 'Khalti could not start the payment. Please try again or pay at the counter.');
  }
  await prisma.paymentAttempt.create({
    data: { id: attemptId, orderId: order.id, gateway: 'khalti', reference: body.pidx, amount: paisa / 100, response: body },
  });
  return { paymentUrl: body.payment_url };
}

/** Khalti's lookup API — the authority on whether money moved. */
async function khaltiStatus(attempt) {
  const { ok, body } = await callGateway('Khalti', `${KHALTI_API}/epayment/lookup/`, {
    method: 'POST',
    headers: khaltiHeaders(),
    body: JSON.stringify({ pidx: attempt.reference }),
  });
  if (!ok) logger.warn('Khalti lookup failed', { pidx: attempt.reference, body });
  const completed = ok && body.status === 'Completed' && Number(body.total_amount) === Math.round(attempt.amount * 100);
  return { completed, state: body.status || 'Unknown', gatewayTxnId: body.transaction_id || null, raw: body };
}

async function confirmKhalti(pidx) {
  if (!pidx) throw new HttpError(400, 'Missing Khalti payment id');
  const attempt = await prisma.paymentAttempt.findUnique({ where: { reference: String(pidx) } });
  if (!attempt || attempt.gateway !== 'khalti') throw new HttpError(404, 'Payment not found');
  if (!enabled.khalti) throw new HttpError(503, 'Khalti is not set up on this server');
  return settle(attempt, await khaltiStatus(attempt));
}

/* ---------------- Settlement ---------------- */

const STILL_OPEN = new Set(['PENDING', 'AMBIGUOUS', 'Pending', 'Initiated']);

/**
 * Records the gateway's verdict and, when the money arrived, marks the order paid exactly as a
 * counter payment would (status, method, time) so every screen carries on as usual.
 */
async function settle(attempt, verdict) {
  const outcome = await prisma.$transaction(async (tx) => {
    const status = verdict.completed ? 'completed' : STILL_OPEN.has(verdict.state) ? 'initiated' : 'failed';
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status, gatewayTxnId: verdict.gatewayTxnId, response: verdict.raw ?? undefined },
    });
    const order = await tx.order.findUnique({ where: { id: attempt.orderId }, include: orderInclude });

    if (!verdict.completed) {
      const message = status === 'initiated'
        ? 'The payment is still being processed. This page will update once it completes.'
        : 'The payment was not completed. No money was taken. You can try again or pay at the counter.';
      return { paid: order.paymentStatus === 'paid', order, message };
    }
    if (order.paymentStatus === 'paid') return { paid: true, order, message: 'This order is already paid.' };
    if (order.status === 'cancelled' || attempt.amount + 0.01 < order.totalAmount) {
      // Money arrived but can't settle this bill automatically; staff will sort it out
      logger.error('online payment needs staff attention', { orderId: order.id, attemptId: attempt.id, reason: order.status === 'cancelled' ? 'cancelled' : 'amount_mismatch' });
      return { paid: false, order, needsStaff: true, message: 'We received your payment, but the bill has changed. Please show this screen to our staff.' };
    }
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'paid', paymentMethod: attempt.gateway, paidAt: new Date(), paymentRef: verdict.gatewayTxnId },
      include: orderInclude,
    });
    return { paid: true, order: updated, justPaid: true, message: `Payment received via ${attempt.gateway === 'esewa' ? 'eSewa' : 'Khalti'}. Thank you!` };
  });

  if (outcome.justPaid) {
    logger.info('online payment completed', { orderId: outcome.order.id, gateway: attempt.gateway, ref: verdict.gatewayTxnId });
    events.publish('order.updated', outcome.order);
  }
  delete outcome.justPaid; // internal flag, not part of the API response
  return outcome;
}

/**
 * Re-checks recent unfinished attempts for an order, e.g. when the guest paid but closed the
 * browser before being sent back. Safe to call repeatedly.
 */
async function recheckOrder(orderId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const attempts = await prisma.paymentAttempt.findMany({
    where: { orderId: String(orderId), status: 'initiated', createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  for (const attempt of attempts) {
    if (!enabled[attempt.gateway]) continue;
    const verdict = attempt.gateway === 'esewa' ? await esewaStatus(attempt) : await khaltiStatus(attempt);
    const result = await settle(attempt, verdict);
    if (result.paid) return result;
  }
  const order = await prisma.order.findUnique({ where: { id: String(orderId) }, include: orderInclude });
  if (!order) throw new HttpError(404, 'Order not found');
  return { paid: order.paymentStatus === 'paid', order };
}

module.exports = { publicGateways, startEsewa, confirmEsewa, startKhalti, confirmKhalti, recheckOrder, ESEWA_FORM_URL: ESEWA_URLS.form };
