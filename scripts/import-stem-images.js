// Nhập ảnh cành hoa cho trang "Tự tạo bó hoa" (chạy thủ công, không chạy khi khách thao tác).
//
//   npm run import:stems                      nhập ảnh cho mọi biến thể hoa bán theo cành còn thiếu ảnh Pexels
//   npm run import:stems -- --only=hong-canh-do,baby-canh-trang
//   npm run import:stems -- --force           nhập lại kể cả biến thể đã có ảnh Pexels
//   npm run import:stems -- --dry-run         chỉ in ảnh sẽ chọn, không ghi storage / DB
//   npm run import:stems -- --dir=E:\anh-canh  nạp ảnh nhóm tự chuẩn bị, tên file = mã biến thể
//                                             (hong-canh-do.png, baby-canh-trang.webp ...)
//
// Biến môi trường (chỉ đọc từ shop-api/.env, không bao giờ đưa ra frontend):
//   PEXELS_API_KEY      tìm ảnh qua Pexels Photo Search API
//   REMOVE_BG_API_KEY   (tùy chọn) tách nền bằng remove.bg -> PNG nền trong suốt
//   REMOVE_BG_SIZE      (tùy chọn) preview | auto | full ...; mặc định preview (gói miễn phí)
//
// Kết quả ghi vào products.variants[i]:
//   stem_photo  = ảnh gốc Pexels đã lưu qua storeImage() + photographer, photographer_url, pexels_url,
//                 pexels_id, background_removed
//   stem_image  = PNG nền trong suốt cho Canvas: ảnh remove.bg nếu tách nền thành công,
//                 nếu không thì giữ / tạo ảnh vẽ dự phòng (stem-art.js). variant.image không bị ghi đè.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pool, { initDB } from '../src/config/db.js';
import { withTransaction } from '../src/config/transaction.js';
import { removeStoredImage, storeImage } from '../src/services/upload-storage.js';
import catalogRepository from '../src/modules/catalog/catalog.repository.js';
import { findVariant, parseJsonArray } from '../src/modules/catalog/productStock.js';
import { renderStemPng } from './demo-data/stem-art.js';
import { attribution, hasTransparency, pickPhoto, stemConfig } from './demo-data/stem-photos.js';

const PEXELS_API = (process.env.PEXELS_API_BASE || 'https://api.pexels.com').replace(/\/+$/, '');
const REMOVE_BG_API = process.env.REMOVE_BG_API_URL || 'https://api.remove.bg/v1.0/removebg';
const TIMEOUT_MS = 30000;

class ServiceError extends Error {
  constructor(service, kind, message) {
    super(`${service}: ${message}`);
    this.service = service;
    this.kind = kind; // auth | rate_limit | credits | no_result | http | network
  }
}

function parseArgs(argv) {
  const only = argv.find((arg) => arg.startsWith('--only='))?.slice(7).split(',').map((id) => id.trim()).filter(Boolean);
  const dir = argv.find((arg) => arg.startsWith('--dir='))?.slice(6);
  return { only: only?.length ? new Set(only) : null, force: argv.includes('--force'), dryRun: argv.includes('--dry-run'), dir };
}

const FILE_TYPES = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

