/**
 * VialLogic — Weekly Research Feed Updater
 *
 * Pulls new peptide research from PubMed, medRxiv/bioRxiv preprints, and
 * ClinicalTrials.gov, summarizes each via the Claude API into structured
 * JSON, and writes data/research-feed.json. Designed to be run from a
 * GitHub Actions cron, which then opens a PR for human review.
 *
 * Required env: ANTHROPIC_API_KEY
 * Optional env:
 *   MODEL              (default: claude-sonnet-4-5-20250929)
 *   MAX_NEW_PER_RUN    (default: 12)  — soft cap on entries added per run
 *   MAX_FEED_SIZE      (default: 200) — cap total entries kept in feed
 *   LOOKBACK_DAYS      (overrides watchlist.lookbackDays)
 *   INCLUDE_PREPRINTS  (default: true) — pull medRxiv + bioRxiv preprints
 *   INCLUDE_TRIALS     (default: true) — pull ClinicalTrials.gov registry
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { XMLParser } from 'fast-xml-parser';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT    = path.resolve(__dirname, '..', '..');
const WATCHLIST    = path.join(REPO_ROOT, 'data', 'research-watchlist.json');
const FEED_PATH    = path.join(REPO_ROOT, 'data', 'research-feed.json');

const MODEL              = process.env.MODEL || 'claude-sonnet-4-5-20250929';
const MAX_NEW_PER_RUN    = parseInt(process.env.MAX_NEW_PER_RUN  || '12', 10);
const MAX_FEED_SIZE      = parseInt(process.env.MAX_FEED_SIZE    || '200', 10);
const INCLUDE_PREPRINTS  = (process.env.INCLUDE_PREPRINTS || 'true').toLowerCase() === 'true';
const INCLUDE_TRIALS     = (process.env.INCLUDE_TRIALS    || 'true').toLowerCase() === 'true';
const PUBMED_TOOL        = 'viallogic-research-feed';
const PUBMED_EMAIL       = process.env.PUBMED_EMAIL || 'noreply@viallogic.com';
const NCBI_API_KEY       = process.env.NCBI_API_KEY || '';

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

function pubmedDateRange(lookbackDays) {
    const fmt = d =>
        `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    const end   = new Date();
    const start = new Date(Date.now() - lookbackDays * 86400 * 1000);
    return `("${fmt(start)}"[PDat] : "${fmt(end)}"[PDat])`;
}

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
    if (typeof node === 'object') {
        // Concatenate child text recursively (handles inline italic/bold tags)
        return Object.values(node).map(pickText).join(' ').trim();
    }
    return String(node);
}

/* ------------------------------------------------------------------ */
/*  PubMed                                                             */
/* ------------------------------------------------------------------ */

async function pubmedSearch(query, lookbackDays, retmax = 25) {
    const term = `(${query}) AND ${pubmedDateRange(lookbackDays)}`;
    const url  = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`
        + `?db=pubmed&retmode=json&retmax=${retmax}&sort=pub_date`
        + `&tool=${PUBMED_TOOL}&email=${encodeURIComponent(PUBMED_EMAIL)}`
        + `&term=${encodeURIComponent(term)}`;
    const data = await fetchJson(url);
    return data?.esearchresult?.idlist || [];
}

async function pubmedFetch(pmids) {
    if (!pmids.length) return [];
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi`
        + `?db=pubmed&retmode=xml&rettype=abstract`
        + `&tool=${PUBMED_TOOL}&email=${encodeURIComponent(PUBMED_EMAIL)}`
        + `&id=${pmids.join(',')}`;
    const text = await fetchText(url);
    const doc  = xml.parse(text);
    const articles = asArray(doc?.PubmedArticleSet?.PubmedArticle);
    return articles.map(parsePubmedArticle).filter(Boolean);
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

        // Date
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

        // DOI
        const idList = asArray(a?.PubmedData?.ArticleIdList?.ArticleId);
        const doiNode = idList.find(i => i?.['@_IdType'] === 'doi');
        const doi = doiNode ? pickText(doiNode) : '';

        // Pub types
        const pubTypes = asArray(article?.PublicationTypeList?.PublicationType).map(pickText);

        if (!title || !abstract || !pmid) return null;

        return {
            source: 'pubmed',
            pmid,
            doi,
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            title,
            authors,
            journal,
            publishedDate,
            abstract,
            pubTypes,
            isPreprint: false,
        };
    } catch (err) {
        console.warn('Failed to parse article:', err.message);
        return null;
    }
}

