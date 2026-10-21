'use strict';
const assert = require('node:assert/strict');
const { normalizePhone, validateRequest, buildMessage } = require('../maintenance-section.js');

const valid = {
  name: 'أحمد علي', phone: '٠١٠١٢٣٤٥٦٧٨', area: 'الإسكندرية، سموحة',
  brand: 'شارب', problem: 'الجهاز تبريده ضعيف وبيسرّب مياه', preferred: 'الخميس بعد ٥ مساءً'
};

for (const input of ['01012345678', '٠١٠١٢٣٤٥٦٧٨', '۰۱۰۱۲۳۴۵۶۷۸', '+20 10 1234 5678', '00201012345678', '(010) 1234-5678']) {
  assert.equal(normalizePhone(input), '01012345678', input);
}
for (const input of ['', '123', '01312345678', '010123456789', '+2010123456789', '01012345abc', '02012345678']) {
  assert.equal(normalizePhone(input), '', input);
}
for (const prefix of ['010', '011', '012', '015']) assert.equal(normalizePhone(prefix + '12345678'), prefix + '12345678');

const checked = validateRequest(valid);
assert.equal(checked.valid, true);
assert.equal(checked.values.phone, '01012345678');
for (const field of ['name', 'phone', 'area', 'brand', 'problem']) {
  const result = validateRequest({ ...valid, [field]: '   ' });
  assert.equal(result.valid, false, field);
  assert.ok(result.errors[field], field);
}
assert.equal(validateRequest({ ...valid, preferred: '' }).valid, true);
assert.equal(validateRequest({ ...valid, brand: 'not a supplied option' }).valid, false);
assert.equal(validateRequest({ ...valid, name: 'أ'.repeat(81) }).valid, false);
assert.equal(validateRequest({ ...valid, problem: 'ع'.repeat(1201) }).valid, false);
assert.equal(validateRequest({ ...valid, preferred: 'س'.repeat(121) }).valid, false);
const message = buildMessage(checked.values);
assert.ok(message.includes('الاسم: أحمد علي'));
assert.ok(message.includes('رقم الموبايل: 01012345678'));
assert.ok(message.includes('ماركة الجهاز: شارب'));
assert.ok(message.includes('الخميس بعد ٥ مساءً'));
assert.ok(buildMessage({ ...checked.values, preferred: '' }).includes('حسب الاتفاق'));
const unusual = buildMessage({ ...checked.values, problem: 'رمز & وعلامة + ونص <script>alert(1)</script>' });
const url = new URL('https://wa.me/201013283466?text=' + encodeURIComponent(unusual));
assert.equal(url.searchParams.get('text'), unusual);
assert.equal(url.pathname, '/201013283466');
console.log('PASS: Egyptian/Arabic phone formats, required fields, length limits, optional timing, WhatsApp encoding.');
