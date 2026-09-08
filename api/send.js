import { Resend } from 'resend';

// Инициализация клиента Resend (ключ берётся из переменных окружения или указывается напрямую)
const resend = new Resend(process.env.RESEND_API_KEY || 're_ВАШ_КЛЮЧ_RESEND');

// GitHub Gist с базой магазинов для получения названия и почты точки
const GIST_ID = "052f7c277f6e1fc78a305e81e2135f65";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { shopId, rating, tags = [], comment = '', phone = '' } = req.body;

    // 1. Получаем данные о магазине из Gist
    let shopName = `Точка #${shopId}`;
    let recipientEmail = 'FuldOne007@yandex.ru'; // Email по умолчанию

    try {
      const gistRes = await fetch(`https://api.github.com/gists/${GIST_ID}`);
      const gistData = await gistRes.json();
      const shops = JSON.parse(gistData.files['shops.json'].content || '{}');
      
      if (shops[shopId]) {
        shopName = shops[shopId].name || shopName;
        if (shops[shopId].email) recipientEmail = shops[shopId].email;
      }
    } catch (err) {
      console.warn('Не удалось загрузить данные из Gist, используем дефолтные значения:', err);
    }

    // 2. Формируем визуал рейтинга
    const starsCount = Math.max(1, Math.min(5, Number(rating) || 1));
    const starIcons = '★'.repeat(starsCount) + '☆'.repeat(5 - starsCount);
    const ratingColor = starsCount <= 2 ? '#fda4af' : (starsCount === 3 ? '#fbbf24' : '#38bdf8');

    // 3. Формируем теги замечаний
    const tagsHtml = tags.length > 0 
      ? tags.map(tag => `
          <span style="display: inline-block; background-color: rgba(244, 63, 94, 0.14); border: 1px solid rgba(244, 63, 94, 0.35); color: #fda4af; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px; margin: 0 4px 6px 0;">
            ${tag}
          </span>
        `).join('')
      : '<span style="color: #64748b; font-size: 13px;">Замечания не выбраны</span>';

    // 4. Текстовая версия (критически важна для обхода спам-фильтров Gmail)
    const textFallback = `
Обращение гостя — ${shopName} (ID: ${shopId})
Оценка: ${starsCount} из 5
Проблемы: ${tags.join(', ') || 'Не указаны'}
Комментарий: ${comment || 'Без комментария'}
Телефон для связи: ${phone || 'Не указан'}

Отправлено сервисом servis-kontrol.ru
    `.trim();

    // 5. Фирменный HTML-шаблон в стиле сайта
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Обращение гостя</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f8fafc;">
  
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #090d16; padding: 35px 12px;">
    <tr>
      <td align="center">
        
        <!-- Карточка письма -->
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #111827; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Верхняя неоновая полоса -->
          <tr>
            <td height="3" style="background: linear-gradient(90deg, #38bdf8 0%, #2563eb 100%);"></td>
          </tr>

          <!-- Контент -->
          <tr>
            <td style="padding: 32px 28px;">
              
              <!-- Бейдж службы сервиса -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="background-color: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 99px; padding: 5px 14px;">
                    <span style="color: #38bdf8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">
                      ● Служба контроля сервиса
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Заголовок -->
              <h1 style="margin: 0 0 6px 0; font-size: 23px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; line-height: 1.25;">
                Новое обращение с кассы
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #94a3b8; line-height: 1.4;">
                Заведение: <strong style="color: #f8fafc;">${shopName}</strong> &bull; Стойка: <strong style="color: #f8fafc;">№ ${shopId}</strong>
              </p>

              <!-- Блок оценки (Звёзды) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 14px 18px; margin-bottom: 22px;">
                <tr>
                  <td style="font-size: 13px; font-weight: 600; color: #94a3b8;">
                    Оценка визита:
                  </td>
                  <td align="right">
                    <span style="color: #fbbf24; font-size: 19px; letter-spacing: 3px;">${starIcons}</span>
                    <span style="font-size: 13px; font-weight: 700; color: ${ratingColor}; margin-left: 6px;">
                      ${starsCount} из 5
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Замечания гостя -->
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #94a3b8; margin-bottom: 10px;">
                Что вызвало неудобство:
              </div>
              <div style="margin-bottom: 22px; line-height: 1.8;">
                ${tagsHtml}
              </div>

              <!-- Текст комментария -->
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #94a3b8; margin-bottom: 8px;">
                Комментарий гостя:
              </div>
              <div style="background-color: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3px solid #38bdf8; border-radius: 14px; padding: 16px; font-size: 14px; color: #cbd5e1; line-height: 1.55; margin-bottom: 22px;">
                ${comment ? comment.replace(/\n/g, '<br>') : '<em style="color: #64748b;">Гость не оставил развёрнутого комментария</em>'}
              </div>

              <!-- Телефон для связи -->
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

              <!-- Разделитель -->
              <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 0 0 20px 0;">

              <!-- Подвал письма -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size: 11.5px; color: #64748b; line-height: 1.5;">
                    Уведомление отправлено через систему контроля качества 
                    <a href="https://servis-kontrol.ru" target="_blank" style="color: #38bdf8; text-decoration: none; font-weight: 600;">servis-kontrol.ru</a>.
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `;

    // 6. Отправка через Resend
    const response = await resend.emails.send({
      from: 'Сервис Контроль <noreply@servis-kontrol.ru>',
      to: recipientEmail,
      reply_to: phone ? undefined : undefined,
      subject: `Обращение гостя — ${shopName} (Стойка № ${shopId})`,
      text: textFallback,
      html: htmlTemplate,
    });

    return res.status(200).json({ success: true, id: response.id });
  } catch (error) {
    console.error('Ошибка отправки через Resend:', error);
    return res.status(500).json({ error: error.message || 'Ошибка сервера при отправке' });
  }
}