/* ------------------------------------------------------------------ */
/*  medRxiv / bioRxiv preprints                                       */
/* ------------------------------------------------------------------ */

async function preprintSearch(server, peptideName, queryAliases, lookbackDays) {
    // server: 'medrxiv' | 'biorxiv'
    if (!INCLUDE_PREPRINTS) return [];
    try {
        const end   = new Date().toISOString().slice(0, 10);
        const start = new Date(Date.now() - lookbackDays * 86400 * 1000).toISOString().slice(0, 10);
        const url   = `https://api.biorxiv.org/details/${server}/${start}/${end}/0`;
        const data  = await fetchJson(url);
        const terms = [peptideName, ...(queryAliases || [])].map(t => t.toLowerCase());
        const hits  = (data?.collection || []).filter(p => {
            const blob = `${p.title || ''} ${p.abstract || ''}`.toLowerCase();
            return terms.some(t => blob.includes(t));
        });
        return hits.slice(0, 5).map(p => ({
            source: server,
            kind: 'preprint',
            pmid: '',
            doi: p.doi,
            url: `https://www.${server === 'medrxiv' ? 'medrxiv' : 'biorxiv'}.org/content/${p.doi}v${p.version || 1}`,
            title: p.title,
            authors: (p.authors || '').split(';').slice(0, 1).join('') + ((p.authors || '').includes(';') ? ' et al.' : ''),
            journal: `${server === 'medrxiv' ? 'medRxiv' : 'bioRxiv'} (preprint)`,
            publishedDate: p.date,
            abstract: p.abstract || '',
            pubTypes: ['Preprint'],
            isPreprint: true,
            isTrial: false,
        }));
    } catch (err) {
        console.warn(`${server} lookup failed for ${peptideName}: ${err.message}`);
        return [];
    }
}

/* ------------------------------------------------------------------ */
/*  ClinicalTrials.gov                                                 */
/* ------------------------------------------------------------------ */

