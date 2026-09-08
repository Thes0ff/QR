// =========================================================================
// ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ VERCEL (названия строго по вашему скриншоту):
// =========================================================================
const GIST_ID = process.env.GIST_ID || "052f7c277f6e1fc78a305e81e2135f65";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const VK_GROUP_TOKEN = process.env.VK_GROUP_TOKEN || process.env.VK_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { shopId = '001', rating = 1, tags = [], comment = '', phone = '' } = body;
    const cleanShopId = String(shopId).trim();

    // 1. Читаем контакты точки из Gist
    let shopName = `Точка #${cleanShopId}`;
    let targetEmail = null;
    let targetTg = null;
    let targetVk = null;

    try {
      const gistRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          'User-Agent': 'ServisKontrol-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (gistRes.ok) {
        const gistData = await gistRes.json();
        const shops = JSON.parse(gistData.files['shops.json']?.content || '{}');
        const shop = shops[cleanShopId];

        if (shop) {
          shopName = shop.name || shopName;

          // Читаем из targets (как сохраняет admin.html):
          const targets = shop.targets || {};
          targetEmail = targets.email || shop.email || null;
          targetTg    = targets.telegram || targets.tg || shop.telegram || null;
          targetVk    = targets.vk || shop.vk || null;
        } else {
          console.warn(`[Shop ${cleanShopId}] Не найдена в shops.json. Доступные ID:`, Object.keys(shops));
        }
      } else {
        console.error(`Ошибка загрузки Gist: HTTP ${gistRes.status}`);
      }
    } catch (err) {
      console.error('Ошибка при обращении к Gist:', err.message);
    }

    // Если у заведения не был заполнен email в админке, используем запасной
    const finalEmail = targetEmail || 'FuldOne007@yandex.ru';

    // 2. Оформление текста обращения
    const score = Math.max(1, Math.min(5, Number(rating) || 1));
    const starIcons = '★'.repeat(score) + '☆'.repeat(5 - score);
    const scoreColor = score <= 2 ? '#fda4af' : (score === 3 ? '#fbbf24' : '#38bdf8');
    const tagsText = tags.length > 0 ? tags.join(', ') : 'Не указаны';

    const plainText = 
