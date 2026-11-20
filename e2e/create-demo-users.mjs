// Cria os 3 usuários demo num Supabase LOCAL pela Auth admin API (só para testes).
// Uso: API_URL=... SERVICE_ROLE_KEY=... DEMO_PASSWORD=... node e2e/create-demo-users.mjs
// A senha vem do ambiente e nunca é gravada no repositório.
const { API_URL, SERVICE_ROLE_KEY, DEMO_PASSWORD } = process.env;
if (!API_URL || !SERVICE_ROLE_KEY || !DEMO_PASSWORD) {
  throw new Error('Defina API_URL, SERVICE_ROLE_KEY e DEMO_PASSWORD.');
}

const emails = ['admin@demo.local', 'lider@demo.local', 'integrante@demo.local'];
for (const email of emails) {
  const res = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password: DEMO_PASSWORD, email_confirm: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${email}: ${res.status} ${JSON.stringify(body)}`);
  console.log(`✅ ${email} criado (${body.id})`);
}