async function clinicalTrialsSearch(peptideName, queryAliases, lookbackDays) {
    if (!INCLUDE_TRIALS) return [];
    try {
        const end   = new Date().toISOString().slice(0, 10);
        const start = new Date(Date.now() - lookbackDays * 86400 * 1000).toISOString().slice(0, 10);
        // OR together the peptide name + aliases for the intervention search
        const terms = [peptideName, ...(queryAliases || [])].map(t => `"${t}"`).join(' OR ');
        const url = `https://clinicaltrials.gov/api/v2/studies`
            + `?query.intr=${encodeURIComponent(terms)}`
            + `&filter.advanced=${encodeURIComponent(`AREA[LastUpdatePostDate]RANGE[${start},${end}]`)}`
            + `&pageSize=10`
            + `&sort=LastUpdatePostDate:desc`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const studies = data?.studies || [];

        return studies.map(s => {
            const proto      = s?.protocolSection || {};
            const ident      = proto?.identificationModule || {};
            const status     = proto?.statusModule || {};
            const design     = proto?.designModule || {};
            const sponsor    = proto?.sponsorCollaboratorsModule?.leadSponsor || {};
            const conds      = proto?.conditionsModule?.conditions || [];
            const desc       = proto?.descriptionModule || {};
            const interv     = proto?.armsInterventionsModule?.interventions || [];
            const outcomes   = proto?.outcomesModule?.primaryOutcomes || [];
            const eligi      = proto?.eligibilityModule || {};
            const hasResults = !!s?.hasResults;

            const phase   = (design?.phases || []).join('/').replace(/PHASE/gi, 'Phase ').replace(/_/g, ' ').trim();
            const interventions = interv
                .filter(i => (i?.type || '').toUpperCase() === 'DRUG' || (i?.type || '').toUpperCase() === 'BIOLOGICAL')
                .map(i => `${i.name || ''}${i.description ? ' — ' + i.description : ''}`)
                .filter(Boolean)
                .slice(0, 3)
                .join('; ');
            const primaryOutcomes = outcomes.slice(0, 2).map(o => o?.measure).filter(Boolean).join('; ');
            const enrollment = proto?.designModule?.enrollmentInfo?.count;

            // Build a "synthetic abstract" Claude can summarize.
            const abstract = [
                desc?.briefSummary && `BRIEF SUMMARY: ${desc.briefSummary}`,
                desc?.detailedDescription && `DETAILED DESCRIPTION: ${desc.detailedDescription}`,
                conds.length && `CONDITIONS: ${conds.join('; ')}`,
                interventions && `INTERVENTIONS: ${interventions}`,
                primaryOutcomes && `PRIMARY OUTCOMES: ${primaryOutcomes}`,
                eligi?.eligibilityCriteria && `ELIGIBILITY: ${String(eligi.eligibilityCriteria).slice(0, 800)}`,
            ].filter(Boolean).join('\n\n');

            if (!ident?.nctId || !abstract) return null;

            const dateStr = status?.lastUpdatePostDateStruct?.date
                || status?.startDateStruct?.date
                || status?.primaryCompletionDateStruct?.date
                || end;

            return {
                source: 'clinicaltrials',
                kind: 'trial',
                nctId: ident.nctId,
                pmid: '',
                doi: '',
                url: `https://clinicaltrials.gov/study/${ident.nctId}`,
                title: ident?.briefTitle || ident?.officialTitle || '(untitled trial)',
                authors: sponsor?.name || '',
                journal: `ClinicalTrials.gov · ${sponsor?.name || 'unknown sponsor'}`,
                publishedDate: dateStr,
                abstract,
                pubTypes: ['Trial registration'],
                isPreprint: false,
                isTrial: true,
                trialMeta: {
                    nctId: ident.nctId,
                    phase: phase || '',
                    status: (status?.overallStatus || '').replace(/_/g, ' '),
                    sponsor: sponsor?.name || '',
                    studyType: design?.studyType || '',
                    enrollment: enrollment != null ? String(enrollment) : '',
                    conditions: conds,
                    primaryOutcomes,
                    hasResults,
                },
            };
        }).filter(Boolean);
    } catch (err) {
        console.warn(`ClinicalTrials.gov lookup failed for ${peptideName}: ${err.message}`);
        return [];
    }
}

/* ------------------------------------------------------------------ */
/*  Claude summarization                                               */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `You are a research analyst summarizing peptide-related biomedical literature for an audience of peptide researchers and curious self-experimenters on viallogic.com.

You will receive an abstract (and metadata) for ONE study. Produce a structured JSON summary. Be precise, conservative, and honest about limitations. Never invent details that aren't in the abstract. Never speculate about clinical outcomes that the study didn't measure.

WHAT TO INCLUDE (set "include": true):
- Primary peptide research: clinical trials, observational human studies, animal studies, in vitro / cell studies, mechanistic studies, pharmacokinetics, structure-function, novel analog development.
- Reviews of any kind: systematic reviews, meta-analyses, narrative reviews, mechanism reviews, scoping reviews — as long as the peptide is a central topic.
- Case reports describing a clinically relevant finding (a previously unreported adverse event, a novel use, an unusual response).
- Regulatory or safety updates that bear on how the peptide is researched or used.

WHAT TO EXCLUDE (set "include": false):
- Pharmacoeconomics, cost-effectiveness, budget-impact, market-access, payer-coverage analyses.
- Sociological, cultural, or psychological commentary about peptides (e.g. body image, public perception, media coverage).
- Prescription-persistence, adherence-pattern, refill-rate, or claims-database utilization studies UNLESS they primarily report adverse events or clinical outcomes.
- Pure synthetic-chemistry papers with no biological model.
- Studies where the peptide is only a downstream biomarker, an incidental ingredient in a multi-compound formulation, a co-factor, or background biology.
- Review articles that mention the peptide only in passing rather than reviewing it as a primary topic.

When "include" is true, return all of these fields:
- "displayTitle": A short, plain-English headline (≤ 12 words) the way a science journalist would write it. NOT the official paper title. Make it scannable, specific, and informative. Lead with the finding when possible. Examples: "BPC-157 accelerates Achilles tendon repair in rats", "GLP-1 agonists may cut ischemic stroke risk by up to 39%", "GHK-Cu suppresses LPS-induced inflammation in keratinocytes", "Case report: rare central hypercapnia with semaglutide". Avoid jargon; use specific numbers when the abstract gives them.
- "summary": 1–2 plain-English sentences, ≤ 60 words. State what was studied, in what model, and the headline result.
- "keyFindings": 2–4 short bullets, each ≤ 25 words, capturing the most important results from the abstract. Use numbers from the abstract when present.
- "studyType": one short label, ≤ 6 words. Examples: "In vitro", "Animal model — rat", "Animal model — mouse", "Randomized controlled trial", "Observational cohort", "Case report", "Systematic review", "Meta-analysis", "Mechanistic study", "Narrative review".
- "context": 1–2 sentences (≤ 50 words) on how this fits with prior knowledge of the peptide. Cautious language ("appears to", "consistent with", "extends prior findings"). If the study contradicts prior work, say so.
- "limitations": 1 sentence (≤ 35 words) on the biggest caveat — small sample, animal-only, no control, preprint, conflict of interest disclosed in abstract, etc.
- "peptides": array of canonical names from the provided peptide list that the study is actually about. Must be a subset of the candidates given.
- "include": true.

When "include" is false, all other fields may be empty strings or empty arrays.

Output ONLY valid JSON matching the schema. No prose, no code fences.`;

