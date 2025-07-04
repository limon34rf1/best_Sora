// api/generate.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const { prompt: userPrompt } = req.body;
  if (!userPrompt) {
    res.status(400).json({ error: 'No prompt provided' });
    return;
  }

  try {
    // 1) Gemini: сделать «прокачанный» промпт
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta2/models/gemini-2.5-flash:generateText?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: {
            text:
              'Напиши очень подробный промпт для Sora без лишних слов. ' +
              'Сохрани идею пользователя и улучшить описание. ' +
              'Ответ — на английском.\n' +
              userPrompt
          }
        })
      }
    );
    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini ${geminiRes.status}: ${errText}`);
    }
    const geminiJson = await geminiRes.json();
    const bestPrompt = geminiJson.candidates?.[0]?.output || '';

    // 2) Sora: генерируем изображение
    const soraRes = await fetch('https://api.laozhang.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SORA_API_KEY}`
      },
      body: JSON.stringify({
        model: 'sora-image',
        stream: false,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user',   content: bestPrompt }
        ]
      })
    });
    if (!soraRes.ok) {
      const errText = await soraRes.text();
      throw new Error(`Sora ${soraRes.status}: ${errText}`);
    }
    const soraJson = await soraRes.json();
    const content = soraJson.choices?.[0]?.message?.content || '';
    // парсим URL-ы внутри скобок
    const urls = Array.from(content.matchAll(/\((https?:\/\/[^\s)]+)\)/g))
                      .map(m => m[1]);

    res.status(200).json({ urls });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
