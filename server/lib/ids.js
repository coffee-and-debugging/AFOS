const crypto = require('crypto');

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no 0/o/1/l, so ids read back clearly

/**
 * Permanent, unguessable id for a table, used in its QR code URL (/table/<id>/).
 * 12 characters ≈ 60 bits: guests can't reach another table's menu by editing the URL.
 */
function newTableId() {
  let id = '';
  for (let i = 0; i < 12; i++) id += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return id;
}

module.exports = { newTableId };
