import repository from './repository.js';
import { vietnamContext } from './calendar.js';
import { discoverRails, rankProducts } from './ranking.js';
import { fallbackIntent } from './intent.js';
import { interpretWithProviders } from './providers.js';
import { THEMES } from './themes.js';
import { describeProduct, normalize } from './semantic-data.js';

export class DiscoveryService {
  constructor({ repo = repository, interpret = interpretWithProviders, now = () => new Date() } = {}) {
    this.repo = repo;
    this.interpret = interpret;
    this.now = now;
  }

  async state(userId) {
    if (!userId) return { preference: null, interactions: [], occasions: [] };
    const [preference, occasions] = await Promise.all([
      this.repo.preference(userId), this.repo.occasions(userId),
    ]);
    const interactions = preference.consent ? await this.repo.interactions(userId) : [];
    return { preference: preference.consent ? preference : null,
      occasions: preference.consent ? occasions : [], interactions };
  }

  async rails(userId) {
    const [products, state] = await Promise.all([this.repo.products(), this.state(userId)]);
    const context = vietnamContext(this.now(), state.occasions);
    return {
      context, rails: discoverRails(products, context, state.preference, state.interactions),
      catalogEmpty: products.length === 0, personalized: Boolean(state.preference?.consent),
    };
  }

  async world(input, userId) {
    const [products, state, ai] = await Promise.all([
      this.repo.products(), this.state(userId), Promise.resolve().then(() => this.interpret(input)).catch(() => ({ status: 'unavailable', intent: null })),
    ]);
    const rules = fallbackIntent(input);
    const normalizedInput = normalize(input);
    const romanticMisread = ai.intent?.intent === 'love' && rules.intent === 'comfort' &&
      /\bnguoi yeu thich\b/.test(normalizedInput);
    const apologyMisread = ai.intent?.intent === 'comfort' && rules.intent === 'apology' &&
      /\b(xin loi|doi hon|lam hoa)\b/.test(normalizedInput);
    const intent = romanticMisread || apologyMisread ? {
      ...rules, preferredColors: ai.intent.preferredColors, style: ai.intent.style,
      confidence: Math.min(ai.intent.confidence, rules.confidence),
    } : (ai.intent || rules);
    const theme = THEMES[intent.themeKey] || THEMES.garden;
    const avoid = (intent.avoid || []).map(normalize).filter((term) => term && normalize(input).includes(term));
    const primaryTag = {
      apology: 'apology', gratitude: 'gratitude', celebration: 'celebration',
      new_beginning: 'new_beginning', comfort: 'serene', love: 'love',
    }[intent.intent] || null;
    const candidates = products.filter((product) =>
      !avoid.some((term) => term && normalize(product.name + ' ' + product.description).includes(term)) &&
      (!rules.preferredColors.length || rules.preferredColors.some((color) => describeProduct(product).colors.includes(color))));
    const context = vietnamContext(this.now(), state.occasions);
    const explicitColors = rules.preferredColors;
    const favoriteColors = state.preference?.favorite_colors || [];
    const preferenceColors = explicitColors.length ? [] : favoriteColors;
    const rankingPreference = explicitColors.length ? null : state.preference;
    const pool = preferenceColors.length && intent.semanticTags.length
      ? candidates.filter((product) => {
        const meta = describeProduct(product);
        return intent.semanticTags.some((tag) => meta.tags.includes(tag)) ||
          preferenceColors.some((color) => meta.colors.includes(color));
      }) : candidates;
    let items = rankProducts(pool, {
      tags: intent.semanticTags, colors: intent.preferredColors, season: context.season,
      budget: intent.budget, query: input, preference: rankingPreference,
      interactions: state.interactions, limit: 12, primaryTag,
      strict: preferenceColors.length ? 'none' : intent.semanticTags.length || intent.preferredColors.length ? 'semantic' : 'none',
    });
    let relaxed = false;
    if (!items.length && Boolean(intent.budget) && candidates.length > 0) {
      const alternatives = rankProducts(pool, {
      tags: intent.semanticTags, colors: intent.preferredColors, season: context.season,
      query: input, preference: rankingPreference, interactions: state.interactions, limit: 12, primaryTag,
      strict: preferenceColors.length ? 'none' : intent.semanticTags.length || intent.preferredColors.length ? 'semantic' : 'none',
      });
      if (alternatives.length) { items = alternatives; relaxed = true; }
    }
    return {
      mode: ai.intent ? 'ai' : 'fallback', aiStatus: ai.status, themeKey: intent.themeKey,
      theme, title: intent.title || theme.title, intro: intent.intro || theme.intro,
      interpretation: intent.interpretation, intent: {
        intent: intent.intent, occasion: intent.occasion, recipient: intent.recipient,
        preferredColors: intent.preferredColors, style: intent.style, budget: intent.budget,
        confidence: intent.confidence, semanticTags: intent.semanticTags,
        emotionalTone: intent.emotionalTone, avoid,
      },
      items, catalogEmpty: products.length === 0, budgetRelaxed: relaxed,
    };
  }

  async refine(input, refinement, userId) {
    const options = {
      gentle: { themeKey: 'gentle', tags: ['gentle'], label: 'Dịu dàng hơn' },
      bright: { themeKey: 'sunrise', tags: ['celebration', 'encouragement'], label: 'Rực rỡ hơn' },
      elegant: { themeKey: 'evening', tags: ['elegant', 'respect'], label: 'Trang trọng hơn' },
      pastel: { themeKey: 'lavender', colors: ['pink', 'purple'], label: 'Gam màu pastel' },
    };
    const option = options[refinement];
    if (!option) throw new Error('Invalid refinement');
    const [products, state] = await Promise.all([this.repo.products(), this.state(userId)]);
    const context = vietnamContext(this.now(), state.occasions);
    const theme = THEMES[option.themeKey];
    const base = fallbackIntent(input);
    const tags = option.tags || (option.colors ? [] : base.semanticTags);
    const colors = option.colors || base.preferredColors;
    const candidates = products.filter((product) =>
      !colors.length || colors.some((color) => describeProduct(product).colors.includes(color)));
    const items = rankProducts(candidates, {
      tags, colors, season: context.season, query: input,
      budget: base.budget,
      preference: state.preference, interactions: state.interactions,
      limit: 8, strict: 'semantic', primaryTag: option.tags?.[0] || null,
    });
    return {
      mode: 'refined', aiStatus: 'not_called', themeKey: option.themeKey,
      theme, title: theme.title, intro: theme.intro,
      interpretation: 'Một góc nhìn ' + option.label.toLocaleLowerCase('vi-VN') + ' cho khoảnh khắc bạn vừa kể.',
      intent: { ...base, semanticTags: tags, preferredColors: colors },
      items, catalogEmpty: products.length === 0, budgetRelaxed: false,
    };
  }
}

export default new DiscoveryService();