const TRIAL_SYSTEM_PROMPT = `You are summarizing a CLINICAL TRIAL REGISTRATION (from ClinicalTrials.gov) for an audience of peptide researchers and curious self-experimenters on viallogic.com. This is NOT a published paper — it is a registry entry describing a planned, ongoing, or completed trial.

WHAT TO INCLUDE (set "include": true):
- Late-phase trials (Phase 2, 3, 4) of peptides
- First-in-human trials of novel peptides or analogs
- Trials whose status changed meaningfully (e.g. recruiting → completed, or results posted)
- Trials testing a peptide for a NEW indication, mechanism, or population
- Trials of pipeline compounds where this is the only public data
- Trials where results have been posted (\`hasResults: true\`)

WHAT TO EXCLUDE (set "include": false):
- Tiny single-site pilot studies (n < 20) without a unique angle
- Generic-formulation or bioequivalence studies
- Unblinded marketing post-marketing studies with no novel design
- Withdrawn or terminated trials with no useful information
- Trials where the peptide is only an active comparator and is not the focus
- Behavioral / app / questionnaire studies that happen to enroll patients on the peptide

Required fields when "include" is true:
- "displayTitle": short, journalist-style headline (≤ 14 words). Lead with what's new. Format examples:
  - "Phase 3 retatrutide trial in obesity completes enrollment"
  - "First-in-human Phase 1 of new GLP-1/glucagon dual agonist begins"
  - "Long-term semaglutide bone density trial posts primary results"
  - "Phase 2 BPC-157 gut healing trial enters recruitment"
- "summary": 1–2 sentences (≤ 60 words) describing the trial: what's being tested, in whom, with what design.
- "keyFindings": 2–4 short bullets, each ≤ 25 words. For ACTIVE trials: list design highlights (phase, n, primary endpoint, intervention dose, comparator, status). For trials with results posted: summarize the actual results.
- "studyType": One short label. Examples: "Trial — Phase 3 RCT", "Trial registration — Phase 1", "Trial — Phase 2, completed (results posted)".
- "context": 1–2 sentences (≤ 50 words) on how this trial fits with prior research on the peptide. Be cautious: a trial registration is not evidence of efficacy.
- "limitations": 1 sentence (≤ 35 words). For active trials, note that results are not yet published. For posted-result trials, note the same caveats as for any RCT.
- "peptides": array of canonical names from the candidate list that this trial primarily studies.
- "include": true.

Output ONLY valid JSON. No prose, no code fences.`;

