import { BadRequestError } from "../../common/errors/AppError.js";

export function normalizeFlowerSpecies(value) {
  if (
    !Array.isArray(value) ||
    value.length > 20 ||
    value.some(
      (name) =>
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().replace(/\s+/g, " ").length > 150,
    )
  ) {
    throw new BadRequestError(
      "Loài hoa phải là danh sách tối đa 20 tên khoa học, mỗi tên từ 1 đến 150 ký tự",
    );
  }
  const names = new Map();
  for (const name of value) {
    const normalized = name.trim().replace(/\s+/g, " ");
    if (!names.has(normalized.toLowerCase()))
      names.set(normalized.toLowerCase(), normalized);
  }
  return [...names.values()];
}
