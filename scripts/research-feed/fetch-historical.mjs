/**
 * VialLogic — Landmark Research Populator (one-time run)
 *
 * Searches PubMed over a multi-year window for each watched peptide,
 * filtering to high-quality publication types (RCTs, systematic reviews,
 * meta-analyses, clinical trials, and foundational mechanistic studies).
 * Claude evaluates each abstract against a landmark quality bar and keeps
 * only 2–3 per peptide.
 *
 * Writes data/research-historical.json. Run via the GitHub Actions
 * workflow_dispatch job; safe to re-run (already-known IDs are skipped).
 *
 * Required env: ANTHROPIC_API_KEY
 * Optional env:
 *   MODEL             (default: claude-sonnet-4-6)
 *   MAX_PER_PEPTIDE   (default: 3)
 *   LOOKBACK_YEARS    (default: 6)
 *   NCBI_API_KEY
 *   PUBMED_EMAIL
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { XMLParser } from 'fast-xml-parser';

const __dirname       = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT       = path.resolve(__dirname, '..', '..');
const WATCHLIST       = path.join(REPO_ROOT, 'data', 'research-watchlist.json');
const HIST_PATH       = path.join(REPO_ROOT, 'data', 'research-historical.json');

const MODEL           = process.env.MODEL           || 'claude-sonnet-4-6';
const MAX_PER_PEPTIDE = parseInt(process.env.MAX_PER_PEPTIDE || '3', 10);
const LOOKBACK_YEARS  = parseInt(process.env.LOOKBACK_YEARS  || '6', 10);
const LOOKBACK_DAYS   = LOOKBACK_YEARS * 365;
const PUBMED_TOOL     = 'viallogic-research-historical';
const PUBMED_EMAIL    = process.env.PUBMED_EMAIL || 'noreply@viallogic.com';
const NCBI_API_KEY    = process.env.NCBI_API_KEY || '';

if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set. Aborting.');
    process.exit(1);
}

const anthropic = new Anthropic();
const xml = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function withApiKey(url) {
    if (!NCBI_API_KEY) return url;
    return url + (url.includes('?') ? '&' : '?') + `api_key=${encodeURIComponent(NCBI_API_KEY)}`;
}

async function fetchJson(url) {
    const r = await fetch(withApiKey(url));
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return r.json();
}

async function fetchText(url) {
    const r = await fetch(withApiKey(url));
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return r.text();
}

function asArray(x) {
    if (x == null) return [];
    return Array.isArray(x) ? x : [x];
}

function pickText(node) {
    if (node == null) return '';
    if (typeof node === 'string') return node;
    if (typeof node === 'object' && '#text' in node) return String(node['#text']);
    if (Array.isArray(node)) return node.map(pickText).join(' ').trim();
    if (typeof node === 'object') return Object.values(node).map(pickText).join(' ').trim();
    return String(node);
}

function pubmedDateRange() {
    const fmt = d =>
        `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    const end   = new Date();
    const start = new Date(Date.now() - LOOKBACK_DAYS * 86400 * 1000);
    return `("${fmt(start)}"[PDat] : "${fmt(end)}"[PDat])`;
}

/* ------------------------------------------------------------------ */
/*  PubMed — landmark-filtered search                                  */
/* ------------------------------------------------------------------ */

// Publication types that indicate meaningful, citable research
const PUB_TYPE_FILTER = [
    '"Randomized Controlled Trial"[pt]',
    '"Controlled Clinical Trial"[pt]',
    '"Clinical Trial, Phase II"[pt]',
    '"Clinical Trial, Phase III"[pt]',
    '"Clinical Trial, Phase IV"[pt]',
    '"Meta-Analysis"[pt]',
    '"Systematic Review"[pt]',
    '"Review"[pt]',
].join(' OR ');

