// Vẽ ảnh PNG nền trong suốt cho một cành hoa (ảnh dự phòng khi chưa nhập ảnh thật từ Pexels / remove.bg).
// Không dùng thư viện ngoài: tự rasterize vài hình cơ bản có khử răng cưa rồi nén PNG bằng zlib.
import { deflateSync } from 'node:zlib';

const SS = 4; // số mẫu con mỗi chiều cho một pixel (khử răng cưa)

const toRgb = (hex) => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
};
// amount > 0 làm sáng, < 0 làm tối
const shade = ([r, g, b], amount) => [r, g, b].map((c) =>
  Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount)));

function seeded(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

class Raster {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Float32Array(width * height * 4); // RGB nhân trước alpha + alpha
  }

  fill([x0, y0, x1, y1], inside, rgb, alpha = 1) {
    const minX = Math.max(0, Math.floor(x0));
    const minY = Math.max(0, Math.floor(y0));
    const maxX = Math.min(this.width - 1, Math.ceil(x1));
    const maxY = Math.min(this.height - 1, Math.ceil(y1));
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        let hits = 0;
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            if (inside(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS)) hits++;
          }
        }
        if (!hits) continue;
        const cover = (hits / (SS * SS)) * alpha;
        const i = (py * this.width + px) * 4;
        for (let c = 0; c < 3; c++) this.data[i + c] = (rgb[c] / 255) * cover + this.data[i + c] * (1 - cover);
        this.data[i + 3] = cover + this.data[i + 3] * (1 - cover);
      }
    }
  }

  circle(cx, cy, r, rgb, alpha) {
    this.fill([cx - r, cy - r, cx + r, cy + r], (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r, rgb, alpha);
  }

  ellipse(cx, cy, rx, ry, angle, rgb, alpha) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const r = Math.max(rx, ry);
    this.fill([cx - r, cy - r, cx + r, cy + r], (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const u = dx * cos + dy * sin;
      const v = -dx * sin + dy * cos;
      return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1;
    }, rgb, alpha);
  }

  // Đoạn thẳng có đầu tròn (dùng cho thân, cuống)
  capsule(x1, y1, x2, y2, r, rgb, alpha) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    this.fill([Math.min(x1, x2) - r, Math.min(y1, y2) - r, Math.max(x1, x2) + r, Math.max(y1, y2) + r], (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
      return (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2 <= r * r;
    }, rgb, alpha);
  }

  toPng() {
    const { width, height, data } = this;
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++) {
      raw[y * (width * 4 + 1)] = 0;
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const o = y * (width * 4 + 1) + 1 + x * 4;
        const a = data[i + 3];
        for (let c = 0; c < 3; c++) raw[o + c] = a > 0 ? Math.round(Math.min(1, data[i + c] / a) * 255) : 0;
        raw[o + 3] = Math.round(a * 255);
      }
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8; // bit depth
    header[9] = 6; // RGBA
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

const GREEN = toRgb('#4f7d3a');
const LEAF = toRgb('#5f9145');

// Thân cong nhẹ từ gốc lên tới đầu hoa, kèm hai lá
function drawStem(raster, headX, headY, random) {
  const { width, height } = raster;
  const baseX = width / 2 + (random() - 0.5) * 16;
  const bend = (random() - 0.5) * 30;
  let prev = [baseX, height - 6];
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const x = (1 - t) ** 2 * baseX + 2 * (1 - t) * t * (width / 2 + bend) + t * t * headX;
    const y = (1 - t) ** 2 * (height - 6) + 2 * (1 - t) * t * ((height + headY) / 2) + t * t * headY;
    raster.capsule(prev[0], prev[1], x, y, 4.2, GREEN);
    prev = [x, y];
  }
  for (const [t, side] of [[0.55, -1], [0.7, 1]]) {
    const y = headY + (height - headY) * t;
    const x = width / 2 + bend * 0.4;
    const angle = side * 0.9;
    raster.ellipse(x + side * 22, y - 10, 12, 30, angle, LEAF);
    raster.capsule(x, y + 4, x + side * 34, y - 24, 1.2, shade(LEAF, -0.25));
  }
}

