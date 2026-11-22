// Run only as an explicit local Compose one-off task. Never imported by server startup.
import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import pool from '../../config/db.js';
import catalogRepository from '../catalog/catalog.repository.js';
import { PRODUCTS } from '../../../scripts/demo-data/catalog.js';
import { isValidImageBuffer, removeStoredImage, storeImage } from '../../services/upload-storage.js';

const MARKER = 'bloomora_discovery_demo_v1';
const markerAttribute = (key) => ({ name: 'discovery_demo_key', label: 'Discovery demo key', value: MARKER + ':' + key });
const sourceDir = process.env.DISCOVERY_SEED_IMAGE_DIR;
const scenarios = [
  { key: 'sen-hong', name: 'Bình sen hồng Dịu Lành', species: 'sen', color: 'Hồng', category: 'Hoa theo mùa', price: 340000, stock: 12, image: 'hoa-sen.png', description: 'Bình sen hồng gợi nét thanh nhã và bình yên, phù hợp một lời hỏi thăm dịu dàng.' },
  { key: 'oai-huong', name: 'Bó oải hương tím An Nhiên', species: 'oải hương', color: 'Tím', category: 'Hoa bó', price: 390000, stock: 14, image: 'hoa-oai-huong.png', description: 'Oải hương tím nhạt gợi sự thư thái; dành cho người yêu không gian nhẹ nhàng.' },
  { key: 'cam-tu-cau', name: 'Chậu cẩm tú cầu xanh tím Chân Thành', species: 'cẩm tú cầu', color: 'Xanh tím', category: 'Hoa chậu', price: 460000, stock: 8, image: 'hoa-cam-tu-cau.png', description: 'Cẩm tú cầu xanh tím thường gợi sự chân thành, phù hợp lời cảm ơn hay xin lỗi.' },
  { key: 'mai-vang', name: 'Chậu mai vàng Đầu Xuân', species: 'mai', color: 'Vàng', category: 'Hoa chậu', price: 680000, stock: 5, image: 'hoa-mai-vang.png', description: 'Mai vàng thường gắn với ngày đầu năm và một khởi đầu mới.' },
  { key: 'dao-hong', name: 'Chậu đào hồng Khởi Sắc', species: 'đào', color: 'Hồng', category: 'Hoa chậu', price: 620000, stock: 6, image: 'hoa-dao.png', description: 'Hoa đào hồng gợi không khí mùa xuân và lời chúc cho hành trình mới.' },
  { key: 'dong-tien', name: 'Bó đồng tiền Rạng Rỡ', species: 'đồng tiền', color: 'Cam', category: 'Hoa bó', price: 270000, stock: 18, image: 'hoa-dong-tien.png', description: 'Hoa đồng tiền sắc cam gợi niềm vui, phù hợp chúc mừng tốt nghiệp hoặc sinh nhật.' },
  { key: 'cuc-hoa-mi', name: 'Bó cúc họa mi Trong Trẻo', species: 'cúc', color: 'Trắng', category: 'Hoa bó', price: 210000, stock: 20, image: 'hoa-cuc-hoa-mi.png', description: 'Cúc họa mi trắng nhẹ nhàng cho một lời cảm ơn hoặc món quà bạn bè.' },
  { key: 'cuc-thach-thao', name: 'Bó cúc thạch thảo Tím Nhớ', species: 'cúc', color: 'Tím', category: 'Hoa bó', price: 260000, stock: 16, image: 'hoa-cuc-thach-thao.png', description: 'Cúc thạch thảo tím mang gam màu dịu, phù hợp những khoảnh khắc hoài niệm.' },
  { key: 'mau-don', name: 'Bó mẫu đơn Hồng Tươi', species: 'mẫu đơn', color: 'Hồng', category: 'Hoa bó', price: 720000, stock: 7, image: 'hoa-mau-don.png', description: 'Mẫu đơn hồng rực rỡ cho một dịp chúc mừng hoặc kỷ niệm.' },
  { key: 'ly-trang', name: 'Bó hoa ly Trang Nhã', species: 'ly', color: 'Trắng', category: 'Hoa bó', price: 440000, stock: 9, image: 'hoa-ly.png', description: 'Hoa ly mang nét trang nhã, hợp lời tri ân thầy cô hoặc người thân.' },
  { key: 'lan-hue', name: 'Bình lan huệ Nổi Bật', species: 'lan huệ', color: 'Đỏ', category: 'Hoa chậu', price: 350000, stock: 10, image: 'hoa-lan-hue.png', description: 'Lan huệ sắc đỏ là điểm nhấn rực rỡ cho dịp chúc mừng.' },
];

