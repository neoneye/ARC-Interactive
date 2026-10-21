// Supabase project configuration. Classic script: defines globals.
const SUPABASE_URL = 'https://nimirzkqrnhkuiewjmxz.supabase.co';
// Public anon key (safe to ship in client code; RLS protects the data).
const SUPABASE_ANON_KEY = '<paste from Project Settings → API>';
const SUPABASE_JS_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

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
