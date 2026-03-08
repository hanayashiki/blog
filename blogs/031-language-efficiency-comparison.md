---
title: Which language is most efficient?
slug: language-efficiency-comparison
date: 2026-03-08
abstract: comparing 17 languages across 4 metrics with LLM-powered translations
---

I've always wondered: if you say the same thing in different languages, which one takes up the least space? The least bytes? The fewest LLM tokens? So I built a tool to find out.

## The setup

I picked 44 phrases across 7 categories — daily conversation, proverbs, news, politics, science, philosophy, economics, and law. Then I used Claude Haiku (via OpenRouter) to translate each phrase into 17 languages, and measured 4 metrics:

1. **Romanized phonetic cost** — all languages spelled in Latin letters, diacritics decomposed (ñ = 2, ā = 2), spaces count as 1
2. **Native script area cost** — how much page space each takes. CJK characters count as 3 (2 wide × 1.5 tall), everything else 1
3. **UTF-8 byte count** — electronic storage cost
4. **LLM token count** — GPT-4o tokenizer, measuring AI processing cost

## The fairness problem

This sounds simple, but getting a fair comparison is tricky.

**Spaces aren't free.** I initially counted spaces as 0, which silently gave a huge advantage to languages that use spaces. Mandarin pinyin with tone numbers (`wo3ai4ni3`) has no spaces — tone digits act as separators. But English `I love you` was getting its two spaces for free. When I changed spaces to cost 1, Mandarin pinyin jumped from rank 11 to rank 3. The previous ranking was simply wrong.

**Diacritics encode information.** Vietnamese `Tôi yêu bạn` and Spanish `niño` use diacritics that pack extra phonetic info into one character. Meanwhile, Chinese pinyin spells out the same kind of info as explicit digits (`wo3`). If you count `ñ` as 1 and `3` as 1, you're letting diacritics carry information for free. My solution: decompose via Unicode NFD, so `ñ` → `n` + combining tilde = cost 2. This way a diacritic costs the same as a tone number.

**Character height matters.** CJK characters are square — they take vertical space too. At CJK = 2 (width only), Chinese was 23% more efficient than English. At CJK = 4 (2×2 area), they were nearly tied. I settled on CJK = 3 as a compromise, accounting for the fact that Latin text also needs line height for ascenders and descenders.

## The results

### Romanized phonetic cost

How many "phonetic units" does each language need to express the same meaning, when everything is written in Latin letters?

| Rank | Language | Avg Cost |
|------|----------|----------|
| 1 | Hebrew | 43.7 |
| 2 | Mandarin (Pinyin) | 45.3 |
| 3 | English | 45.4 |
| 4 | Mandarin (Pinyin+Tones) | 45.4 |
| 5 | Arabic | 46.5 |
| 6 | Turkish | 47.5 |
| 7 | Cantonese (Jyutping+Tones) | 48.8 |
| 8 | Portuguese | 49.7 |
| 9 | Indonesian | 50.3 |
| 10 | Russian | 50.5 |
| 11 | Spanish | 51.9 |
| 12 | German | 51.9 |
| 13 | Japanese | 52.7 |
| 14 | French | 54.9 |
| 15 | Korean | 55.2 |
| 16 | Hindi | 57.4 |
| 17 | Thai | 57.5 |
| 18 | Vietnamese | 59.4 |

Hebrew wins! Semitic root systems are incredibly compact — 3-consonant roots generate entire word families, and the romanization is short. Mandarin and English are nearly tied at #2-3.

Vietnamese is dead last. It's linguistically efficient (borrowed Chinese vocabulary, simple grammar, no conjugation), but the Latin+diacritics writing system is bloated. Every syllable that Chinese writes as one character becomes 3-7 letters plus tone marks. If Vietnamese still used its old character system (chữ Nôm), it would probably rank next to Chinese.

### Native script area cost

How much space does each language take on a printed page?

| Rank | Language | Avg Cost |
|------|----------|----------|
| 1 | Hebrew (עברית) | 32.6 |
| 2 | Arabic (العربية) | 33.1 |
| 3 | Mandarin (汉字) | 35.8 |
| 4 | Thai (ไทย) | 38.7 |
| 5 | Cantonese (粵語) | 39.0 |
| 6 | Turkish | 44.2 |
| 7 | English | 45.4 |
| 8 | Vietnamese | 45.8 |
| 9 | Hindi (हिन्दी) | 46.3 |
| 10 | Russian (Русский) | 46.8 |
| 11 | Portuguese | 48.0 |
| 12 | Indonesian | 50.3 |
| 13 | Spanish | 50.8 |
| 14 | German | 51.4 |
| 15 | French | 52.7 |
| 16 | Japanese (日本語) | 53.2 |
| 17 | Korean (한글) | 53.5 |