const existingFlowers = PRODUCTS.filter((product) => !['Cây cảnh văn phòng', 'Sen đá & xương rồng'].includes(product.category));
const FLOWER_NAMES = Object.fromEntries([
  'anh-dao=anh đào', 'anh-thao=anh thảo', 'anh-tuc=anh túc', 'bang-lang=bằng lăng',
  'banksia=Banksia', 'bi-ngan=bỉ ngạn', 'bo-cong-anh=bồ công anh', 'cam-chuong=cẩm chướng',
  'cam-tu-cau=cẩm tú cầu', 'cang-cua=càng cua', 'cat-tuong=cát tường', 'chuoi-canh=chuối cảnh',
  'chuoi-pha-ke=chuối pháo', 'chuong-tuyet=chuông tuyết', 'co-thi=cỏ thi',
  'cuc-hoa-mi=cúc họa mi', 'cuc-mat-troi=cúc mặt trời', 'cuc-thach-thao=cúc thạch thảo',
  'cuc-van-tho=cúc vạn thọ', 'cuc-xu=cúc xù', 'cuc-zinnia=cúc Zinnia',
  'da-lan-huong=dạ lan hương', 'dam-but=dâm bụt', 'danh-danh=dành dành',
  'dao=đào', 'dau-biec=đậu biếc', 'dau-thom=dâu thơm', 'da-yen-thao=dạ yến thảo',
  'dien-vi=diên vĩ', 'dong-tien=đồng tiền', 'do-quyen=đỗ quyên',
  'gaillardia=Gaillardia', 'giay=giấy', 'hai-quy=hải quỳ', 'hellebore=Hellebore',
  'hong-anh=hồng anh', 'hong-hoa=hồng hoa', 'hong-mon=hồng môn', 'hue=huệ',
  'huong-duong=hướng dương', 'huynh-anh=huỳnh anh', 'kim-ngan=kim ngân',
  'lac-tien=lạc tiên', 'lan-hue=lan huệ', 'lan-nam-phi=lan Nam Phi',
  'lay-on=lay ơn', 'lien-kieu=liên kiều', 'linh-lan=linh lan',
  'long-den=lồng đèn', 'luu-ly=lưu ly', 'ly=ly', 'mai-vang=mai vàng',
  'man=mận', 'man-dinh-hong=mãn đình hồng', 'mao-dia-hoang=mao địa hoàng',
  'mao-ga=mào gà', 'mao-luong=mao lương', 'ma-tien-thao=mã tiên thảo',
  'mau-don=mẫu đơn', 'mo=mơ', 'moc-lan=mộc lan', 'mom-soi=mõm sói',
  'muoi-gio=mười giờ', 'nghe-tay=nghệ tây', 'ngu-sac=ngũ sắc',
  'nhai=nhài', 'nhai-dong=nhài đông', 'nhung-tuyet=nhung tuyết',
  'oai-huong=oải hương', 'pan-xe=pan xê', 'phi=phi', 'phi-yen=phi yến',
  'phong-lu=phong lữ', 'phuong-vy=phượng vĩ', 'protea=Protea',
  'rum=rum', 'sao-nhai=sao nhái', 'scabiosa=Scabiosa',
  'sedum=Sedum', 'sen=sen', 'sen-can=sen cạn', 'statice=Statice',
  'su=sứ', 'thach-nam=thạch nam', 'thanh-cuc=thanh cúc',
  'thanh-lieu=thanh liễu', 'thien-dieu=thiên điểu', 'thu-hai-duong=thu hải đường',
  'thuoc-duoc=thược dược', 'thuy-tien=thủy tiên', 'thuy-tien-trang=thủy tiên trắng',
  'tien-khach-lai=tiên khách lai', 'tim-vo=tim vỡ', 'tra-mi=trà mi',
  'trang-do=trang đỏ', 'trang-nguyen=trạng nguyên', 'tu-dang=tử đằng',
  'tu-huong=tử hương', 'violet=violet', 'xa-vi=xạ hương',
].map((value) => value.split('=')));

