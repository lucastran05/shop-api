import { readFileSync } from 'node:fs';

const locations = JSON.parse(readFileSync(new URL('./data/locations.json', import.meta.url), 'utf8'));

export const PROVINCES = locations.provinces;
export const WARDS = locations.wards;

export const getProvinces = () => PROVINCES;

export const getWardsByProvince = (provinceCode) => {
  if (!provinceCode) return WARDS;
  return WARDS.filter((w) => w.province_code === String(provinceCode));
};

export const findProvinceByCode = (code) => PROVINCES.find((p) => p.code === String(code));
export const findWardByCode = (code) => WARDS.find((w) => w.code === String(code));
