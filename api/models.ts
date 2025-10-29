import { OpenAI } from 'openai';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const models = await openai.models.list();

    // Filter for chat completion models only
    const chatModels = models.data
      .filter(model =>
        model.id.includes('gpt') &&
        !model.id.includes('instruct') &&
        !model.id.includes('embedding')
      )
      .sort((a, b) => b.created - a.created)
      .map(model => ({
        id: model.id,
        created: model.created,
      }));

    return new Response(JSON.stringify({ models: chatModels }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch models' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