async function pubmedSearch(query, knownIds) {
    // Two passes: typed filter first (clinical/review), then open for mechanistic/animal
    const dateRange = pubmedDateRange();
    const results   = new Map(); // pmid -> rank score (lower = more relevant)

    // Pass 1: high-quality pub types, sort by relevance
    try {
        const term1 = `(${query}) AND ${dateRange} AND (${PUB_TYPE_FILTER})`;
        const url1  = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`
            + `?db=pubmed&retmode=json&retmax=30&sort=relevance`
            + `&tool=${PUBMED_TOOL}&email=${encodeURIComponent(PUBMED_EMAIL)}`
            + `&term=${encodeURIComponent(term1)}`;
        const d1 = await fetchJson(url1);
        (d1?.esearchresult?.idlist || []).forEach((id, i) => {
            if (!knownIds.has(`pmid-${id}`)) results.set(id, i);
        });
    } catch (e) {
        console.warn(`  PubMed pass-1 error: ${e.message}`);
    }

    await sleep(NCBI_API_KEY ? 120 : 400);

    // Pass 2: broader (catches animal / mechanistic studies), sort by relevance
    try {
        const term2 = `(${query}) AND ${dateRange}`;
        const url2  = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`
            + `?db=pubmed&retmode=json&retmax=20&sort=relevance`
            + `&tool=${PUBMED_TOOL}&email=${encodeURIComponent(PUBMED_EMAIL)}`
            + `&term=${encodeURIComponent(term2)}`;
        const d2 = await fetchJson(url2);
        (d2?.esearchresult?.idlist || []).forEach((id, i) => {
            if (!results.has(id) && !knownIds.has(`pmid-${id}`)) {
                results.set(id, 30 + i); // lower priority than pass-1
            }
        });
    } catch (e) {
        console.warn(`  PubMed pass-2 error: ${e.message}`);
    }

    await sleep(NCBI_API_KEY ? 120 : 400);

    return [...results.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([pmid]) => pmid);
}

async function pubmedFetch(pmids) {
    if (!pmids.length) return [];
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi`
        + `?db=pubmed&retmode=xml&rettype=abstract`
        + `&tool=${PUBMED_TOOL}&email=${encodeURIComponent(PUBMED_EMAIL)}`
        + `&id=${pmids.join(',')}`;
    const text = await fetchText(url);
    const doc  = xml.parse(text);
    return asArray(doc?.PubmedArticleSet?.PubmedArticle).map(parsePubmedArticle).filter(Boolean);
}

function parsePubmedArticle(a) {
    try {
        const cite     = a?.MedlineCitation || {};
        const article  = cite?.Article || {};
        const pmid     = pickText(cite?.PMID);
        const title    = pickText(article?.ArticleTitle);
        const journal  = pickText(article?.Journal?.Title) || pickText(article?.Journal?.ISOAbbreviation);
        const abstract = asArray(article?.Abstract?.AbstractText).map(pickText).join('\n\n').trim();

        const authorsArr = asArray(article?.AuthorList?.Author).map(au => {
            const last = pickText(au?.LastName);
            const init = pickText(au?.Initials);
            return last ? (init ? `${last} ${init}` : last) : pickText(au?.CollectiveName);
        }).filter(Boolean);
        const authors = authorsArr.length === 0
            ? ''
            : authorsArr.length <= 2
                ? authorsArr.join(', ')
                : `${authorsArr[0]} et al.`;

        const pubDate = article?.Journal?.JournalIssue?.PubDate || {};
        const pubmedPubDate = asArray(a?.PubmedData?.History?.PubMedPubDate).find(p => p?.['@_PubStatus'] === 'pubmed');
        let publishedDate = '';
        const yr = pickText(pubDate?.Year);
        const mo = pickText(pubDate?.Month);
        const dy = pickText(pubDate?.Day);
        const monthMap = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
        if (yr) {
            const m = /^\d+$/.test(mo) ? parseInt(mo, 10) : (monthMap[mo?.slice(0, 3)] || 1);
            const d = /^\d+$/.test(dy) ? parseInt(dy, 10) : 1;
            publishedDate = `${yr}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        } else if (pubmedPubDate) {
            publishedDate = `${pickText(pubmedPubDate?.Year)}-${String(pickText(pubmedPubDate?.Month) || '1').padStart(2, '0')}-${String(pickText(pubmedPubDate?.Day) || '1').padStart(2, '0')}`;
        }

        const idList  = asArray(a?.PubmedData?.ArticleIdList?.ArticleId);
        const doiNode = idList.find(i => i?.['@_IdType'] === 'doi');
        const doi     = doiNode ? pickText(doiNode) : '';
        const pubTypes = asArray(article?.PublicationTypeList?.PublicationType).map(pickText);

        if (!title || !abstract || !pmid) return null;

        return { source: 'pubmed', pmid, doi,
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            title, authors, journal, publishedDate, abstract, pubTypes, isPreprint: false };
    } catch (err) {
        console.warn('Failed to parse article:', err.message);
        return null;
    }
}

