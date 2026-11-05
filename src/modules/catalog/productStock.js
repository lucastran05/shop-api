// Đọc/ghi tồn kho sản phẩm. Tồn kho nằm trong từng biến thể (products.variants, JSONB);
// cột products.stock luôn là tổng tồn của các biến thể.

// Cột JSONB thường đã là mảng; dữ liệu cũ có thể lưu chuỗi JSON nên đọc an toàn ở một chỗ.
export function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// stock_quantity là tên trường hiện tại, stock là tên cũ còn trong dữ liệu.
export const variantStock = (variant, fallback = 0) =>
  Number(variant?.stock_quantity ?? variant?.stock ?? fallback) || 0;

export const totalStock = (variants) =>
  variants.reduce((sum, variant) => sum + variantStock(variant), 0);

export const findVariant = (variants, variantId) =>
  variants.find((variant) => String(variant.id) === String(variantId));

// Khóa dòng sản phẩm trong transaction hiện tại để đọc rồi ghi tồn kho an toàn.
export async function lockProduct(client, productId) {
  const { rows } = await client.query(
    'SELECT id, name, stock, variants, active FROM products WHERE id = $1 FOR UPDATE;',
    [productId],
  );
  return rows[0] ? { ...rows[0], variants: parseJsonArray(rows[0].variants) } : null;
}

// Tồn hiện tại của biến thể; sản phẩm không có biến thể khớp thì dùng products.stock.
export function currentStock(product, variantId) {
  const variant = findVariant(product.variants, variantId);
  return variant ? variantStock(variant, product.stock) : Number(product.stock) || 0;
}

// Ghi tồn mới cho biến thể (hoặc cho sản phẩm nếu không có biến thể khớp) và cập nhật tổng tồn.
export async function saveStock(client, product, variantId, newStock) {
  const variant = findVariant(product.variants, variantId);
  if (!variant) {
    await client.query(
      'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;',
      [newStock, product.id],
    );
    return;
  }
  const variants = product.variants.map((item) =>
    item === variant ? { ...item, stock_quantity: newStock, stock: newStock } : item,
  );
  await client.query(
    'UPDATE products SET stock = $1, variants = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3;',
    [totalStock(variants), JSON.stringify(variants), product.id],
  );
}
