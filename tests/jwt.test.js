import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
} from '../src/utils/jwt.js';

describe('Bảo mật Token JWT - Phân tách Access & Refresh Token', () => {
  const mockPayload = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    role: 'customer',
  };

  it('1. generateAccessToken phải tạo ra token hợp lệ với token_type là "access"', () => {
    const accessToken = generateAccessToken(mockPayload);
    assert.ok(typeof accessToken === 'string' && accessToken.length > 20);

    const decoded = verifyAccessToken(accessToken);
    assert.equal(decoded.id, mockPayload.id);
    assert.equal(decoded.email, mockPayload.email);
    assert.equal(decoded.role, mockPayload.role);
    assert.equal(decoded.token_type, 'access');
    assert.ok(decoded.jti, 'Phải có JTI duy nhất chống replay attack');
  });

  it('2. generateRefreshToken phải tạo ra token hợp lệ với token_type là "refresh"', () => {
    const refreshToken = generateRefreshToken(mockPayload);
    assert.ok(typeof refreshToken === 'string' && refreshToken.length > 20);

    const decoded = verifyRefreshToken(refreshToken);
    assert.equal(decoded.id, mockPayload.id);
    assert.equal(decoded.token_type, 'refresh');
    assert.ok(decoded.jti, 'Phải có JTI duy nhất chống replay attack');
  });

  it('3. CHỐNG LẠM DỤNG TOKEN CHÉO: Không thể dùng Refresh Token làm Access Token', () => {
    const refreshToken = generateRefreshToken(mockPayload);

    assert.throws(
      () => {
        verifyAccessToken(refreshToken);
      },
      (err) => {
        assert.ok(err);
        return true;
      },
      'verifyAccessToken phải từ chối Refresh Token'
    );
  });

  it('4. CHỐNG LẠM DỤNG TOKEN CHÉO: Không thể dùng Access Token làm Refresh Token', () => {
    const accessToken = generateAccessToken(mockPayload);

    assert.throws(
      () => {
        verifyRefreshToken(accessToken);
      },
      (err) => {
        assert.ok(err);
        return true;
      },
      'verifyRefreshToken phải từ chối Access Token'
    );
  });

  it('5. hashToken phải băm chuỗi bằng SHA-256 an toàn và nhất quán', () => {
    const token = 'sample-jwt-token-string-123456';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    assert.equal(typeof hash1, 'string');
    assert.equal(hash1.length, 64, 'SHA-256 hash phải có độ dài 64 ký tự hex');
    assert.equal(hash1, hash2, 'Hash của cùng một token phải trùng khớp');
    assert.notEqual(hash1, token, 'Hash không được trùng với token thô');
  });

  it('6. Từ chối token bị sửa đổi hoặc rác', () => {
    assert.throws(() => {
      verifyAccessToken('invalid.token.structure');
    });

    assert.throws(() => {
      verifyRefreshToken('malformed-token');
    });
  });
});