async function prepareEntries() {
  const files = sourceDir
    ? (await readdir(sourceDir)).filter((name) => /^hoa-[a-z0-9-]+\.png$/.test(name)).sort()
    : [];
  if (sourceDir && (!files.length || files.length > 500)) {
    throw new Error('Expected 1–500 named flower PNG files in DISCOVERY_SEED_IMAGE_DIR.');
  }
  const fromCatalog = existingFlowers.map((product) => {
    const variant = product.variants[0];
    return {
      key: 'catalog-' + variant.id,
      name: product.name,
      species: { rose: 'hồng', sunflower: 'hướng dương', tulip: 'tulip', baby: 'baby',
        hydrangea: 'cẩm tú cầu', carnation: 'cẩm chướng', orchid: 'lan', mix: 'hồng' }[product.flower] ||
        (product.category === 'Lan hồ điệp' ? 'lan' : 'hồng'),
      category: product.category,
      color: variant.color,
      price: variant.price,
      oldPrice: variant.old_price ?? null,
      stock: variant.stock,
      pinned: Boolean(product.pinned),
      description: product.description,
      imagePath: new URL('../../../scripts/demo-data/images/' + variant.id + '.png', import.meta.url),
    };
  });
  const prices = [190000, 230000, 280000, 340000, 420000, 550000];
  const fromUploads = files.map((filename, index) => {
    const slug = filename.slice(4, -4);
    const label = FLOWER_NAMES[slug];
    if (!label) throw new Error('Missing Vietnamese label for ' + filename);
    const curated = scenarios.find((item) => item.image === filename);
    return {
      key: 'upload-' + slug,
      name: curated?.name || 'Hoa ' + label,
      species: curated?.species || label,
      color: curated?.color || 'Theo ảnh',
      category: curated?.category || 'Hoa theo loài',
      price: curated?.price || prices[index % prices.length],
      stock: curated?.stock || 5 + (index % 15),
      description: curated?.description || 'Hoa ' + label + ' trong bộ sưu tập minh họa đa dạng các loài hoa.',
      imagePath: join(sourceDir, filename),
    };
  });
  const entries = [...fromCatalog, ...fromUploads];
  if (!entries.length) throw new Error('No bundled or mounted demo products were found.');
  return entries;
}

function assertLocal() {
  const host = new URL(process.env.CLIENT_URL || '').hostname;
  if (process.env.DISCOVERY_LOCAL_SEED !== '1' || !['localhost', '127.0.0.1'].includes(host)) {
    throw new Error('Local seed requires DISCOVERY_LOCAL_SEED=1 and CLIENT_URL on localhost.');
  }
  if (process.env.UPLOAD_STORAGE !== 'local') throw new Error('Local seed requires local upload storage.');
}

async function ownedRows(client) {
  const { rows } = await client.query(
    "SELECT id,name,image FROM products WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(attributes)='array' THEN attributes ELSE '[]'::jsonb END) attr WHERE attr->>'name'='discovery_demo_key' AND attr->>'value' LIKE $1)",
    [MARKER + ':%'],
  );
  return rows;
}