`Обращение гостя — ${shopName} (Стойка № ${cleanShopId})

Оценка: ${score} из 5 (${starIcons})
Замечания: ${tagsText}
Комментарий: ${comment || 'Без комментария'}
Телефон гостя: ${phone || 'Не указан'}

Платформа servis-kontrol.ru`;

    // 3. Отправка во все указанные каналы (параллельно)
    const sendTasks = [];

    // --- А. TELEGRAM (по TG_BOT_TOKEN) ---
    if (targetTg && TG_BOT_TOKEN) {
      const tgHtml = 
`🔔 <b>Новое обращение с кассы!</b>
🏢 <b>Заведение:</b> ${shopName} (Стойка № ${cleanShopId})

⭐ <b>Оценка:</b> ${score} из 5 (${starIcons})
⚠️ <b>Замечания:</b> ${tagsText}

💬 <b>Комментарий:</b>
${comment ? `<i>«${comment}»</i>` : '<i>Без комментария</i>'}

📞 <b>Телефон:</b> ${phone ? `<code>${phone}</code>` : '<i>Не указан</i>'}`;

      sendTasks.push(
        fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: String(targetTg).trim(),
            text: tgHtml,
            parse_mode: 'HTML'
          })
        })
        .then(async (r) => {
          const resJson = await r.json();
          if (!resJson.ok) {
            console.error('[Telegram Error]', resJson);
            throw new Error(`TG error: ${resJson.description}`);
          }
          return { channel: 'telegram', success: true };
        })
      );
    }

    // --- Б. ВКОНТАКТЕ (по VK_GROUP_TOKEN) ---
    if (targetVk && VK_GROUP_TOKEN) {
      const cleanVkId = String(targetVk).replace(/\D/g, '');
      const vkParams = new URLSearchParams({
        user_id: cleanVkId,
        random_id: String(Date.now() + Math.floor(Math.random() * 1000)),
        message: plainText,
        v: '5.131',
        access_token: VK_GROUP_TOKEN
      });

      sendTasks.push(
        fetch('https://api.vk.com/method/messages.send', {
          method: 'POST',
          body: vkParams
        })
        .then(async (r) => {
          const resJson = await r.json();
          if (resJson.error) {
            console.error('[VK Error]', resJson.error);
            throw new Error(`VK error: ${resJson.error.error_msg}`);
          }
          return { channel: 'vk', success: true };
        })
      );
    }

    // --- В. EMAIL (по RESEND_API_KEY) ---
    if (finalEmail && RESEND_API_KEY) {
      const tagsHtml = tags.length > 0 
        ? tags.map(t => `<span style="display:inline-block;background-color:rgba(244,63,94,0.15);border:1px solid rgba(244,63,94,0.35);color:#fda4af;font-size:12px;font-weight:600;padding:4px 10px;border-radius:8px;margin:0 4px 6px 0;">${t}</span>`).join('')
        : '<span style="color:#64748b;font-size:13px;">Замечания не выбраны</span>';

      const emailHtml = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Обращение гостя</title>
</head>
<body style="margin:0;padding:0;background-color:#090d16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#090d16;padding:35px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;background-color:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:24px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);" cellspacing="0" cellpadding="0" border="0">
          <tr><td height="3" style="background:linear-gradient(90deg,#38bdf8 0%,#2563eb 100%);"></td></tr>
          <tr>
            <td style="padding:32px 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.25);border-radius:99px;padding:5px 14px;">
                    <span style="color:#38bdf8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">● Служба контроля сервиса</span>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:800;color:#ffffff;">Новое обращение с кассы</h1>
              <p style="margin:0 0 24px 0;font-size:14px;color:#94a3b8;">
                Заведение: <strong style="color:#f8fafc;">${shopName}</strong> &bull; Стойка: <strong style="color:#f8fafc;">№ ${cleanShopId}</strong>
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:14px 18px;margin-bottom:22px;">
                <tr>
                  <td style="font-size:13px;font-weight:600;color:#94a3b8;">Оценка визита:</td>
                  <td align="right">
                    <span style="color:#fbbf24;font-size:18px;letter-spacing:3px;">${starIcons}</span>
                    <span style="font-size:13px;font-weight:700;color:${scoreColor};margin-left:6px;">${score} из 5</span>
                  </td>
                </tr>
              </table>

              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;margin-bottom:10px;">Что вызвало неудобство:</div>
              <div style="margin-bottom:22px;line-height:1.8;">${tagsHtml}</div>

              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;margin-bottom:8px;">Комментарий гостя:</div>
              <div style="background-color:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.08);border-left:3px solid #38bdf8;border-radius:14px;padding:16px;font-size:14px;color:#cbd5e1;line-height:1.55;margin-bottom:22px;">
                ${comment ? comment.replace(/\n/g, '<br>') : '<em style="color:#64748b;">Гость не оставил развёрнутого комментария</em>'}
              </div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:14px 18px;margin-bottom:28px;">
                <tr>
                  <td style="font-size:13px;font-weight:600;color:#94a3b8;">Телефон для ответа:</td>
                  <td align="right">
                    ${phone ? `<a href="tel:${phone}" style="color:#38bdf8;font-size:14px;font-weight:700;text-decoration:none;">${phone}</a>` : '<span style="color:#64748b;font-size:13px;">Не указан</span>'}
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:0 0 20px 0;">
              <div style="font-size:11.5px;color:#64748b;line-height:1.5;">
                Уведомление отправлено платформой <a href="https://servis-kontrol.ru" target="_blank" style="color:#38bdf8;text-decoration:none;font-weight:600;">servis-kontrol.ru</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      sendTasks.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Сервис Контроль <noreply@servis-kontrol.ru>',
            to: [finalEmail],
            subject: `Обращение гостя — ${shopName} (Стойка № ${cleanShopId})`,
            text: plainText,
            html: emailHtml
          })
        })
        .then(async (r) => {
          const resJson = await r.json();
          if (!r.ok) {
            console.error('[Resend Error]', resJson);
            throw new Error(`Resend error: ${resJson.message}`);
          }
          return { channel: 'email', success: true };
        })
      );
    }

    const results = await Promise.allSettled(sendTasks);

    return res.status(200).json({
      success: true,
      shop: shopName,
      sentTo: {
        email: finalEmail,
        tg: targetTg || false,
        vk: targetVk || false
      },
      results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message })
    });

  } catch (error) {
    console.error('Критическая ошибка send.js:', error);
    return res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
}
