import { describeProduct, normalize } from './semantic-data.js';

function profileFrom(interactions) {
  const votes = new Map();
  const themes = new Map();
  const rails = new Map();
  const states = new Map();
  for (const event of [...interactions].reverse()) {
    if (event.product_id) {
      const state = states.get(event.product_id) || { saved: false, relevance: 0, views: 0 };
      if (event.action === 'save') state.saved = true;
      if (event.action === 'unsave') state.saved = false;
      if (event.action === 'relevant') state.relevance = 2;
      if (event.action === 'irrelevant') state.relevance = -3;
      if (event.action === 'view') state.views = Math.min(state.views + 1, 3);
      states.set(event.product_id, state);
    }
    if (event.action === 'theme' && event.theme_key) themes.set(event.theme_key, (themes.get(event.theme_key) || 0) + 1);
    if (event.action === 'open_rail' && event.theme_key) rails.set(event.theme_key, (rails.get(event.theme_key) || 0) + 1);
  }
  for (const [id, state] of states) votes.set(id, (state.saved ? 2 : 0) + state.relevance + state.views * 0.3);
  return { votes, themes, rails };
}

export function rankProducts(products, {
  tags = [], colors = [], season = null, budget = null, query = '', preference = null,
  interactions = [], variant = 'proposed', seen = new Set(), limit = 8, contextReason = null, strict = 'none', primaryTag = null,
} = {}) {
  const profile = profileFrom(interactions);
  const normalizedQuery = normalize(query).trim();
  const stopwords = new Set(['hoa', 'mot', 'cho', 'nguoi', 'toi', 'muon', 'tang', 'ban', 'cua', 'nhung', 'trong', 'voi', 'duoc', 'that', 'nhat', 'danh', 'nhieu', 'yeu', 'thich', 'nhung', 'dieu']);
  const terms = normalizedQuery.split(/\s+/).filter((term) => term.length > 2 && !stopwords.has(term)).slice(0, 12);
  const entries = [];
  for (const product of products) {
    if (budget !== null && product.price > budget) continue;
    const meta = describeProduct(product);
    const matchedTags = tags.filter((tag) => meta.tags.includes(tag));
    const matchedColors = colors.filter((color) => meta.colors.includes(color));
    const seasonMatch = season && meta.seasons.includes(season);
    if (strict === 'semantic' && (tags.length ? !matchedTags.length : !matchedColors.length)) continue;
    if (strict === 'season' && !seasonMatch) continue;
    const keywordHits = terms.filter((term) => meta.searchText.includes(term)).length;
    let score = product.is_pinned ? 1.2 : 0.2;
    if (variant === 'baseline_rule' || variant === 'proposed') {
      score += matchedTags.length * 3 + (seasonMatch ? 1.3 : 0);
      if (variant === 'proposed' && primaryTag && meta.tags.includes(primaryTag)) score += 3;
    }
    if (variant === 'baseline_content' || variant === 'proposed') {
      score += matchedColors.length * 2 + keywordHits * 0.7;
      if (preference?.consent) {
        score += (preference.favorite_colors || []).filter((color) => meta.colors.includes(color)).length * 16;
        score += profile.votes.get(product.id) || 0;
      }
    }
    if (variant === 'proposed') score -= seen.has(product.id) ? 5 : 0;
    const tagReasons = {
      apology: 'Một sắc hoa dịu dàng cho lời xin lỗi.', gratitude: 'Sắc hoa trang nhã cho lời tri ân.',
      celebration: 'Một lựa chọn tươi sáng cho lời chúc mừng.',
      encouragement: 'Gửi thêm niềm vui và lời động viên.',
      serene: 'Gam hoa nhẹ nhàng cho một khoảng lặng.',
      love: 'Một sắc hoa dành cho người thương.',
      new_beginning: 'Gửi lời chúc cho hành trình mới.',
      friendship: 'Một món quà nhỏ dành cho bạn bè.',
    };
    let reason = null;
    if (matchedTags.length) reason = contextReason || tagReasons[matchedTags[0]] || null;
    else if (matchedColors.length) reason = 'Mang gam màu bạn vừa chọn.';
    else if (preference?.consent && (preference.favorite_colors || []).some((color) => meta.colors.includes(color))) reason = 'Mang gam màu bạn yêu thích.';
    else if (preference?.consent && profile.votes.get(product.id) > 0) reason = 'Bạn từng quan tâm đến lựa chọn này.';
    entries.push({ ...product, reason, meaning: meta.meaning, score, categoryKey: product.category || '', tags: meta.tags });
  }
  entries.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const selected = [];
  const remaining = entries.slice();
  while (selected.length < limit && remaining.length) {
    let index = 0;
    if (variant === 'proposed') {
      let best = -Infinity;
      remaining.forEach((item, i) => {
        const repeats = selected.filter((picked) => picked.categoryKey === item.categoryKey).length;
        const adjusted = item.score - repeats * 1.5;
        if (adjusted > best) { best = adjusted; index = i; }
      });
    }
    selected.push(remaining.splice(index, 1)[0]);
  }
  return selected.map(({ score, categoryKey, tags: _tags, ...item }) => item);
}

