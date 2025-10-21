# Narrative & Voice Guidelines

Summa Vision turns civic data into shared understanding. Our copy should be precise, transparent, and multilingual. Use this guide when crafting product UI, editorial articles, and social narratives.

## Positioning Statement
- **RU:** «Summa Vision помогает сообществам и аналитикам превращать открытые данные в действия. Мы объединяем визуализацию, контекст и доверие.»
- **EN:** "Summa Vision helps communities and analysts transform open data into action. We unite visualization, context, and trust."

## Voice Principles
1. **Informed, not aloof.** Cite sources and explain uncertainty without jargon.
2. **Collaborative.** Encourage participation, highlight partners, and invite critique.
3. **Grounded in evidence.** Quantify claims, avoid speculation, and include margin-of-error notes when available.
4. **Bilingual friendly.** When space permits, present key metrics in both Russian and English.

## Tone by Channel
| Channel | Tone | Example |
| --- | --- | --- |
| Product UI | Clear, encouraging | «Обновите фильтры, чтобы сравнить кварталы. Данные обновлены 12.04.2024.» |
| Data Story | Reflective, investigative | "New transit data shows a 14% increase in weekend ridership — here’s where the surge is concentrated." |
| Social (OG) | Bold, invitational | «Факт дня: 62% семей получили поддержку в 2023. Узнайте, как распределялись средства.» |
| Support | Direct, empathetic | "We’re reviewing your report and will respond within 24 hours. Thank you for flagging the discrepancy." |

## Source Attribution Templates
Use these in captions, footnotes, or OG cards. Replace bracketed sections.

- **RU:** «Источник: [Организация] | Лицензия: [CC-BY 4.0]»
- **EN:** "Source: [Agency] | License: [CC-BY 4.0]"
- **Combined:** «Источник: [Организация] / Source: [Agency] | Лицензия / License: [License]»

## Disclaimers
- Clarify when data is provisional: «Данные предварительные и могут быть обновлены.» / "Data is provisional and subject to revision."
- Note methodologies when aggregating: "Methodology: weighted by population, excludes municipalities under 5k residents."
- For forecasts: "Projection generated with ARIMA (p=2, d=1, q=1); 80% confidence interval shown."

## Inclusive Language
- Avoid gendered nouns when a neutral alternative exists (e.g., «участники», "participants").
- Prefer people-first phrasing: «люди с ограниченной мобильностью» vs. «инвалиды».
- Provide transliterations when introducing local terms unfamiliar to international readers.

## Microcopy Checklist
- Always include timestamps (`Updated: 2024-04-12 09:00 GMT+3`).
- Button labels should start with verbs ("Download report", «Сравнить сценарии»).
- Tooltips must mention the data window (e.g., "90-day rolling average").
- Error states should suggest a next action and link to support.

## Editorial Structure
1. Headline (H1 / Display) — insight-focused.
2. Dek (H2) — 1 sentence explaining why the data matters.
3. Body — alternate between paragraphs and data visuals every `space.8`.
4. Callout — Use caption style with `color.bg.subtle` background for highlights.
5. Source & License — follow template above.

## Review Process
- Draft in EN or RU, then cross-translate for parity.
- Run OG templates through `npm run test:axe` to ensure accessibility.
- Archive narratives in `/docs/story-outlines.md` with final headlines and publication dates.

For voice or localization questions, reach the Narrative lead at `narrative@summa.vision`.
