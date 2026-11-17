// Hoa bán theo cành (products.sold_by_stem = TRUE): mỗi biến thể là một màu, price là giá một cành,
// stock là số cành. Ngoài variant.image (ảnh thẻ sản phẩm), biến thể có thể có:
//   stem_image  - URL ảnh PNG nền trong suốt của một cành, dùng để vẽ ảnh xem trước bó hoa
//   stem_photo  - ảnh gốc nhập từ Pexels: { url, photographer, photographer_url, pexels_url, pexels_id, background_removed }
//   stem_image_source - 'generated' | 'remove.bg' | 'upload' (công cụ Tách nền ảnh hoặc import --dir)
export const STEM_IMAGE_FIELDS = ['stem_image', 'stem_photo', 'stem_image_source'];

// Form quản trị chỉ gửi các trường cơ bản của biến thể. Sửa giá/tồn thì giữ ảnh cành đã có;
// admin đổi ảnh biến thể thì bỏ ảnh cành cũ để mọi trang cùng dùng ảnh mới.
export function keepStemImageFields(nextVariants, previousVariants) {
  if (!Array.isArray(nextVariants) || !Array.isArray(previousVariants)) return nextVariants;
  const previousById = new Map(previousVariants.map((variant) => [String(variant?.id), variant]));
  return nextVariants.map((variant) => {
    const previous = previousById.get(String(variant?.id));
    if (!previous || !variant || typeof variant !== 'object') return variant;
    if (variant.image !== undefined && (variant.image || '') !== (previous.image || '')) return variant;
    const kept = {};
    for (const field of STEM_IMAGE_FIELDS) {
      if (variant[field] === undefined && previous[field] !== undefined) kept[field] = previous[field];
    }
    return { ...variant, ...kept };
  });
}