async function seed() {
  const entries = await prepareEntries();
  for (const entry of entries) {
    const buffer = await readFile(entry.imagePath);
    if (!isValidImageBuffer(buffer, 'image/png')) throw new Error('Invalid PNG: ' + entry.key);
    if (!(entry.price > 0 && entry.stock > 0)) throw new Error('Invalid price/stock: ' + entry.key);
  }
  const client = await pool.connect();
  let created = 0, skipped = 0;
  try {
    for (const entry of entries) {
      let uploadedName = null;
      let committed = false;
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('bloomora_discovery_demo_v1'))");
        const marker = markerAttribute(entry.key);
        const found = await client.query('SELECT id FROM products WHERE attributes @> $1::jsonb LIMIT 1', [JSON.stringify([marker])]);
        if (found.rowCount) {
          await client.query('COMMIT');
          committed = true;
          skipped++;
          continue;
        }
        await client.query('INSERT INTO categories(name) VALUES($1) ON CONFLICT(name) DO NOTHING', [entry.category]);
        const category = await client.query('SELECT id FROM categories WHERE name=$1', [entry.category]);
        const buffer = await readFile(entry.imagePath);
        const stored = await storeImage({ buffer, mimetype: 'image/png' });
        uploadedName = stored.fileName;
        const image = '/uploads/' + uploadedName;
        await catalogRepository.createUpload({
          url: image, file_name: entry.key + '.png', mime_type: 'image/png',
          size_bytes: buffer.length, purpose: 'product',
        }, client);
        const variant = {
          id: 'bm-' + entry.key, label: 'Tiêu chuẩn', color: entry.color,
          image, price: entry.price, old_price: entry.oldPrice ?? null,
          stock_quantity: entry.stock, stock: entry.stock,
        };
        await catalogRepository.create({
          name: entry.name, category: entry.category, category_id: category.rows[0].id,
          description: entry.description + ' Ảnh minh họa cho dữ liệu demo local.',
          price: entry.price, old_price: entry.oldPrice ?? null, stock: entry.stock,
          image, images: [{ id: '1', url: image, alt_text: entry.name, sort_order: 1 }],
          variants: [variant], attributes: [marker, { name: 'demo', label: 'Dữ liệu', value: 'Bloomora Moments local demo' }],
          flower_species: [entry.species], is_pinned: entry.pinned || false,
          is_active: true, allow_deposit: false,
        }, client);
        await client.query('COMMIT');
        committed = true;
        created++;
      } catch (error) {
        if (!committed) await client.query('ROLLBACK').catch(() => {});
        if (uploadedName) await removeStoredImage(uploadedName).catch(() => {});
        throw error;
      }
    }
    console.log(JSON.stringify({ seed: MARKER, planned: entries.length, created, skipped }));
  } finally {
    client.release();
  }
}

async function plan() {
  const entries = await prepareEntries();
  for (const entry of entries) {
    const buffer = await readFile(entry.imagePath);
    if (!isValidImageBuffer(buffer, 'image/png')) throw new Error('Invalid PNG: ' + entry.key);
  }
  console.log(JSON.stringify({ seed: MARKER, planned: entries.length, fromShopUploads: entries.filter((entry) => entry.key.startsWith('upload-')).length }));
}

async function rollback() {
  const client = await pool.connect();
  let removed = 0, retained = 0;
  try {
    for (const product of await ownedRows(client)) {
      const imageName = product.image.match(/^\/uploads\/([a-f0-9-]{36}\.png)$/)?.[1];
      if (!imageName) { retained++; continue; }
      try {
        await client.query('BEGIN');
        const order = await client.query('SELECT 1 FROM order_items WHERE product_id=$1 LIMIT 1', [product.id]);
        if (order.rowCount) { await client.query('ROLLBACK'); retained++; continue; }
        await client.query('DELETE FROM products WHERE id=$1', [product.id]);
        await client.query("DELETE FROM uploads WHERE url=$1 AND purpose='product'", [product.image]);
        await client.query('COMMIT');
        await removeStoredImage(imageName);
        removed++;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      }
    }
    console.log(JSON.stringify({ seed: MARKER, removed, retainedWithOrdersOrUnexpectedImage: retained }));
  } finally {
    client.release();
  }
}

async function normalizeDemoNames() {
  const suffix = ' · bộ sưu tập demo';
  const client = await pool.connect();
  let updated = 0;
  try {
    for (const product of await ownedRows(client)) {
      if (!product.name.endsWith(suffix)) continue;
      await client.query('UPDATE products SET name=$2 WHERE id=$1',
        [product.id, product.name.slice(0, -suffix.length)]);
      updated++;
    }
    console.log(JSON.stringify({ seed: MARKER, normalizedNames: updated }));
  } finally { client.release(); }
}

try {
  assertLocal();
  if (process.argv.includes('--rollback')) await rollback();
  else if (process.argv.includes('--normalize-names')) await normalizeDemoNames();
  else if (process.argv.includes('--plan')) await plan();
  else await seed();
} catch (error) {
  console.error('Discovery local seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
