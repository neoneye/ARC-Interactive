// Helpers for submitting puzzle history to Supabase and for the review tooling.
// Classic script: functions are globals in the browser; Node can require() it for tests.

function generateUuidV4(getRandomValues) {
    if (getRandomValues === undefined) {
        // Not passed explicitly: prefer the native implementation.
        const c = globalThis.crypto;
        if (c && typeof c.randomUUID === 'function') {
            return c.randomUUID();
        }
        getRandomValues = (c && typeof c.getRandomValues === 'function') ? c.getRandomValues.bind(c) : null;
    }
    const bytes = new Uint8Array(16);
    if (typeof getRandomValues === 'function') {
        getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isFullySolvedHistoryJson(jsonString) {
    try {
        const parsed = JSON.parse(jsonString);
        return parsed?.summary?.['test unsolved count'] === 0;
    } catch (error) {
        return false;
    }
}

async function submitHistoryToSupabase(updateUuid, jsonString, options = {}) {
    const {
        url = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : undefined),
        key = (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : undefined),
        fetchFn = (typeof fetch !== 'undefined' ? fetch : undefined),
    } = options;
    try {
        const headers = {
            'apikey': key,
            'Content-Type': 'application/json',
        };
        if (typeof key === 'string' && key.startsWith('eyJ')) {
            // Legacy JWT anon key also goes in the Authorization header.
            headers['Authorization'] = `Bearer ${key}`;
        }
        const response = await fetchFn(`${url}/rest/v1/rpc/submit_history`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ p_update_uuid: updateUuid, p_json: jsonString }),
        });
        if (response.ok) {
            console.log('submitHistoryToSupabase: submitted', updateUuid);
            return true;
        }
        let detail = '';
        try {
            detail = await response.text();
        } catch (error) {
            // ignore
        }
        console.error('submitHistoryToSupabase: failed', response.status, detail);
        return false;
    } catch (error) {
        console.error('submitHistoryToSupabase: error', error);
        return false;
    }
}

function reviewExportFilename(date) {
    const iso = date.toISOString(); // YYYY-MM-DDTHH:MM:SS.sssZ (UTC)
    return `review-${iso.slice(0, 19).replace(/:/g, '-')}.json`;
}

function buildReviewExport(rows) {
    return [...rows]
        .sort((a, b) => a.id - b.id)
        .map(row => ({
            user_id: null,
            timestamp: row.created_at,
            review_status: row.review_status,
            fully_solved: row.fully_solved,
            update_uuid: row.update_uuid,
            json: row.json,
            json_size: row.json_size,
        }));
}

function partitionRowsForDelete(rows) {
    const safeIds = [];
    const unsafeIds = [];
    for (const row of rows) {
        if (row.review_status === 'rejected' || row.downloaded_at != null) {
            safeIds.push(row.id);
        } else {
            unsafeIds.push(row.id);
        }
    }
    return { safeIds, unsafeIds };
}

async function fetchAllPages(fetchPage, pageSize = 1000) {
    const all = [];
    for (let from = 0; ; from += pageSize) {
        const page = await fetchPage(from, from + pageSize - 1);
        all.push(...page);
        if (page.length < pageSize) {
            return all;
        }
    }
}

function chunk(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

if (typeof module !== 'undefined') {
    module.exports = {
        generateUuidV4,
        isFullySolvedHistoryJson,
        submitHistoryToSupabase,
        reviewExportFilename,
        buildReviewExport,
        partitionRowsForDelete,
        fetchAllPages,
        chunk,
    };
}