async function summarize(article, candidatePeptides) {
    const isTrial = article.kind === 'trial';
    const sys     = isTrial ? TRIAL_SYSTEM_PROMPT : SYSTEM_PROMPT;

    const trialMetaBlock = isTrial && article.trialMeta ? `
TRIAL METADATA:
- NCT ID:      ${article.trialMeta.nctId}
- Phase:       ${article.trialMeta.phase || 'unspecified'}
- Status:      ${article.trialMeta.status || 'unknown'}
- Type:        ${article.trialMeta.studyType || 'unknown'}
- Enrollment:  ${article.trialMeta.enrollment || 'unspecified'}
- Sponsor:     ${article.trialMeta.sponsor || 'unknown'}
- Has results: ${article.trialMeta.hasResults ? 'YES — results posted' : 'no'}
- Conditions:  ${(article.trialMeta.conditions || []).join('; ') || 'unspecified'}` : '';

    const userMsg = `${isTrial ? 'TRIAL' : 'ARTICLE'} metadata:
- Title:     ${article.title}
- Source:    ${article.isTrial ? 'ClinicalTrials.gov registry' : (article.isPreprint ? 'PREPRINT (not peer-reviewed)' : 'peer-reviewed publication')}
- Authors:   ${article.authors || 'unknown'}
- Journal:   ${article.journal || 'unknown'}
- Published: ${article.publishedDate || 'unknown'}
- Pub types: ${(article.pubTypes || []).join(', ') || 'unknown'}${trialMetaBlock}

Candidate peptides (must be subset): ${candidatePeptides.join(', ')}

${isTrial ? 'Registry content:' : 'Abstract:'}
${article.abstract}

Return JSON with keys: displayTitle, summary, keyFindings, studyType, context, limitations, peptides, include.`;

    const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1400,
        system: sys,
        messages: [{ role: 'user', content: userMsg }],
    });

    const text = resp.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();

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
    const lookbackDays = parseInt(process.env.LOOKBACK_DAYS || watchlist.lookbackDays || 14, 10);

    let feed;
    try {
        feed = JSON.parse(await fs.readFile(FEED_PATH, 'utf-8'));
    } catch {
        feed = { lastUpdated: null, entries: [] };
    }

    const knownIds = new Set(feed.entries.map(e => e.id).filter(Boolean));
    const allCandidates = new Map();   // id -> { article, peptides:Set<string> }

    console.log(`Lookback window: ${lookbackDays} days`);
    console.log(`Watching ${watchlist.peptides.length} peptides`);

    // 1. Search every source per peptide; merge by ID.
    for (const p of watchlist.peptides) {
        try {
            const pmids = await pubmedSearch(p.query, lookbackDays);
            await sleep(NCBI_API_KEY ? 120 : 350); // respect NCBI rate limits

            for (const pmid of pmids) {
                const id = `pmid-${pmid}`;
                if (knownIds.has(id)) continue;
                if (!allCandidates.has(id)) {
                    allCandidates.set(id, { _pmid: pmid, peptides: new Set() });
                }
                allCandidates.get(id).peptides.add(p.name);
            }

            const aliases = p.aliases || [];

            const med = await preprintSearch('medrxiv', p.name, aliases, lookbackDays);
            for (const pp of med) {
                const id = `doi-${pp.doi}`;
                if (knownIds.has(id)) continue;
                if (!allCandidates.has(id)) {
                    allCandidates.set(id, { _article: pp, peptides: new Set() });
                }
                allCandidates.get(id).peptides.add(p.name);
            }

            const bio = await preprintSearch('biorxiv', p.name, aliases, lookbackDays);
            for (const pp of bio) {
                const id = `doi-${pp.doi}`;
                if (knownIds.has(id)) continue;
                if (!allCandidates.has(id)) {
                    allCandidates.set(id, { _article: pp, peptides: new Set() });
                }
                allCandidates.get(id).peptides.add(p.name);
            }

            const trials = await clinicalTrialsSearch(p.name, aliases, lookbackDays);
            for (const t of trials) {
                const id = `nct-${t.nctId}`;
                if (knownIds.has(id)) continue;
                if (!allCandidates.has(id)) {
                    allCandidates.set(id, { _article: t, peptides: new Set() });
                }
                allCandidates.get(id).peptides.add(p.name);
            }

            console.log(`  ${p.name}: ${pmids.length} PubMed, ${med.length} medRxiv, ${bio.length} bioRxiv, ${trials.length} trials`);
        } catch (err) {
            console.warn(`Search failed for ${p.name}: ${err.message}`);
        }
    }

    console.log(`Unique candidate articles: ${allCandidates.size}`);
    if (!allCandidates.size) {
        feed.lastUpdated = new Date().toISOString();
        await fs.writeFile(FEED_PATH, JSON.stringify(feed, null, 2) + '\n');
        console.log('No new candidates. Feed timestamp bumped.');
        return;
    }

    // 2. Fetch full PubMed records in batches of 50.
    const pmidsToFetch = [...allCandidates.values()].filter(v => v._pmid).map(v => v._pmid);
    for (let i = 0; i < pmidsToFetch.length; i += 50) {
        const batch    = pmidsToFetch.slice(i, i + 50);
        const articles = await pubmedFetch(batch);
        articles.forEach(art => {
            const slot = allCandidates.get(`pmid-${art.pmid}`);
            if (slot) slot._article = art;
        });
        await sleep(NCBI_API_KEY ? 120 : 350);
    }

    // 3. Summarize each candidate via Claude (sequential to keep this simple & cheap).
    let added = 0;
    for (const [id, slot] of allCandidates) {
        if (added >= MAX_NEW_PER_RUN) break;
        const article = slot._article;
        if (!article || !article.abstract) continue;

        const candidatePeptides = [...slot.peptides];
        let summary;
        try {
            summary = await summarize(article, candidatePeptides);
        } catch (err) {
            console.warn(`Claude failed for ${id}: ${err.message}`);
            continue;
        }
        if (!summary || !summary.include) {
            console.log(`  skip ${id} — model marked not relevant`);
            continue;
        }

        const cleanPeptides = (summary.peptides || []).filter(p => candidatePeptides.includes(p));
        if (!cleanPeptides.length) {
            console.log(`  skip ${id} — no candidate peptides matched`);
            continue;
        }

        feed.entries.push({
            id,
            kind: article.kind || 'study',
            pmid: article.pmid,
            doi: article.doi,
            nctId: article.trialMeta?.nctId || '',
            url: article.url,
            title: article.title,
            displayTitle: summary.displayTitle || article.title,
            authors: article.authors,
            journal: article.journal,
            publishedDate: article.publishedDate,
            addedDate: new Date().toISOString().slice(0, 10),
            peptides: cleanPeptides,
            studyType: summary.studyType,
            summary: summary.summary,
            keyFindings: summary.keyFindings || [],
            limitations: summary.limitations,
            context: summary.context,
            isPreprint: !!article.isPreprint,
            isTrial: !!article.isTrial,
            trialMeta: article.trialMeta || null,
        });
        added++;
        console.log(`  + added ${id} — ${article.title.slice(0, 70)}…`);
    }

    // 4. Sort and cap, then write.
    feed.entries.sort((a, b) => (b.publishedDate || '').localeCompare(a.publishedDate || ''));
    if (feed.entries.length > MAX_FEED_SIZE) {
        feed.entries = feed.entries.slice(0, MAX_FEED_SIZE);
    }
    feed.lastUpdated = new Date().toISOString();

    await fs.writeFile(FEED_PATH, JSON.stringify(feed, null, 2) + '\n');
    console.log(`\nDone. Added ${added} entries. Total feed size: ${feed.entries.length}`);

    // 5. Emit a step summary for the GitHub Actions PR body.
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
        const lines = [
            `## Research feed update — ${added} new entr${added === 1 ? 'y' : 'ies'}`,
            '',
            `Lookback: ${lookbackDays} days · Total feed size: ${feed.entries.length}`,
            '',
        ];
        feed.entries.slice(0, added).forEach(e => {
            lines.push(`- **${e.title}** — ${e.peptides.join(', ')} · [source](${e.url})`);
        });
        await fs.appendFile(summaryPath, lines.join('\n') + '\n');
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
