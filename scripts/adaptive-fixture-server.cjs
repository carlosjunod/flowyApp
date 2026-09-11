// Local-only visual acceptance data. No upstream requests or production writes.
const http = require('node:http');
const token = `fixture.${Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url')}.fixture`;
const record = { id: 'adaptivefixture', email: 'preview@example.test', name: 'Preview', collectionName: 'users', collectionId: '_pb_users_auth_' };
const titles = ['Designing layouts that adapt', 'A reading list for the weekend', 'Notes from a quieter morning', 'The art of paying attention', 'Places to explore next', 'Building a personal library', 'A better way to save ideas', 'Small details, lasting impressions'];
const items = Array.from({ length: 48 }, (_, i) => ({ id: `fixture${String(i).padStart(8, '0')}`, user: record.id, type: 'url', title: `${titles[i % titles.length]} ${i + 1}`, summary: 'Saved ideas for the responsive layout preview.', content: 'A local fixture for testing navigation and resizing.', status: 'ready', tags: [], category: i % 2 ? 'design' : 'technology', created: new Date(Date.now() - i * 3600000).toISOString(), updated: new Date().toISOString() }));
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4199');
  const json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  if (url.pathname.endsWith('/auth-with-password') || url.pathname.endsWith('/auth-refresh')) return json({ token, record });
  if (url.pathname === '/api/items') {
    const filtered = items.filter(item => (!url.searchParams.get('q') || item.title.toLowerCase().includes(url.searchParams.get('q').toLowerCase())) && (!url.searchParams.get('category') || item.category === url.searchParams.get('category')));
    const page = Number(url.searchParams.get('page') || 1), perPage = Number(url.searchParams.get('perPage') || 20);
    return json({ data: { items: filtered.slice((page - 1) * perPage, page * perPage), page, perPage, totalItems: filtered.length, totalPages: Math.ceil(filtered.length / perPage), categories: ['design', 'technology'] }, error: null });
  }
  if (url.pathname.startsWith('/api/collections/items/records/')) return json(items.find(item => url.pathname.endsWith(item.id)) || items[0]);
  if (url.pathname === '/api/chat') {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('x-items', JSON.stringify([{ id: items[0].id, type: 'url', title: items[0].title }]));
    const words = `Your library brings together ideas about design and everyday creativity. Try rotating the window while this answer arrives. Your conversation stays here. [[${items[0].id}]]`.split(' ');
    const timer = setInterval(() => { if (words.length) res.write(words.shift() + ' '); else { clearInterval(timer); res.end(); } }, 200);
    res.on('close', () => clearInterval(timer)); return;
  }
  if (url.pathname === '/api/digest/settings') return json({ data: { revision: 1, capabilities: { enabled: false } }, error: null });
  if (url.pathname === '/api/realtime') { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write('event: PB_CONNECT\ndata: {"clientId":"fixture"}\n\n'); return; }
  res.statusCode = 404; json({ data: null, error: { code: 'FIXTURE_UNAVAILABLE', message: 'This action is outside the local layout preview.' } });
}).listen(4199, '127.0.0.1', () => console.log('Local layout fixtures: http://127.0.0.1:4199 (sign in with any test email/password)'));
