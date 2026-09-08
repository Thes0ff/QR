export default async function handler(req, res) {
  // Разрешаем только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shopId, rating, tags, comment, phone } = req.body;

    // Секретные токены из переменных окружения Vercel
    const GIST_ID = process.env.GIST_ID;
    const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
    const VK_GROUP_TOKEN = process.env.VK_GROUP_TOKEN;
    const WEB3FORMS_KEY = process.env.WEB3FORMS_KEY;

    // 1. Получаем данные точки из GitHub Gist
    const gistRes = await fetch(`https://api.github.com/gists/${GIST_ID}`);
    const gistData = await gistRes.json();
    const shops = JSON.parse(gistData.files['shops.json'].content || '{}');

    const shop = shops[shopId];
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const shopName = shop.name || `Точка #${shopId}`;
    const reasons = tags && tags.length > 0 ? `\n📌 Проблемы: ${tags.join(', ')}` : '';
    const text = `🚨 ЖАЛОБА С КАССЫ: ${shopName}\n` +
                 `⭐ Оценка: ${rating} из 5` +
                 reasons +
                 `\n💬 Текст: ${comment || 'Не указан'}\n` +
                 `📞 Телефон: ${phone || 'Не указан'}`;

    const requests = [];

    // 2. Отправка в Telegram
    if (shop.targets?.telegram && TG_BOT_TOKEN) {
      requests.push(
        fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: shop.targets.telegram, text })
        })
      );
    }

    // 3. Отправка в VK
    if (shop.targets?.vk && VK_GROUP_TOKEN) {
      const cleanVkId = String(shop.targets.vk).replace(/\D/g, '');
      const params = new URLSearchParams({
        user_id: cleanVkId,
        message: text,
        random_id: Math.floor(Math.random() * 10000000),
        access_token: VK_GROUP_TOKEN,
        v: '5.199'
      });
      requests.push(
        fetch('https://api.vk.com/method/messages.send', {
          method: 'POST',
          body: params
        })
      );
    }

// 4. Отправка на Email (Web3Forms)
    if (shop.targets?.email && WEB3FORMS_KEY) {
      requests.push(
        fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            access_key: WEB3FORMS_KEY.trim(),
            from_name: "Служба контроля качества",
            subject: `🚨 Жалоба: ${shopName}`,
            message: text
          })
        })
        .then(async (r) => {
          const resJson = await r.json();
          console.log('=== WEB3FORMS STATUS ===:', r.status);
          console.log('=== WEB3FORMS BODY ===:', JSON.stringify(resJson));
        })
        .catch((err) => console.error('=== WEB3FORMS ERROR ===:', err))
      );
    } else {
      console.log('Email не отправлен. Причина:', {
        hasTargetEmail: Boolean(shop.targets?.email),
        hasKey: Boolean(WEB3FORMS_KEY)
      });
    }
