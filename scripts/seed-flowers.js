import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pool from '../src/config/db.js';

const products = JSON.parse(await readFile(new URL('./flower-data.json', import.meta.url), 'utf8'));
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('seed-flowers-v1', 0))");
  let added = 0;
  for (const p of products) {
    await client.query('INSERT INTO categories(name) VALUES($1) ON CONFLICT(name) DO NOTHING', [p.category]);
    const hex = createHash('sha256').update('abc-shop-flower-v1:' + p.sku).digest('hex').slice(0, 32);
    const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    const image = `/flowers/${p.sku}.svg`;
    const variants = [
      { id: 'standard', label: 'Tiêu chuẩn', price: p.price, stock: 8, stock_quantity: 8, image, color: p.flower },
      { id: 'premium', label: 'Thêm hoa', price: Math.round(p.price * 1.4 / 1000) * 1000, stock: 4, stock_quantity: 4, image, color: p.flower },
    ];
    const attributes = [
      { name: 'flower', label: 'Loại hoa', value: p.flower },
      { name: 'season', label: 'Mùa gợi ý', value: p.seasons.join(', ') },
      { name: 'months', label: 'Tháng gợi ý', value: p.months.join(', ') },
      { name: 'occasions', label: 'Dịp tặng', value: p.occasions.join(', ') },
      { name: 'catalog_note', label: 'Lưu ý', value: 'Sản phẩm mẫu; ảnh minh họa. Mùa/tháng là bộ sưu tập gợi ý, nguồn hoa cần xác nhận với shop.' },
      { name: 'flower_profile', value: JSON.stringify(p) },
    ];
    const result = await client.query(`INSERT INTO products(id,name,category,description,price,stock,image,images,variants,attributes,active)
      VALUES($1,$2,$3,$4,$5,12,$6,$7,$8,$9,TRUE) ON CONFLICT(id) DO NOTHING RETURNING id`,
    [id,p.name,p.category,p.advice + '\nDanh mục mẫu của shop. Giá và tồn kho demo; ảnh minh họa, không phải ảnh chụp bó hoa thực tế.',p.price,image,
      JSON.stringify([{id:'1',url:image,alt_text:p.name,sort_order:1}]),JSON.stringify(variants),JSON.stringify(attributes)]);
    added += result.rowCount;
  }
  await client.query('COMMIT');
  console.log(`Flowers: inserted ${added}, preserved ${products.length - added} existing records.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally { client.release(); await pool.end(); }
