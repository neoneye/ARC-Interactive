const test = require('node:test');
const assert = require('node:assert/strict');
const {
    generateUuidV4,
    isFullySolvedHistoryJson,
    submitHistoryToSupabase,
    reviewExportFilename,
    buildReviewExport,
    partitionRowsForDelete,
    fetchAllPages,
    chunk,
} = require('../webroot/submission.js');

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Silence console output from helpers that deliberately hit failure paths.
function silenceConsole(t) {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});
}

test('generateUuidV4 with getRandomValues', () => {
    const zeros = (bytes) => { bytes.fill(0); return bytes; };
    const uuid = generateUuidV4(zeros);
    assert.match(uuid, UUID_V4_REGEX);
    assert.equal(uuid, '00000000-0000-4000-8000-000000000000');
});

test('generateUuidV4 without crypto', () => {
    const uuid = generateUuidV4(null);
    assert.match(uuid, UUID_V4_REGEX);
});

test('generateUuidV4 default uses a valid v4 uuid', () => {
    const a = generateUuidV4();
    const b = generateUuidV4();
    assert.match(a, UUID_V4_REGEX);
    assert.match(b, UUID_V4_REGEX);
    assert.notEqual(a, b);
});

test('isFullySolvedHistoryJson', () => {
    assert.equal(isFullySolvedHistoryJson('{"summary":{"test unsolved count":0}}'), true);
    assert.equal(isFullySolvedHistoryJson('{"summary":{"test unsolved count":1}}'), false);
    assert.equal(isFullySolvedHistoryJson('not json'), false);
    assert.equal(isFullySolvedHistoryJson('{}'), false);
    assert.equal(isFullySolvedHistoryJson('null'), false);
});

test('submitHistoryToSupabase posts rpc', async (t) => {
    silenceConsole(t);
    const calls = [];
    const fetchFn = async (url, options) => { calls.push([url, options]); return { ok: true }; };
    const result = await submitHistoryToSupabase('u', '{"a":1}', { url: 'https://x.supabase.co', key: 'k', fetchFn });
    assert.equal(result, true);
    assert.equal(calls.length, 1);
    const [url, options] = calls[0];
    assert.equal(url, 'https://x.supabase.co/rest/v1/rpc/submit_history');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { p_update_uuid: 'u', p_json: '{"a":1}' });
    assert.equal(options.headers.apikey, 'k');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.equal('Authorization' in options.headers, false);
});

test('submitHistoryToSupabase adds bearer for jwt key', async (t) => {
    silenceConsole(t);
    let seen;
    const fetchFn = async (url, options) => { seen = options; return { ok: true }; };
    await submitHistoryToSupabase('u', '{}', { url: 'https://x.supabase.co', key: 'eyJabc', fetchFn });
    assert.equal(seen.headers.Authorization, 'Bearer eyJabc');
    assert.equal(seen.headers.apikey, 'eyJabc');
});

test('submitHistoryToSupabase resolves false when fetch rejects', async (t) => {
    silenceConsole(t);
    const rejecting = async () => { throw new Error('network down'); };
    assert.equal(await submitHistoryToSupabase('u', '{}', { url: 'https://x.supabase.co', key: 'k', fetchFn: rejecting }), false);
    const badResponse = async () => ({ ok: false, status: 400, text: async () => 'bad' });
    assert.equal(await submitHistoryToSupabase('u', '{}', { url: 'https://x.supabase.co', key: 'k', fetchFn: badResponse }), false);
});

test('reviewExportFilename', () => {
    assert.equal(reviewExportFilename(new Date(Date.UTC(2026, 9, 21, 19, 40, 2, 345))), 'review-2026-10-21T19-40-02.json');
});

test('buildReviewExport keeps json string identical', () => {
    const tricky = '{"s":"it\'s \\"q\\" </script> ü"}';
    const rows = [
        { id: 7, created_at: '2026-10-21T10:00:00Z', review_status: 'approved', fully_solved: true, update_uuid: 'b', json: tricky, json_size: 33 },
        { id: 3, created_at: '2026-10-20T10:00:00Z', review_status: 'pending', fully_solved: false, update_uuid: 'a', json: '{"x":1}', json_size: 7 },
    ];
    const out = buildReviewExport(rows);
    assert.deepEqual(out.map(o => o.update_uuid), ['a', 'b']);
    assert.deepEqual(Object.keys(out[0]), ['user_id', 'timestamp', 'review_status', 'fully_solved', 'update_uuid', 'json', 'json_size']);
    assert.equal(out[1].json, tricky);
    assert.equal(out[0].user_id, null);
    assert.equal(out[0].timestamp, '2026-10-20T10:00:00Z');
    assert.equal(out[1].json_size, 33);
    // input must not be reordered
    assert.deepEqual(rows.map(r => r.id), [7, 3]);
});

test('partitionRowsForDelete', () => {
    const rows = [
        { id: 1, review_status: 'rejected', downloaded_at: null },
        { id: 2, review_status: 'approved', downloaded_at: '2026-10-21T00:00:00Z' },
        { id: 3, review_status: 'pending', downloaded_at: null },
        { id: 4, review_status: 'approved', downloaded_at: null },
    ];
    assert.deepEqual(partitionRowsForDelete(rows), { safeIds: [1, 2], unsafeIds: [3, 4] });
});

test('fetchAllPages concatenates until short page', async () => {
    const sizes = [1000, 1000, 5];
    const calls = [];
    const fetchPage = async (from, to) => {
        calls.push([from, to]);
        return new Array(sizes[calls.length - 1]).fill(0);
    };
    const all = await fetchAllPages(fetchPage);
    assert.equal(all.length, 2005);
    assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('fetchAllPages exact multiple', async () => {
    const sizes = [1000, 0];
    let i = 0;
    const all = await fetchAllPages(async () => new Array(sizes[i++]).fill(0));
    assert.equal(all.length, 1000);
});

test('fetchAllPages propagates errors', async () => {
    await assert.rejects(fetchAllPages(async () => { throw new Error('boom'); }), /boom/);
});

test('chunk', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(chunk([], 3), []);
});
