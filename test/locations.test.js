import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROVINCES, WARDS, getProvinces, getWardsByProvince,
  findProvinceByCode, findWardByCode,
} from '../src/constants/locations.js';
import AddressController from '../src/controllers/address.controller.js';

test('location snapshot contains 34 provinces and 3321 wards with unique string codes', () => {
  assert.equal(PROVINCES.length, 34);
  assert.equal(WARDS.length, 3321);
  assert.equal(new Set(PROVINCES.map(p => p.code)).size, PROVINCES.length);
  assert.equal(new Set(WARDS.map(w => w.code)).size, WARDS.length);
  for (const province of PROVINCES) {
    assert.match(province.code, /^\d{2}$/);
    assert.ok(province.name);
    assert.ok(getWardsByProvince(province.code).length);
  }
  for (const ward of WARDS) {
    assert.match(ward.code, /^\d{5}$/);
    assert.ok(ward.name);
    assert.ok(findProvinceByCode(ward.province_code));
  }
});

test('lookups use current names and preserve leading zeroes and API field names', () => {
  assert.deepEqual(findProvinceByCode('46'), { code: '46', name: 'Thành phố Huế' });
  assert.equal(findProvinceByCode('74'), undefined);
  assert.deepEqual(findWardByCode('00004'), {
    code: '00004', name: 'Phường Ba Đình', province_code: '01',
  });
  assert.equal(findProvinceByCode(79), findProvinceByCode('79'));
  assert.equal(findWardByCode('invalid'), undefined);
  assert.deepEqual(getWardsByProvince('invalid'), []);
  assert.equal(getProvinces(), PROVINCES);
  assert.equal(getWardsByProvince(), WARDS);
  assert.deepEqual(getWardsByProvince(79), getWardsByProvince('79'));
});

test('location endpoints return existing success envelope and filter wards by province', async () => {
  const res = {
    status(code) { assert.equal(code, 200); return this; },
    json(body) { this.body = body; return this; },
  };
  const next = error => { throw error; };
  await AddressController.getProvinces({}, res, next);
  assert.deepEqual(res.body, { status: 'success', data: PROVINCES });
  const returnedCodes = new Set();
  for (const province of PROVINCES) {
    await AddressController.getWards({ query: { province_code: province.code } }, res, next);
    assert.equal(res.body.status, 'success');
    assert.ok(res.body.data.length);
    for (const ward of res.body.data) {
      assert.equal(ward.province_code, province.code);
      returnedCodes.add(ward.code);
    }
  }
  assert.equal(returnedCodes.size, WARDS.length);
});
