// Returns public Supabase credentials (stored as Vercel env vars)
const { cors } = require('./_lib');

module.exports = function(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  });
};
