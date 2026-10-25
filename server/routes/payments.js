// Guest online payments. Public by design: anyone holding the (unguessable) order id may pay
// it, and nothing here marks an order paid without the gateway confirming the transaction.
const express = require('express');
const config = require('../lib/config');
const { HttpError, asyncHandler } = require('../lib/http');
const payments = require('../lib/payments');

const router = express.Router();

/** Where the gateway should send the guest back to: the configured public URL, or the page they paid from. */
function returnBase(req) {
  if (config.payments.publicUrl) return config.payments.publicUrl;
  const candidate = req.get('origin') || `${req.protocol}://${req.get('host')}`;
  try {
    const url = new URL(candidate);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
  } catch {
    // fall through
  }
  throw new HttpError(400, 'Could not work out the return address for this payment');
}

router.get('/gateways', (req, res) => res.json(payments.publicGateways()));

router.post('/orders/:orderId/esewa', asyncHandler(async (req, res) => {
  res.json(await payments.startEsewa(req.params.orderId, returnBase(req)));
}));

router.post('/orders/:orderId/khalti', asyncHandler(async (req, res) => {
  res.json(await payments.startKhalti(req.params.orderId, returnBase(req)));
}));

// Called by the return pages after the gateway redirects the guest back
router.post('/esewa/confirm', asyncHandler(async (req, res) => {
  res.json(await payments.confirmEsewa(req.body?.data));
}));

router.post('/khalti/confirm', asyncHandler(async (req, res) => {
  res.json(await payments.confirmKhalti(req.body?.pidx));
}));

// Catches payments whose return redirect never happened (browser closed, network drop)
router.post('/orders/:orderId/check', asyncHandler(async (req, res) => {
  res.json(await payments.recheckOrder(req.params.orderId));
}));

module.exports = router;
