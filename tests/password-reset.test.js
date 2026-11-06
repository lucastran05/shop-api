import test from 'node:test';
import assert from 'node:assert/strict';
import AuthService from '../src/services/auth.service.js';
import identity from '../src/modules/identity/identity.repository.js';
import { passwordResetMail, passwordResetUrl } from '../src/services/password-reset-mail.js';
import { hashToken } from '../src/utils/jwt.js';
import { comparePassword } from '../src/utils/password.js';
import logger from '../src/common/utils/logger.js';

test('password recovery validates input, hashes secrets, and hides account existence', async (t) => {
  const issued = [];
  const mail = [];
  const create = t.mock.method(identity, 'createPasswordReset', async (email, hash) => {
    issued.push({ email, hash });
    return { id: 'test', email };
  });
  t.mock.method(passwordResetMail, 'send', async (email, url) => mail.push({ email, url }));
  for (const email of [undefined, null, {}, [], 'bad', 'a'.repeat(250) + '@test.com']) {
    await assert.rejects(AuthService.forgotPassword({ email }), { statusCode: 400 });
  }
  assert.equal(issued.length, 0);
  const result = await AuthService.forgotPassword({ email: ' Person@Example.com ' });
  assert.deepEqual(result, { success: true });
  assert.equal(issued[0].email, 'person@example.com');
  const url = new URL(mail[0].url);
  const token = new URLSearchParams(url.hash.slice(1)).get('token');
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(url.search, '');
  assert.equal(issued[0].hash, hashToken(token));
  assert.notEqual(issued[0].hash, token);
  create.mock.mockImplementation(async () => null);
  assert.deepEqual(await AuthService.forgotPassword({ email: 'missing@example.com' }), result);
  assert.equal(mail.length, 1);
});

test('failed email clears only its token and returns the same public response', async (t) => {
  let issuedHash;
  t.mock.method(identity, 'createPasswordReset', async (email, hash) => {
    issuedHash = hash;
    return { email };
  });
  const cancel = t.mock.method(identity, 'cancelPasswordReset', async () => {});
  t.mock.method(passwordResetMail, 'send', async () => { throw new Error('SMTP unavailable'); });
  t.mock.method(logger, 'warn', () => {});
  assert.deepEqual(await AuthService.forgotPassword({ email: 'test@example.com' }), { success: true });
  assert.deepEqual(cancel.mock.calls[0].arguments, [issuedHash]);
});

test('reset rejects invalid/expired tokens and hashes the new password', async (t) => {
  const reset = t.mock.method(identity, 'resetPassword', async () => ({ id: 'test' }));
  const token = 'a'.repeat(64);
  for (const body of [
    {}, { token: {} }, { token: 'short' },
    { token, password: 'short', password_confirmation: 'short' },
    { token, password: 'abcdef', password_confirmation: 'different' },
    { token, password: 'abcdef' },
    { token, password: ['abcdef'], password_confirmation: ['abcdef'] },
    { token, password: 'á'.repeat(37), password_confirmation: 'á'.repeat(37) },
  ]) {
    await assert.rejects(AuthService.resetPassword(body), { statusCode: 400 });
  }
  assert.equal(reset.mock.calls.length, 0);
  assert.deepEqual(await AuthService.resetPassword({ token, password: 'new-pass-123', password_confirmation: 'new-pass-123' }), { success: true });
  const [hash, password] = reset.mock.calls[0].arguments;
  assert.equal(hash, hashToken(token));
  assert.equal(await comparePassword('new-pass-123', password), true);
  reset.mock.mockImplementation(async () => null);
  await assert.rejects(AuthService.resetPassword({ token, password: 'abcdef', password_confirmation: 'abcdef' }), {
    statusCode: 400,
    message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
  });
});

test('reset URL uses trusted configuration and never a request host', (t) => {
  const previous = process.env.PASSWORD_RESET_URL;
  t.after(() => {
    if (previous === undefined) delete process.env.PASSWORD_RESET_URL;
    else process.env.PASSWORD_RESET_URL = previous;
  });
  process.env.PASSWORD_RESET_URL = 'https://shop.example/reset-password';
  assert.equal(passwordResetUrl('abc'), 'https://shop.example/reset-password#token=abc');
  process.env.PASSWORD_RESET_URL = 'javascript:alert(1)';
  assert.throws(() => passwordResetUrl('abc'));
});
