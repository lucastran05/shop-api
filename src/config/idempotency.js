import { createHash } from 'node:crypto';
import { BadRequestError, ConflictError } from '../common/errors/AppError.js';

// Run inside the operation's transaction so its result and effects commit together.
export async function withIdempotency(client, { actorId, key, operation, payload }, work) {
  if (key === undefined) return work();
  if (!actorId || typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,200}$/.test(key)) {
    throw new BadRequestError('Khóa chống gửi lặp không hợp lệ');
  }
  const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`request:${actorId}:${operation}:${key}`]);
  const previous = (await client.query(
    'SELECT request_hash, response FROM idempotency_requests WHERE actor_id=$1 AND operation=$2 AND request_key=$3',
    [actorId, operation, key],
  )).rows[0];
  if (previous) {
    if (previous.request_hash !== fingerprint) throw new ConflictError('Khóa chống gửi lặp đã dùng cho nội dung khác');
    return previous.response;
  }
  const result = await work();
  await client.query(
    'INSERT INTO idempotency_requests(actor_id,operation,request_key,request_hash,response) VALUES($1,$2,$3,$4,$5)',
    [actorId, operation, key, fingerprint, JSON.stringify(result)],
  );
  return result;
}
