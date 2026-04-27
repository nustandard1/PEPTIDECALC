/**
 * VialLogic — Weekly Research Digest Emailer
 *
 * Reads the current research-feed.json, asks Claude to pick the 3–5 most
 * socially interesting entries from the latest batch, drafts a caption for
 * each, then sends a "This Week in Research" email via Resend.
 *
 * Required env: ANTHROPIC_API_KEY, RESEND_API_KEY, DIGEST_TO
 * Optional env:
 *   MODEL          (default: claude-sonnet-4-6)
 *   DIGEST_FROM    (default: noreply@viallogic.com)
 *   LOOKBACK_DAYS  (default: 10 — entries added within this window are "new")
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.resolve(__dirname, '..', '..');
const FEED_PATH  = path.join(REPO_ROOT, 'data', 'research-feed.json');

const MODEL       = process.env.MODEL       || 'claude-sonnet-4-6';
const DIGEST_TO   = process.env.DIGEST_TO;
const DIGEST_FROM = process.env.DIGEST_FROM || 'noreply@viallogic.com';
const RESEND_KEY  = process.env.RESEND_API_KEY;
const LOOKBACK    = parseInt(process.env.LOOKBACK_DAYS || '10', 10);

if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }
if (!RESEND_KEY)  { console.error('RESEND_API_KEY not set'); process.exit(1); }
if (!DIGEST_TO)   { console.error('DIGEST_TO not set'); process.exit(1); }

const anthropic = new Anthropic();

/* ------------------------------------------------------------------ */
/*  Load feed and filter to recent entries                              */
/* ------------------------------------------------------------------ */

const feed = JSON.parse(await fs.readFile(FEED_PATH, 'utf-8'));
const cutoff = new Date(Date.now() - LOOKBACK * 86400 * 1000).toISOString().slice(0, 10);

const recent = (feed.entries || []).filter(e => e.addedDate >= cutoff);

if (recent.length === 0) {
    console.log('No new entries this week — skipping digest email.');
    process.exit(0);
}

console.log(`${recent.length} new entries since ${cutoff}. Asking Claude to pick the best…`);

/* ------------------------------------------------------------------ */
/*  Ask Claude to select and caption the top picks                     */
/* ------------------------------------------------------------------ */

const entrySummaries = recent.map((e, i) => `[${i}] ${e.displayTitle || e.title}
Peptide(s): ${(e.peptides || []).join(', ')}
Study type: ${e.studyType || (e.isTrial ? 'Clinical trial' : e.isPreprint ? 'Preprint' : 'Study')}
Summary: ${e.summary || ''}
Key findings: ${(e.keyFindings || []).join(' | ')}
`).join('\n---\n');

const prompt = `You are the editor of VialLogic, a research-focused peptide platform.
Every week you send a "This Week in Peptide Research" email digest to the founder with the most socially interesting studies from the latest batch — picks that would make compelling, shareable content on X/Instagram.

Here are this week's new entries (${recent.length} total):

${entrySummaries}

Pick the 3–5 entries most likely to generate engagement on social media. Favour:
- Concrete numbers and effect sizes
- Topics with broad appeal (fat loss, longevity, recovery, cognition, hormones)
- Surprising or counterintuitive findings
- Anything with real human trial data

For each pick return a JSON object with:
- index: the [N] index from the list above
- hook: a single punchy sentence that could open a social post (no hashtags, no emojis, max 15 words)
- caption: a 2–3 sentence social caption expanding on the finding with the key stat. Write for an educated but non-clinical audience. End with a one-sentence "what this means" takeaway.
- why: one sentence explaining why you picked this one (for the editor's eyes only)

Return a JSON array of these objects, nothing else.`;

const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1800,
    messages: [{ role: 'user', content: prompt }],
});

const raw = resp.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

let picks;
try {
    picks = JSON.parse(cleaned);
} catch (err) {
    console.error('Failed to parse Claude response:', err.message);
    console.error(raw);
    process.exit(1);
}

console.log(`Claude picked ${picks.length} entries.`);

/* ------------------------------------------------------------------ */
/*  Build HTML email                                                    */
/* ------------------------------------------------------------------ */

const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

function entryHtml(pick) {
    const e = recent[pick.index];
    const url = e.url || (e.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${e.pmid}/` : (e.nctId ? `https://clinicaltrials.gov/study/${e.nctId}` : (e.doi ? `https://doi.org/${e.doi}` : '#')));
    const peptides = (e.peptides || []).join(', ');
    const sourceLabel = e.isTrial ? 'View registry entry' : 'Read source';

    return `
    <div style="margin-bottom:32px;padding-bottom:32px;border-bottom:1px solid #1b2035;">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;color:#00d4ff;text-transform:uppercase;margin-bottom:8px;">${peptides}</div>
        <div style="font-size:20px;font-weight:700;color:#e2e8f0;line-height:1.3;margin-bottom:12px;">${pick.hook}</div>
        <div style="font-size:15px;color:#94a3b8;line-height:1.6;margin-bottom:14px;">${pick.caption}</div>
        <div style="font-size:12px;color:#4e5a72;margin-bottom:12px;font-style:italic;">Editor's note: ${pick.why}</div>
        <a href="${url}" style="display:inline-block;padding:8px 16px;background:#0c0f1a;border:1px solid #252d48;border-radius:100px;color:#00d4ff;font-size:13px;font-weight:500;text-decoration:none;">${sourceLabel} →</a>
    </div>`;
}

const picksHtml = picks.map(entryHtml).join('');

const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07090f;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <div style="margin-bottom:32px;">
        <span style="font-size:22px;font-weight:700;color:#e2e8f0;">Vial<span style="background:linear-gradient(135deg,#00d4ff,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Logic</span></span>
    </div>

    <h1 style="font-size:26px;font-weight:700;color:#e2e8f0;margin:0 0 6px;">This Week in Peptide Research</h1>
    <div style="font-size:14px;color:#4e5a72;margin-bottom:36px;">${dateStr} · ${recent.length} new ${recent.length === 1 ? 'entry' : 'entries'} · ${picks.length} editor's picks</div>

    ${picksHtml}

    <div style="margin-top:16px;padding:20px;background:#0c0f1a;border:1px solid #1b2035;border-radius:12px;">
        <div style="font-size:13px;color:#4e5a72;line-height:1.6;">
            These picks are auto-selected by Claude from the weekly PubMed / medRxiv / ClinicalTrials.gov pull.
            The full feed (${(feed.entries || []).length} entries) lives on
            <a href="https://viallogic.com" style="color:#00d4ff;text-decoration:none;">viallogic.com → Latest Research</a>.
            The PR with this week's additions is open for your review before it goes live.
        </div>
    </div>

    <div style="margin-top:28px;font-size:12px;color:#4e5a72;text-align:center;">
        VialLogic · For informational and educational purposes only · Not medical advice
    </div>

  </div>
</body>
</html>`;

/* ------------------------------------------------------------------ */
/*  Send via Resend                                                     */
/* ------------------------------------------------------------------ */

const subject = `This Week in Peptide Research — ${dateStr}`;

console.log(`Sending digest to ${DIGEST_TO}…`);

const sendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        from: DIGEST_FROM,
        to: [DIGEST_TO],
        subject,
        html,
    }),
});

if (!sendResp.ok) {
    const err = await sendResp.text();
    console.error('Resend error:', err);
    process.exit(1);
}

const result = await sendResp.json();
console.log('Digest sent. Resend ID:', result.id);