/* ------------------------------------------------------------------ */
/*  Claude — landmark evaluation prompt                                */
/* ------------------------------------------------------------------ */

const LANDMARK_SYSTEM = `You are a research analyst for viallogic.com curating a "Landmark Studies" reference library — a short, permanent list of the most important and meaningful published research on each peptide. This is NOT a news feed. Every entry must be something a serious researcher or curious self-experimenter would genuinely want to read.

LANDMARK CRITERIA — include ("include": true) ONLY if the study meets at least ONE:
1. A randomized controlled trial or controlled clinical trial in humans — regardless of size, as long as it directly tests the peptide.
2. A systematic review or meta-analysis synthesizing human or animal evidence on this peptide.
3. A phase 2 or phase 3 clinical trial — completed or ongoing with results published in the abstract.
4. A large observational human study (≥ 100 participants) with a clear clinical outcome.
5. A mechanistic study (animal or in vitro) that established the primary therapeutic mechanism for which this peptide is known and used — e.g., the study that first demonstrated BPC-157's tendon repair effect, or GHK-Cu's wound-healing pathway.
6. A pharmacokinetic or dose-finding study in humans that shaped how this peptide is dosed.

EXCLUDE ("include": false):
- Small animal studies (n < 10 animals) unless they are truly foundational and nothing better exists.
- Pure chemistry / synthesis papers with no biological outcome.
- Case reports (single patient).
- Editorials, commentaries, letters.
- Studies where the peptide is a minor component or incidental mention.
- Pharmacoeconomic or policy studies.
- Duplicate or near-duplicate coverage of a landmark already curated.

Return JSON with these fields when include is true:
- "displayTitle": Short, plain-English headline ≤ 12 words. Lead with the finding. Be specific.
- "summary": 1–2 sentences ≤ 60 words. What was studied, in what model, and the headline result.
- "keyFindings": 2–4 bullets ≤ 25 words each. Use numbers from the abstract when present.
- "studyType": short label — "Randomized controlled trial", "Systematic review and meta-analysis", "Phase 2 RCT", "Animal model — rat", "In vitro mechanistic study", etc.
- "context": 1–2 sentences ≤ 50 words on why this study is considered foundational or landmark.
- "limitations": 1 sentence ≤ 35 words on the main caveat.
- "peptides": array of canonical names from the provided list that this study is actually about.
- "landmarkReason": one short phrase explaining which landmark criterion it meets. Examples: "First human RCT", "Definitive meta-analysis", "Foundational mechanistic study", "Phase 3 trial — primary evidence".
- "include": true.

When include is false, all other fields may be empty.

Output ONLY valid JSON. No prose, no code fences.`;

async function evaluateLandmark(article, candidatePeptides) {
    const userMsg = `ARTICLE metadata:
- Title:     ${article.title}
- Authors:   ${article.authors || 'unknown'}
- Journal:   ${article.journal || 'unknown'}
- Published: ${article.publishedDate || 'unknown'}
- Pub types: ${(article.pubTypes || []).join(', ') || 'unknown'}

Candidate peptides (must be subset): ${candidatePeptides.join(', ')}

Abstract:
${article.abstract}

Return JSON with keys: displayTitle, summary, keyFindings, studyType, context, limitations, peptides, landmarkReason, include.`;

    const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1400,
        system: LANDMARK_SYSTEM,
        messages: [{ role: 'user', content: userMsg }],
    });

    const text    = resp.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try {
        return JSON.parse(cleaned);
    } catch (err) {
        console.warn(`Failed to parse Claude JSON for "${article.title.slice(0, 60)}…": ${err.message}`);
        return null;
    }
}

