const request = require('supertest');
const { app, server } = require('../app/index');

afterAll(() => server.close());

describe('GET /', () => {
  it('returns 200 with todos array', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('todos');
    expect(Array.isArray(res.body.todos)).toBe(true);
  });
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });
});

describe('GET /metrics', () => {
  it('returns 200 with prometheus text format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });
});

describe('POST /todos', () => {
  it('creates a new todo', async () => {
    const res = await request(app)
      .post('/todos')
      .send({ text: 'Test todo' });
    expect(res.statusCode).toBe(201);
    expect(res.body.text).toBe('Test todo');
    expect(res.body.done).toBe(false);
  });

  it('returns 400 when text is missing', async () => {
    const res = await request(app).post('/todos').send({});
    expect(res.statusCode).toBe(400);
  });
});
