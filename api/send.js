// ID вашего Gist со списком заведений
const GIST_ID = "052f7c277f6e1fc78a305e81e2135f65";

// Ключ Resend: берётся из Environment Variables Vercel или укажите 're_...' прямо строкой
const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_ВАШ_КЛЮЧ_RESEND";

export default async function handler(req, res) {
  // Разрешаем только POST-запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Безопасный парсинг тела запроса
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { shopId = '001', rating = 1, tags = [], comment = '', phone = '' } = body;

    // 1. Получаем данные заведения из GitHub Gist
    let shopName = `Точка #${shopId}`;
    let recipientEmail = 'FuldOne007@yandex.ru'; // Почта по умолчанию

    try {
      const gistRes = await fetch(`https://api.github.com/gists/${GIST_ID}`);
      if (gistRes.ok) {
        const gistData = await gistRes.json();
        const shops = JSON.parse(gistData.files['shops.json']?.content || '{}');
        if (shops[shopId]) {
          shopName = shops[shopId].name || shopName;
          if (shops[shopId].email) recipientEmail = shops[shopId].email;
        }
      }
    } catch (err) {
      console.warn('Не удалось загрузить данные из Gist, применены дефолтные:', err.message);
    }

    // 2. Расчет рейтинга и цвета бейджа
    const score = Math.max(1, Math.min(5, Number(rating) || 1));
    const starIcons = '★'.repeat(score) + '☆'.repeat(5 - score);
    const scoreColor = score <= 2 ? '#fda4af' : (score === 3 ? '#fbbf24' : '#38bdf8');

    // 3. Генерация бейджей замечаний
    const tagsHtml = tags.length > 0
      ? tags.map(tag => `
          <span style="display: inline-block; background-color: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.35); color: #fda4af; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px; margin: 0 4px 6px 0;">
            ${tag}
          </span>
        `).join('')
      : '<span style="color: #64748b; font-size: 13px;">Замечания не выбраны</span>';

    // 4. Текстовая версия (plain text — спам-фильтры Gmail проверяют её наличие)
    const textPlain = `
Новое обращение гостя: ${shopName} (Стойка № ${shopId})

Оценка: ${score} из 5
Замечания: ${tags.join(', ') || 'Не выбраны'}
Комментарий: ${comment || 'Без комментария'}
Телефон для связи: ${phone || 'Не указан'}

Отправлено сервисом https://servis-kontrol.ru
    `.trim();

    // 5. HTML-шаблон в фирменном стиле (с адаптивной табличной версткой)
    const emailHtml = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Обращение гостя</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc;">
  
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #090d16; padding: 35px 12px;">
    <tr>
      <td align="center">
        
        <!-- Основной блок -->
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #111827; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Неоновая верхняя грань -->
          <tr>
            <td height="3" style="background: linear-gradient(90deg, #38bdf8 0%, #2563eb 100%);"></td>
          </tr>

          <tr>
            <td style="padding: 32px 28px;">
              
              <!-- Верхний бейдж -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="background-color: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 99px; padding: 5px 14px;">
                    <span style="color: #38bdf8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">
                      ● Служба сервиса
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Заголовок -->
              <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.4px;">
                Новое обращение с кассы
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #94a3b8; line-height: 1.4;">
                Заведение: <strong style="color: #f8fafc;">${shopName}</strong> &bull; Стойка: <strong style="color: #f8fafc;">№ ${shopId}</strong>
              </p>

              <!-- Оценка -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 14px 18px; margin-bottom: 22px;">
                <tr>
                  <td style="font-size: 13px; font-weight: 600; color: #94a3b8;">
                    Оценка визита:
                  </td>
                  <td align="right">
                    <span style="color: #fbbf24; font-size: 18px; letter-spacing: 3px;">${starIcons}</span>
                    <span style="font-size: 13px; font-weight: 700; color: ${scoreColor}; margin-left: 6px;">
                      ${score} из 5
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Замечания -->
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #94a3b8; margin-bottom: 10px;">
                Что вызвало неудобство:
              </div>
              <div style="margin-bottom: 22px; line-height: 1.8;">
                ${tagsHtml}
              </div>

              <!-- Комментарий -->
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #94a3b8; margin-bottom: 8px;">
                Подробный комментарий:
              </div>
              <div style="background-color: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3px solid #38bdf8; border-radius: 14px; padding: 16px; font-size: 14px; color: #cbd5e1; line-height: 1.55; margin-bottom: 22px;">
                ${comment ? comment.replace(/\n/g, '<br>') : '<em style="color: #64748b;">Гость не оставил развёрнутого комментария</em>'}
              </div>

              <!-- Телефон гостя -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 14px 18px; margin-bottom: 28px;">
                <tr>
                  <td style="font-size: 13px; font-weight: 600; color: #94a3b8;">
                    Контакты для ответа:
                  </td>
                  <td align="right">
                    ${phone 
                      ? `<a href="tel:${phone}" style="color: #38bdf8; font-size: 14px; font-weight: 700; text-decoration: none;">${phone}</a>`
                      : `<span style="color: #64748b; font-size: 13px;">Не указан</span>`
                    }
                  </td>
                </tr>
              </table>

              <!-- Подвал письма -->
              <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 0 0 20px 0;">
              <div style="font-size: 11.5px; color: #64748b; line-height: 1.5;">
                Уведомление сформировано автоматически платформой 
                <a href="https://servis-kontrol.ru" target="_blank" style="color: #38bdf8; text-decoration: none; font-weight: 600;">servis-kontrol.ru</a>.
              </div>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `;

    // 6. Отправка напрямую в REST API Resend (без npm-библиотек)
    const resendReq = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Сервис Контроль <noreply@servis-kontrol.ru>',
        to: [recipientEmail],
        subject: `Обращение гостя — ${shopName} (Стойка № ${shopId})`,
        text: textPlain,
        html: emailHtml
      })
    });

    const resendData = await resendReq.json();

    if (!resendReq.ok) {
      throw new Error(resendData.message || 'Ошибка API Resend');
    }

    return res.status(200).json({ success: true, id: resendData.id });
  } catch (error) {
    console.error('Ошибка в обработчике send.js:', error);
    return res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
  }
}