export function discoverRails(products, context, preference, interactions) {
  if (!products.length) return [];
  const choices = [];
  const holiday = context.holidays[0];
  if (holiday) choices.push({
    key: 'holiday', title: holiday.key === 'teachers' ? 'Mùa hoa tri ân' : 'Hoa cho ' + holiday.label,
    subtitle: holiday.key === 'teachers' ? 'Một lời tri ân dành cho người đã gieo mầm tri thức.' : 'Một dịp để gửi lời bạn muốn nói.',
    priority: 12 - holiday.daysUntil / 2, tags: holiday.tags,
    contextReason: holiday.daysUntil === 0 ? 'Phù hợp với dịp ' + holiday.label + ' hôm nay.' : 'Phù hợp với dịp ' + holiday.label + ' sắp tới.',
  });
  const personal = context.occasions[0];
  if (personal) choices.push({
    key: 'occasion', title: personal.kind === 'birthday' ? 'Một ngày thật đặc biệt' : 'Hoa cho ' + personal.title, subtitle: 'Bạn đã lưu khoảnh khắc này. Một lời chúc nhỏ cũng đủ ý nghĩa.',
    priority: 11 - personal.daysUntil / 3, tags: personal.kind === 'birthday' ? ['celebration'] : ['love', 'gratitude'],
    contextReason: 'Phù hợp với dịp ' + personal.title + ' bạn đã lưu.',
  });
  if (preference?.consent && (preference.favorite_colors || []).length) choices.push({
    key: 'for_you', title: 'Gam màu bạn yêu thích',
    priority: 8, colors: preference.favorite_colors,
  });
  if (preference?.consent && (preference.favorite_themes || []).length) {
    const themeTags = {
      gentle: ['gentle'], gratitude: ['gratitude'], sunrise: ['celebration'],
      garden: ['serene'], lavender: ['gentle'], evening: ['elegant'], beginning: ['new_beginning'],
    };
    choices.push({
      key: 'themes', title: 'Chủ đề bạn yêu thích',
      priority: 7, tags: [...new Set(preference.favorite_themes.flatMap((key) => themeTags[key] || []))],
    });
  }
  choices.push({
    key: 'season', title: 'Sắc hoa lúc này', subtitle: 'Gợi ý theo thời điểm; nguồn hoa thực tế tùy vùng trồng.',
    priority: 6, season: context.season,
  });
  const profile = preference?.consent ? profileFrom(interactions) : { themes: new Map(), rails: new Map() };
  choices.forEach((choice) => { choice.priority += Math.min(profile.rails.get(choice.key) || 0, 5) * 0.2; });
  const themeTags = {
    gentle: ['gentle'], gratitude: ['gratitude'], sunrise: ['celebration'],
    garden: ['serene'], lavender: ['gentle'], evening: ['elegant'], beginning: ['new_beginning'],
  };
  const recentTheme = [...profile.themes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (recentTheme) choices.push({
    key: 'recent_theme', title: 'Thế giới hoa bạn từng khám phá',
    subtitle: 'Theo chủ đề bạn đã chọn trong Bloomora Worlds.',
    priority: 7.5, tags: themeTags[recentTheme] || [],
  });
  choices.sort((a, b) => b.priority - a.priority);
  const seen = new Set();
  const selected = [];
  for (const { priority: _priority, tags, colors, season, contextReason, ...rail } of choices) {
    if (selected.length >= 3) break;
    const strict = season ? 'season' : tags?.length || colors?.length ? 'semantic' : 'none';
    const candidates = products.filter((product) => !seen.has(product.id));
    const items = rankProducts(candidates, { tags, colors, season, contextReason, preference, interactions, limit: 5,
      strict });
    if (!items.length) continue;
    items.forEach((item) => seen.add(item.id));
    selected.push({ ...rail, items });
  }
  return selected;
}
