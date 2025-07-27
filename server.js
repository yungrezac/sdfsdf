// index.js

// --- ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ ---
// 'node-telegram-bot-api' для взаимодействия с Telegram Bot API
// 'express' для создания веб-сервера, который будет принимать вебхуки от Telegram
// 'crypto' для валидации данных, полученных от Telegram
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const crypto = require('crypto');

// --- КОНФИГУРАЦИЯ ---
// Токен вашего бота, полученный от @BotFather
const token = '8203577700:AAHBPcxw4y5kT4trl_bfZY4QRBQ99Q0S2E8';

// URL вашего веб-приложения, где оно развернуто
const webAppUrl = 'https://lively-malabi-81b16c.netlify.app';

// URL вашего сервера, на который Telegram будет отправлять обновления.
// ВАЖНО: Для работы вебхуков у вас должен быть публичный IP-адрес и SSL-сертификат (HTTPS).
// При развертывании замените 'YOUR_SERVER_URL' на реальный адрес вашего сервера.
const webhookUrl = 'https://sdfsdf-42gs.onrender.com'; // Пример: https://your-domain.com

// --- ИНИЦИАЛИЗАЦИЯ ---
const bot = new TelegramBot(token);
const app = express();

// Используем express.json() для автоматического парсинга JSON-тела запросов
app.use(express.json());

// --- НАСТРОЙКА ВЕБХУКА ---
// Устанавливаем вебхук. Telegram будет отправлять все обновления на этот URL.
// `${webhookUrl}/webhook/${token}` - это безопасный способ убедиться, что запросы приходят именно от Telegram.
bot.setWebHook(`${webhookUrl}/webhook/${token}`)
    .then(() => console.log('Вебхук успешно установлен!'))
    .catch(err => console.error('Ошибка установки вебхука:', err));

// --- ОБРАБОТЧИК ВЕБХУКОВ ---
// Создаем POST-маршрут для приема обновлений от Telegram
app.post(`/webhook/${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200); // Отправляем статус 200 OK, чтобы подтвердить получение обновления
});


// --- ФУНКЦИЯ ВАЛИДАЦИИ INITDATA ---
/**
 * Проверяет подлинность данных, полученных от Web App.
 * @param {string} initData - Строка initData из Telegram.WebApp.initData.
 * @param {string} botToken - Токен вашего бота.
 * @returns {boolean} - True, если данные валидны, иначе false.
 */
function validateInitData(initData, botToken) {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash) return false;

        params.delete('hash');
        params.sort(); // Параметры должны быть отсортированы в алфавитном порядке

        let dataCheckString = '';
        for (const [key, value] of params.entries()) {
            dataCheckString += `${key}=${value}\n`;
        }
        dataCheckString = dataCheckString.slice(0, -1);

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        return hmac === hash;
    } catch (error) {
        console.error("Ошибка валидации:", error);
        return false;
    }
}


// --- ОБРАБОТЧИКИ КОМАНД И СООБЩЕНИЙ ---

// Обработчик команды /start
// При получении этой команды бот отправит приветственное сообщение
// и кнопку для открытия вашего веб-приложения.
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = "Добро пожаловать в TerraRun! 🏃‍♂️\n\nНажмите кнопку ниже, чтобы открыть карту и начать захватывать территории!";

    // Создаем inline-клавиатуру с кнопкой для открытия Web App
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{
                    text: '🗺️ Открыть карту',
                    web_app: {
                        url: webAppUrl,
                        request_location_access: true // Запрашиваем доступ к геолокации
                    }
                }]
            ]
        }
    };

    bot.sendMessage(chatId, welcomeMessage, options);
});

// Обработчик команды /menu для установки кнопки меню
bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;
    bot.setChatMenuButton({
        chat_id: chatId,
        menu_button: {
            type: 'web_app',
            text: 'Запустить',
            web_app: { 
                url: webAppUrl,
                request_location_access: true // Запрашиваем доступ к геолокации
            }
        }
    }).then(() => {
        bot.sendMessage(chatId, 'Кнопка меню обновлена! Теперь она открывает приложение TerraRun и запрашивает доступ к геолокации.');
    }).catch(err => {
        console.error('Ошибка установки кнопки меню:', err);
    });
});

// Обработчик команды /resetmenu для сброса кнопки меню
bot.onText(/\/resetmenu/, (msg) => {
    const chatId = msg.chat.id;
    bot.setChatMenuButton({
        chat_id: chatId,
        menu_button: { type: 'default' }
    }).then(() => {
        bot.sendMessage(chatId, 'Кнопка меню сброшена к стандартной.');
    }).catch(err => {
        console.error('Ошибка сброса кнопки меню:', err);
    });
});


// Обработчик данных, полученных из Web App
// Срабатывает, когда в вашем приложении вызывается `tg.sendData(...)`
bot.on('message', (msg) => {
    // Проверяем, содержит ли сообщение данные из web_app
    if (msg.web_app_data) {
        const chatId = msg.chat.id;
        try {
            // ВАЖНО: Для работы валидации ваше веб-приложение должно отправлять
            // объект, содержащий и ваши данные, и строку initData.
            // Пример для фронтенда:
            // const dataToSend = { type: 'new_post', title: '...' };
            // const dataWithAuth = { payload: dataToSend, _auth: Telegram.WebApp.initData };
            // Telegram.WebApp.sendData(JSON.stringify(dataWithAuth));

            const receivedJson = JSON.parse(msg.web_app_data.data);
            
            // --- ВАЛИДАЦИЯ ДАННЫХ ---
            if (!validateInitData(receivedJson._auth, token)) {
                console.error('Validation failed for data from Web App. Hash mismatch.');
                bot.sendMessage(chatId, 'Ошибка валидации. Данные не могут быть приняты.');
                return; // Прерываем выполнение, если данные не прошли проверку
            }
            
            console.log('Validation successful! Processing data...');
            const data = receivedJson.payload; // Извлекаем полезную нагрузку

            // Обрабатываем данные в зависимости от их типа
            if (data.type === 'new_post') {
                let notificationText;

                // Формируем текст уведомления в зависимости от того, была ли захвачена территория
                if (data.area && data.area > 0) {
                    const area = data.area;
                    const formattedArea = area > 10000 ?
                        `${(area / 1000000).toFixed(2)} км²` :
                        `${Math.round(area)} м²`;
                    notificationText = `🎉 **Новое достижение!**\n\nПользователь *${msg.from.first_name}* только что опубликовал пост *"${data.title}"* и захватил *${formattedArea}* новой территории!`;
                } else {
                    notificationText = `✍️ **Новый пост в ленте!**\n\nПользователь *${msg.from.first_name}* опубликовал пост: *"${data.title}"*`;
                }

                // Отправляем отформатированное сообщение в чат
                bot.sendMessage(chatId, notificationText, {
                    parse_mode: 'Markdown'
                });
            }

        } catch (error) {
            console.error('Ошибка обработки данных из Web App:', error);
            bot.sendMessage(chatId, 'Произошла ошибка при обработке данных из приложения.');
        }
    }
});


// --- ЗАПУСК СЕРВЕРА ---
// Указываем порт, на котором будет работать наш сервер.
// Используем process.env.PORT для совместимости с хостинг-платформами (например, Heroku).
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
