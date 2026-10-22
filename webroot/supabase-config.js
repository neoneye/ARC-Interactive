// Supabase project configuration. Classic script: defines globals.
const SUPABASE_URL = 'https://nimirzkqrnhkuiewjmxz.supabase.co';
// Public anon key (safe to ship in client code; RLS protects the data).
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pbWlyemtxcm5oa3VpZXdqbXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NTY1ODcsImV4cCI6MjA3NTIzMjU4N30.UCbFcRv5XfW699f4WGoq393sgDswGGaT5XaV-NIOzHs';
const SUPABASE_JS_INTEGRITY = 'sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o';
const SUPABASE_JS_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

if (SUPABASE_ANON_KEY.includes('<paste')) {
    console.error('supabase-config.js: SUPABASE_ANON_KEY is still the placeholder. Submissions and the review page are disabled until the key is set.');
}

let supabaseScriptPromise = null;

function loadSupabaseScript() {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        return Promise.resolve();
    }
    if (supabaseScriptPromise) {
        return supabaseScriptPromise;
    }
    supabaseScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SUPABASE_JS_URL;
        script.integrity = SUPABASE_JS_INTEGRITY;
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve();
        script.onerror = () => {
            script.remove();
            supabaseScriptPromise = null; // allow a later retry
            console.error('loadSupabaseClient: failed to load', SUPABASE_JS_URL);
            reject(new Error('Failed to load supabase-js'));
        };
        document.head.appendChild(script);
    });
    return supabaseScriptPromise;
}

async function loadSupabaseClient() {
    await loadSupabaseScript();
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