/* ------------------------------------------------------------------ */
/*  Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
    const watchlist = JSON.parse(await fs.readFile(WATCHLIST, 'utf-8'));

    let hist;
    try {
        hist = JSON.parse(await fs.readFile(HIST_PATH, 'utf-8'));
    } catch {
        hist = { lastUpdated: null, entries: [] };
    }

    const knownIds = new Set(hist.entries.map(e => e.id).filter(Boolean));
    console.log(`Lookback: ${LOOKBACK_YEARS} years · Max per peptide: ${MAX_PER_PEPTIDE}`);
    console.log(`Watching ${watchlist.peptides.length} peptides · Known historical IDs: ${knownIds.size}`);

    let totalAdded = 0;

    for (const p of watchlist.peptides) {
        const existingForPeptide = hist.entries.filter(e => (e.peptides || []).includes(p.name)).length;
        if (existingForPeptide >= MAX_PER_PEPTIDE) {
            console.log(`  ${p.name}: already has ${existingForPeptide} entries — skipping`);
            continue;
        }
        const canAdd = MAX_PER_PEPTIDE - existingForPeptide;

        console.log(`\n${p.name} (can add ${canAdd}):`);

        let pmids;
        try {
            pmids = await pubmedSearch(p.query, knownIds);
        } catch (err) {
            console.warn(`  Search failed: ${err.message}`);
            continue;
        }

        console.log(`  ${pmids.length} candidates from PubMed`);
        if (!pmids.length) continue;

        // Fetch full records in one batch (up to 50)
        const articles = await pubmedFetch(pmids.slice(0, 50));
        await sleep(NCBI_API_KEY ? 120 : 400);

        let addedForPeptide = 0;

        for (const article of articles) {
            if (addedForPeptide >= canAdd) break;
            if (!article.abstract) continue;

            let evaluation;
            try {
                evaluation = await evaluateLandmark(article, [p.name]);
            } catch (err) {
                console.warn(`  Claude failed for PMID ${article.pmid}: ${err.message}`);
                continue;
            }

            if (!evaluation?.include) {
                console.log(`  skip pmid-${article.pmid} — not landmark`);
                continue;
            }

            const cleanPeptides = (evaluation.peptides || []).filter(name => name === p.name);
            if (!cleanPeptides.length) {
                console.log(`  skip pmid-${article.pmid} — peptide mismatch`);
                continue;
            }

            const id = `pmid-${article.pmid}`;
            if (knownIds.has(id)) continue;
            knownIds.add(id);

            hist.entries.push({
                id,
                kind: 'study',
                pmid: article.pmid,
                doi: article.doi,
                nctId: '',
                url: article.url,
                title: article.title,
                displayTitle: evaluation.displayTitle || article.title,
                authors: article.authors,
                journal: article.journal,
                publishedDate: article.publishedDate,
                addedDate: new Date().toISOString().slice(0, 10),
                peptides: cleanPeptides,
                studyType: evaluation.studyType,
                summary: evaluation.summary,
                keyFindings: evaluation.keyFindings || [],
                limitations: evaluation.limitations,
                context: evaluation.context,
                landmarkReason: evaluation.landmarkReason || '',
                isPreprint: false,
                isTrial: false,
                trialMeta: null,
            });

            addedForPeptide++;
            totalAdded++;
            console.log(`  + pmid-${article.pmid} [${evaluation.landmarkReason}] — ${article.title.slice(0, 65)}…`);
        }
    }

    // Sort by peptide name, then by date descending within each peptide
    hist.entries.sort((a, b) => {
        const pa = (a.peptides?.[0] || '').localeCompare(b.peptides?.[0] || '');
        if (pa !== 0) return pa;
        return (b.publishedDate || '').localeCompare(a.publishedDate || '');
    });

    hist.lastUpdated = new Date().toISOString();
    await fs.writeFile(HIST_PATH, JSON.stringify(hist, null, 2) + '\n');
    console.log(`\nDone. Added ${totalAdded} landmark entries. Total: ${hist.entries.length}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