const painters = {
  rose(raster, cx, cy, rgb) {
    raster.ellipse(cx - 18, cy + 26, 8, 20, 0.9, GREEN);
    raster.ellipse(cx + 18, cy + 26, 8, 20, -0.9, GREEN);
    raster.ellipse(cx, cy, 44, 38, 0, shade(rgb, -0.18));
    raster.ellipse(cx - 15, cy + 6, 28, 28, 0, rgb);
    raster.ellipse(cx + 15, cy + 6, 28, 28, 0, shade(rgb, -0.05));
    raster.ellipse(cx, cy - 8, 30, 24, 0, shade(rgb, 0.08));
    raster.ellipse(cx, cy - 10, 19, 15, 0, shade(rgb, -0.25));
    raster.ellipse(cx + 3, cy - 13, 12, 9, 0.3, shade(rgb, 0.06));
    raster.ellipse(cx - 2, cy - 14, 6, 4, 0.3, shade(rgb, -0.3));
  },
  baby(raster, cx, cy, rgb, random) {
    const twig = shade(GREEN, 0.1);
    const florets = [];
    for (let i = 0; i < 9; i++) {
      // Mỗi nhánh nhỏ tỏa ra một chùm bông li ti
      const angle = -Math.PI / 2 + (i / 8 - 0.5) * 2.4 + (random() - 0.5) * 0.2;
      const dist = 38 + random() * 26;
      const bx = cx + Math.cos(angle) * dist;
      const by = cy + 34 + Math.sin(angle) * dist;
      raster.capsule(cx, cy + 44, bx, by, 1.2, twig);
      for (let j = 0; j < 9; j++) {
        const x = bx + (random() - 0.5) * 30;
        const y = by + (random() - 0.5) * 24;
        raster.capsule(bx, by, x, y, 0.8, twig);
        florets.push([x, y]);
      }
    }
    for (const [x, y] of florets) {
      raster.circle(x, y, 4.6, shade(rgb, -0.2));
      raster.circle(x - 0.5, y - 0.5, 3.7, rgb);
    }
  },
  daisy(raster, cx, cy, rgb) {
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      raster.ellipse(cx + Math.cos(angle) * 27, cy + Math.sin(angle) * 27, 25, 7.5, angle, i % 2 ? rgb : shade(rgb, -0.08));
    }
    const isYellow = rgb[0] > 200 && rgb[2] < 120;
    raster.circle(cx, cy, 15, isYellow ? toRgb('#7a5a1c') : toRgb('#e6a21a'));
    raster.circle(cx - 3, cy - 3, 7, isYellow ? toRgb('#94702a') : toRgb('#f2c14b'));
  },
  tulip(raster, cx, cy, rgb) {
    raster.ellipse(cx - 15, cy + 4, 19, 40, -0.22, shade(rgb, -0.15));
    raster.ellipse(cx + 15, cy + 4, 19, 40, 0.22, shade(rgb, -0.1));
    raster.ellipse(cx, cy + 8, 21, 42, 0, rgb);
    raster.ellipse(cx - 4, cy - 6, 7, 22, 0, shade(rgb, 0.25), 0.55);
  },
  sunflower(raster, cx, cy, rgb) {
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      raster.ellipse(cx + Math.cos(angle) * 38, cy + Math.sin(angle) * 38, 26, 9, angle, i % 2 ? rgb : shade(rgb, -0.12));
    }
    raster.circle(cx, cy, 30, toRgb('#5b3a1e'));
    for (let ring = 6; ring < 28; ring += 7) {
      for (let i = 0; i < ring; i++) {
        const angle = (i / ring) * Math.PI * 2;
        raster.circle(cx + Math.cos(angle) * ring, cy + Math.sin(angle) * ring, 1.6, toRgb('#7b5530'));
      }
    }
  },
};

export const STEM_FLOWERS = Object.keys(painters);

// flower: rose | baby | daisy | tulip | sunflower; color: mã màu hex của bông
export function renderStemPng({ flower, color, width = 200, height = 560, seed = '' }) {
  const paint = painters[flower];
  if (!paint) throw new Error(`Chưa có mẫu vẽ cho loại hoa "${flower}"`);
  const random = seeded(`${flower}|${color}|${seed}`);
  const raster = new Raster(width, height);
  const headX = width / 2 + (random() - 0.5) * 10;
  const headY = flower === 'baby' ? 120 : 110;
  drawStem(raster, headX, headY + (flower === 'baby' ? 40 : 20), random);
  paint(raster, headX, headY, toRgb(color), random);
  return raster.toPng();
}