async function findLocalFile(dir, variantId) {
  for (const [extension, mimetype] of Object.entries(FILE_TYPES)) {
    const path = join(dir, `${variantId}.${extension}`);
    try {
      return { path, mimetype, buffer: await readFile(path) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return null;
}

// Ảnh nền trong suốt dùng làm stem_image cho Canvas; ảnh còn nền chỉ dùng làm ảnh minh họa (stem_photo)
async function importFromDir(products, args) {
  const dir = resolve(args.dir);
  const report = [];
  for (const product of products) {
    for (const variant of parseJsonArray(product.variants)) {
      if (args.only && !args.only.has(String(variant.id))) continue;
      const row = { variant: variant.id, label: `${product.name} / ${variant.color || variant.id}`, result: '' };
      report.push(row);
      const file = await findLocalFile(dir, variant.id);
      if (!file) {
        row.result = 'không có file, giữ ảnh hiện có';
        continue;
      }
      const transparent = hasTransparency(file.buffer, file.mimetype);
      if (args.dryRun) {
        row.result = transparent ? `sẽ dùng ${basename(file.path)}` : `${basename(file.path)} còn nền, chỉ dùng làm ảnh minh họa`;
        continue;
      }
      const url = await upload(file.buffer, file.mimetype, basename(file.path));
      const fields = transparent
        ? { image: url, stem_image: url, stem_image_source: 'upload', stem_photo: null }
        : { stem_photo: { url, background_removed: false } };
      const previous = await saveVariantFields(product.id, variant.id, fields);
      await cleanup(
        [transparent ? previous.stem_image : null, previous.stem_photo?.url],
        new Set([previous.image, url, transparent ? null : previous.stem_image].filter(Boolean)),
      );
      row.result = transparent
        ? `đã nạp ${basename(file.path)}`
        : `${basename(file.path)} chưa tách nền: chỉ hiện ở danh sách, Canvas giữ ảnh cũ`;
    }
  }
  console.table(report);
}

async function request(service, url, init) {
  let response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw new ServiceError(service, 'network', `không kết nối được (${error.cause?.code || error.name})`);
  }
  if (response.ok) return response;
  const detail = (await response.text().catch(() => '')).slice(0, 200);
  if (response.status === 401 || response.status === 403) throw new ServiceError(service, 'auth', `API key không hợp lệ (HTTP ${response.status})`);
  if (response.status === 402) throw new ServiceError(service, 'credits', 'hết credit (HTTP 402)');
  if (response.status === 429) throw new ServiceError(service, 'rate_limit', 'vượt giới hạn số request (HTTP 429)');
  throw new ServiceError(service, 'http', `HTTP ${response.status} ${detail}`);
}

async function findPexelsPhoto(key, config, variant) {
  const headers = { Authorization: key };
  if (config.pexels_id) {
    const response = await request('Pexels', `${PEXELS_API}/v1/photos/${encodeURIComponent(config.pexels_id)}`, { headers });
    return response.json();
  }
  if (!config.query) throw new ServiceError('Pexels', 'no_result', 'không suy ra được từ khóa tìm kiếm');
  const params = new URLSearchParams({ query: config.query, orientation: 'portrait', per_page: '20' });
  const response = await request('Pexels', `${PEXELS_API}/v1/search?${params}`, { headers });
  const { photos = [] } = await response.json();
  const photo = pickPhoto(photos, { flower: config.flower, colorName: variant.color });
  if (!photo) throw new ServiceError('Pexels', 'no_result', `không có ảnh phù hợp cho "${config.query}"`);
  return photo;
}

async function download(url) {
  const response = await request('Pexels', url);
  const mimetype = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  return { buffer: Buffer.from(await response.arrayBuffer()), mimetype };
}

async function removeBackground(key, imageUrl) {
  const form = new FormData();
  form.append('image_url', imageUrl);
  form.append('size', process.env.REMOVE_BG_SIZE || 'preview');
  form.append('format', 'png');
  const response = await request('remove.bg', REMOVE_BG_API, { method: 'POST', headers: { 'X-Api-Key': key }, body: form });
  return Buffer.from(await response.arrayBuffer());
}

async function upload(buffer, mimetype, name) {
  const { fileName } = await storeImage({ buffer, mimetype, size: buffer.length });
  const baseUrl = (process.env.PUBLIC_API_URL || '').replace(/\/+$/, '');
  const record = await catalogRepository.createUpload({
    url: `${baseUrl}/uploads/${fileName}`, file_name: name, mime_type: mimetype, size_bytes: buffer.length, purpose: 'product',
  });
  return record.url;
}

// Ghi đè các trường ảnh cành của một biến thể (đọc lại trong transaction để không ghi đè tồn kho vừa đổi)
async function saveVariantFields(productId, variantId, fields) {
  return withTransaction(pool, async (client) => {
    const { rows } = await client.query('SELECT variants FROM products WHERE id = $1 FOR UPDATE;', [productId]);
    const variants = parseJsonArray(rows[0]?.variants);
    const previous = findVariant(variants, variantId);
    if (!previous) throw new Error(`Biến thể ${variantId} không còn tồn tại`);
    const next = variants.map((variant) => (variant === previous ? { ...variant, ...fields } : variant));
    await client.query('UPDATE products SET variants = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;', [JSON.stringify(next), productId]);
    // Đổi ảnh của màu thì đổi luôn ảnh đại diện / bộ ảnh sản phẩm đang dùng ảnh cũ
    if (fields.image && previous.image && fields.image !== previous.image) {
      await client.query(
        `UPDATE products SET image = CASE WHEN image = $1 THEN $2 ELSE image END,
           images = replace(images::text, to_json($1::text)::text, to_json($2::text)::text)::jsonb
         WHERE id = $3;`,
        [previous.image, fields.image, productId],
      );
    }
    return previous;
  });
}

// Xóa file cũ đã bị thay (chỉ ảnh trong /uploads/ và không còn được dùng làm ảnh thẻ sản phẩm)
async function cleanup(urls, keep) {
  for (const url of urls) {
    if (!url || keep.has(url) || !url.includes('/uploads/')) continue;
    await removeStoredImage(url.split('/').pop()).catch(() => {});
    await pool.query('DELETE FROM uploads WHERE url = $1;', [url]);
  }
}

async function fallbackImage(product, variant, config) {
  if (!config.flower) return null;
  return upload(renderStemPng({ flower: config.flower, color: config.color }), 'image/png', `${variant.id}-stem.png`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.dir) {
    await initDB();
    const { rows } = await pool.query('SELECT id, name, variants FROM products WHERE sold_by_stem = TRUE ORDER BY name;');
    if (!rows.length) console.log('Chưa có sản phẩm bán theo cành. Chạy `npm run seed:demo` trước.');
    else await importFromDir(rows, args);
    return;
  }
  const pexelsKey = process.env.PEXELS_API_KEY?.trim();
  let removeBgKey = process.env.REMOVE_BG_API_KEY?.trim();
  let pexelsEnabled = Boolean(pexelsKey);
  if (!pexelsKey) console.warn('⚠️  Chưa có PEXELS_API_KEY trong .env: chỉ tạo ảnh vẽ dự phòng cho biến thể còn thiếu ảnh cành.');
  if (pexelsKey && !removeBgKey) console.warn('⚠️  Chưa có REMOVE_BG_API_KEY: lưu ảnh gốc (đánh dấu chưa tách nền), Canvas tiếp tục dùng ảnh vẽ dự phòng.');

  await initDB();
  const { rows: products } = await pool.query(
    'SELECT id, name, variants FROM products WHERE sold_by_stem = TRUE ORDER BY name;',
  );
  if (!products.length) {
    console.log('Chưa có sản phẩm bán theo cành (products.sold_by_stem). Chạy `npm run seed:demo` trước.');
    return;
  }

  const report = [];
  for (const product of products) {
    for (const variant of parseJsonArray(product.variants)) {
      if (args.only && !args.only.has(String(variant.id))) continue;
      const config = stemConfig(product, variant);
      const label = `${product.name} / ${variant.color || variant.id}`;
      const row = { variant: variant.id, label, result: '', credit: '' };
      report.push(row);

      if (pexelsEnabled && variant.stem_photo?.pexels_id && !args.force) {
        row.result = 'bỏ qua (đã có ảnh Pexels, dùng --force để nhập lại)';
        continue;
      }

      let photo = null;
      if (pexelsEnabled) {
        try {
          photo = await findPexelsPhoto(pexelsKey, config, variant);
        } catch (error) {
          if (!(error instanceof ServiceError)) throw error;
          row.result = error.message;
          if (['auth', 'rate_limit'].includes(error.kind)) {
            console.error(`❌ ${error.message}. Dừng gọi Pexels, các biến thể còn lại dùng ảnh dự phòng.`);
            pexelsEnabled = false;
          }
        }
      }

      if (args.dryRun) {
        row.result = photo ? `sẽ dùng ảnh Pexels #${photo.id}: ${photo.alt || ''}` : (row.result || 'sẽ dùng ảnh vẽ dự phòng nếu còn thiếu');
        if (photo) row.credit = `Ảnh: ${photo.photographer} / Pexels`;
        continue;
      }

      if (!photo) {
        if (variant.stem_image) {
          row.result = `${row.result ? row.result + '; ' : ''}giữ ảnh cành hiện có`;
          continue;
        }
        const url = await fallbackImage(product, variant, config);
        if (url) await saveVariantFields(product.id, variant.id, { stem_image: url, stem_image_source: 'generated' });
        row.result = `${row.result ? row.result + '; ' : ''}${url ? 'đã tạo ảnh vẽ dự phòng' : 'không có mẫu vẽ cho loại hoa này'}`;
        continue;
      }

      const sourceUrl = photo.src?.large || photo.src?.medium || photo.src?.original;
      let photoUrl;
      try {
        const original = await download(sourceUrl);
        photoUrl = await upload(original.buffer, original.mimetype, `${variant.id}-pexels-${photo.id}.${original.mimetype === 'image/png' ? 'png' : 'jpg'}`);
      } catch (error) {
        if (!(error instanceof ServiceError) && error.statusCode !== 415) throw error;
        row.result = `không tải được ảnh Pexels #${photo.id} (${error.message}); giữ ảnh cành hiện có`;
        continue;
      }

      let cutoutUrl = null;
      if (removeBgKey) {
        try {
          const png = await removeBackground(removeBgKey, sourceUrl);
          cutoutUrl = await upload(png, 'image/png', `${variant.id}-pexels-${photo.id}-cutout.png`);
        } catch (error) {
          if (!(error instanceof ServiceError) && error.statusCode !== 415) throw error;
          row.result = `${error.message}; `;
          if (['auth', 'credits', 'rate_limit'].includes(error.kind)) {
            console.error(`❌ ${error.message}. Dừng gọi remove.bg.`);
            removeBgKey = null;
          }
        }
      }

      const fields = {
        stem_photo: { url: photoUrl, ...attribution(photo), background_removed: Boolean(cutoutUrl) },
      };
      if (cutoutUrl) {
        fields.stem_image = cutoutUrl;
        fields.stem_image_source = 'remove.bg';
      } else if (!variant.stem_image) {
        fields.stem_image = await fallbackImage(product, variant, config);
        fields.stem_image_source = 'generated';
      }
      const previous = await saveVariantFields(product.id, variant.id, fields);
      await cleanup(
        [previous.stem_photo?.url, cutoutUrl ? previous.stem_image : null],
        new Set([previous.image, fields.stem_image, photoUrl].filter(Boolean)),
      );
      row.result += cutoutUrl ? `Pexels #${photo.id}, đã tách nền` : `Pexels #${photo.id}, chưa tách nền (Canvas dùng ảnh vẽ dự phòng)`;
      row.credit = `Ảnh: ${photo.photographer} / Pexels`;
    }
  }

  console.table(report.map(({ variant, label, result, credit }) => ({ variant, label, result, credit })));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