The Semitic languages (Hebrew, Arabic) dominate — their consonantal scripts drop most vowels, achieving extreme compression. Chinese is #3, still well ahead of English despite each character costing 3× the area of a Latin letter.

This ranking is actually useful for UI localization. If you design a button for English text, French needs ~15% more space, while Chinese needs ~21% less.

### UTF-8 byte count

How much storage does each language need electronically?

| Rank | Language | Avg Bytes |
|------|----------|-----------|
| 1 | Mandarin (汉字) | 35.8 |
| 2 | Cantonese (粵語) | 39.0 |
| 3 | English | 45.4 |
| 4 | Turkish | 48.9 |
| 5 | Portuguese | 49.7 |
| 6 | Indonesian | 50.3 |
| 7 | German | 52.0 |
| 8 | Spanish | 52.0 |
| 9 | Japanese (日本語) | 53.2 |
| 10 | Korean (한글) | 53.5 |
| 11 | French | 54.9 |
| 12 | Hebrew (עברית) | 60.0 |
| 13 | Arabic (العربية) | 61.4 |
| 14 | Vietnamese | 61.8 |
| 15 | Russian (Русский) | 88.0 |
| 16 | Thai (ไทย) | 115.5 |
| 17 | Hindi (हिन्दी) | 122.9 |

Chinese characters are 3 bytes each in UTF-8, but the information density more than compensates. Hebrew and Arabic, despite being visually compact, cost 2 bytes per character, which pushes them to mid-pack.

Hindi and Thai are storage nightmares — 3 bytes per character, lots of combining marks, and verbose to begin with.

### LLM token count

The fun one. How many tokens does GPT-4o need?

| Rank | Language | Avg Tokens |
|------|----------|------------|
| 1 | English | 7.6 |
| 2 | Mandarin (汉字) | 8.9 |
| 3 | Spanish | 9.8 |
| 4 | Portuguese | 9.8 |
| 5 | Arabic (العربية) | 10.1 |
| 6 | German | 10.9 |
| 7 | French | 11.1 |
| 8 | Russian (Русский) | 11.7 |
| 9 | Indonesian | 12.1 |
| 10 | Hebrew (עברית) | 12.5 |
| 11 | Turkish | 12.5 |
| 12 | Korean (한글) | 12.8 |
| 13 | Vietnamese | 13.1 |
| 14 | Cantonese (粵語) | 14.0 |
| 15 | Hindi (हिन्दी) | 14.2 |
| 16 | Japanese (日本語) | 14.3 |
| 17 | Thai (ไทย) | 16.0 |

English wins decisively. Not because English is linguistically superior, but because tokenizers are trained primarily on English text. English gets ~1 token per word, while Thai gets ~1 token per character.

Hebrew drops from #1 (visual) to #10 — its compact script doesn't help when the tokenizer hasn't seen enough Hebrew to build efficient multi-character tokens.

The practical implication: if you're building AI applications and care about token costs, using English for system prompts and chain-of-thought will save you ~50% compared to Thai or Hindi.

## Mandarin vs Cantonese

Since they are the only two commonly written Chinese languages, I was curious how they compare:

| Metric    | Mandarin | Cantonese | Gap  |
| --------- | -------- | --------- | ---- |
| Romanized | 45.4     | 48.8      | +7%  |
| Area      | 35.8     | 39.0      | +9%  |
| UTF-8     | 35.8     | 39.0      | +9%  |
| Tokens    | 8.9      | 14.0      | +57% |

Cantonese is consistently ~10% less efficient. It preserved more syllable-final consonants (-k, -t, -p) that Mandarin lost, has 6 tones vs 4, and uses more grammatical particles (嘅、咗、啲、嗰). The token gap is dramatic — Cantonese has far less training data, so the tokenizer handles it poorly.

## What I learned

**Chinese characters are the most efficient writing system overall.** They win UTF-8, nearly win area, and are competitive in phonetic cost. The logographic system packs enormous information per character.

**But the efficiency lives in the script, not the phonology.** Romanize Chinese and it becomes mid-pack. The characters are doing the heavy lifting.

**All fair comparisons require careful accounting.** Spaces, diacritics, character height — every "obvious" simplification introduces bias. The ranking literally inverted when I changed spaces from 0 to 1.

**LLM efficiency is dominated by tokenizer bias, not linguistics.** The "best language for AI" is whatever the tokenizer was trained on most. Right now, that's English.
