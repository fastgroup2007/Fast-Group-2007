const DEFAULT_DATA_PATH = 'data/site-state.json';
const DEFAULT_BRANCH = 'main';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
  'access-control-allow-headers': 'content-type,x-admin-key',
  'access-control-max-age': '86400'
};

function jsonResponse(body, status = 200){
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

function emptyState(){
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    products: [],
    crmData: {
      customers: [],
      technicians: [],
      jobs: [],
      purchases: [],
      expenses: [],
      inventory: [],
      stockMoves: [],
      projects: [],
      maintenanceGallery: [],
      publicWorks: [],
      publicWorkDeletes: []
    },
    reviews: [],
    auditLog: []
  };
}

function requiredEnv(env){
  const missing = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'].filter(key => !env[key]);
  if(missing.length) throw new Error(`Missing env: ${missing.join(', ')}`);
}

function githubConfig(env){
  requiredEnv(env);
  return {
    token: env.GITHUB_TOKEN,
    owner: env.GITHUB_OWNER,
    repo: env.GITHUB_REPO,
    branch: env.GITHUB_BRANCH || DEFAULT_BRANCH,
    path: env.DATA_PATH || DEFAULT_DATA_PATH,
    adminKey: env.ADMIN_SYNC_KEY || ''
  };
}

function encodeBase64(text){
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for(const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(base64){
  const binary = atob(String(base64 || '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function githubRequest(env, path, options = {}){
  const cfg = githubConfig(env);
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'authorization': `Bearer ${cfg.token}`,
      'accept': 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'fast-group-sync-worker',
      ...(options.headers || {})
    }
  });
  return res;
}

async function readGithubState(env){
  const cfg = githubConfig(env);
  const res = await githubRequest(env, `${cfg.path}?ref=${encodeURIComponent(cfg.branch)}`);
  if(res.status === 404) return { state: emptyState(), sha: null };
  if(!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  const file = await res.json();
  const state = JSON.parse(decodeBase64(file.content));
  return { state: { ...emptyState(), ...state }, sha: file.sha };
}

async function writeGithubState(env, state, sha = null){
  const cfg = githubConfig(env);
  const body = {
    message: `Update site data ${new Date().toISOString()}`,
    content: encodeBase64(JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)),
    branch: cfg.branch
  };
  if(sha) body.sha = sha;
  const res = await githubRequest(env, cfg.path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if(!res.ok) throw new Error(`GitHub write failed: ${res.status}`);
  return res.json();
}

function requireAdmin(request, env){
  const cfg = githubConfig(env);
  if(!cfg.adminKey) return;
  const key = request.headers.get('x-admin-key') || '';
  if(key !== cfg.adminKey) throw new Error('unauthorized');
}

function cleanReview(input = {}){
  const stars = Math.min(5, Math.max(1, Math.round(Number(input.stars || 5))));
  return {
    name: String(input.name || 'عميل').trim().slice(0, 80) || 'عميل',
    stars: Number.isFinite(stars) ? stars : 5,
    comment: String(input.comment || '').trim().slice(0, 1200),
    date: String(input.date || new Date().toISOString().slice(0, 10)).slice(0, 10)
  };
}

export default {
  async fetch(request, env){
    if(request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);

    try {
      if(request.method === 'GET'){
        const { state, sha } = await readGithubState(env);
        return jsonResponse({ state, exists: Boolean(sha) });
      }

      if(request.method === 'POST' && url.pathname.replace(/\/+$/, '').endsWith('/reviews')){
        const body = await request.json().catch(() => ({}));
        const review = cleanReview(body.review || body);
        if(!review.comment) return jsonResponse({ error: 'comment-required' }, 400);
        const current = await readGithubState(env);
        const reviews = Array.isArray(current.state.reviews) ? current.state.reviews : [];
        current.state.reviews = [...reviews, review];
        await writeGithubState(env, current.state, current.sha);
        return jsonResponse({ state: current.state });
      }

      if(request.method === 'PUT'){
        requireAdmin(request, env);
        const body = await request.json().catch(() => ({}));
        const incoming = body.state || body;
        const current = await readGithubState(env);
        const state = {
          ...emptyState(),
          ...incoming,
          reviews: Array.isArray(incoming.reviews) ? incoming.reviews : current.state.reviews
        };
        await writeGithubState(env, state, current.sha);
        return jsonResponse({ state });
      }

      return jsonResponse({ error: 'not-found' }, 404);
    } catch (error) {
      const unauthorized = String(error?.message || '').includes('unauthorized');
      return jsonResponse({ error: unauthorized ? 'unauthorized' : 'sync-failed' }, unauthorized ? 401 : 500);
    }
  }
};
