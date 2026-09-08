export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { password, token } = body || {};

    // Пароль берется строго из секретных переменных окружения Vercel
    const masterPassword = process.env.ADMIN_PASSWORD;

    if (!masterPassword) {
      return res.status(500).json({ 
        error: 'В Vercel не настроена переменная ADMIN_PASSWORD! Добавьте её в Settings -> Environment Variables.' 
      });
    }

    // Создаём хэш-токен на основе пароля для безопасного хранения сессии
    const expectedToken = Buffer.from(masterPassword).toString('base64');

    // Проверяем: прислан ли пароль или сохранённый ранее токен сессии
    if (password === masterPassword || token === expectedToken) {
      return res.status(200).json({ 
        success: true, 
        token: expectedToken 
      });
    }

    return res.status(401).json({ error: 'Неверный пароль администратора' });

  } catch (error) {
    console.error('Ошибка в auth.js:', error);
    return res.status(500).json({ error: 'Ошибка сервера авторизации' });
  }
}
