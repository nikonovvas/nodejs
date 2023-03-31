const express = require('express');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');
const app = express();
const port = 3000;
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot('6197362821:AAFdHHF-SuDYPKa9cGtk4NwfINZZVB8d9kw', { polling: true });
const mysql = require('mysql');
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  port: '3306',
  database: 'metio'
});
connection.connect();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
// Запускаем сервер
const server = app.listen(port, () => {
  console.log(`http://localhost:3000/`);
});

// Обработчик GET запроса на главную страницу
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
app.get('/subscribe', (req, res) => {
  res.sendFile(__dirname + '/subscribe.html');

});

// Обработчик POST запроса на форму подписки на топик
app.post('/subscribe', (req, res) => {
  let chat_id=req.body.chat_id
  
  
  let mqttBroker = `mqtt://${req.body.server}:${req.body.port}`
  let client = mqtt.connect(mqttBroker);
  console.log('Подключились к ' + mqttBroker)
  let clients = {};
  // Функция подписки на топик
  function subscribe(client, topic) {
    // Добавляем клиента в список подписанных на этот топик
    if (!clients[topic]) {
      clients[topic] = [];
    }
    clients[topic].push(topic);
    client.subscribe(topic);
    console.log(`Подписались на топик ${topic}`);
  }
  // Настраиваем Socket.io для работы с клиентской стороной
  let io = require('socket.io')(server);
  // Обработчик подключения клиента
  io.on('connection', (socket) => {
    console.log('Client connected ' + mqttBroker);
    // Обработчик подписки на топик
    socket.on('subscribe', (topic, key) => {
      console.log("Подпишемся на " + topic)
      console.log(key)
      // sql_top={topic_name:`${topic}`}
      connection.query('SELECT * FROM topic_info WHERE topic_name = ?', topic, (error, results, fields) => {
        if (error) throw error;
        if (results.length === 0) {
          // Если записи с таким именем еще нет, вставляем новую запись
          connection.query('INSERT INTO topic_info SET ?', { topic_name: `${topic}`, top: `${key.top}`, down: `${key.down}`, send_status: '0' ,chat_id: `${chat_id}`}, (error, results, fields) => {
            if (error) throw error;
          });
        } else {
          console.log('Такой пользователь уже существует');
          connection.query('UPDATE topic_info SET `top` = ?, `down` = ?, `send_status` = ? WHERE topic_name = ?', [key.top, key.down,0, topic], function (error, results, fields) {
            if (error) throw error;
            
          });
        }
      });

      subscribe(client, topic);
      // messageAll(client, topic);
    });
    socket.on('unsubscribe', topic => {
      client.unsubscribe(topic)
      client.end();
    });

  });


  client.on('message', (topic, message) => {
    console.log(`Прослушиваем ${topic}`);
    console.log(`${topic}: ${message.toString()}`);
    connection.query('SELECT `send_status`, `top`, `down` FROM `topic_info` WHERE `topic_name` = ?', topic, (error, results, fields) => {
      if (error) throw error;
      if (results[0].send_status==false) {
        if (results[0].top<=Number(message)){
          bot.sendMessage(chat_id, `✉️INFO✉️\n📈Значение датчика ${topic} превысило заданную отметку ${results[0].top} \n📢Текущее значение состовляет: ` + message +`\n🕑Время: ${new Date()}\n 🔕Уведомление для датчика отключено. Чтобы вновь включить уведомления нажмите  /restart_send `);
          connection.query('UPDATE topic_info SET `send_status` = ? WHERE topic_name = ?', [1, topic], function (error, results, fields) {
            if (error) throw error;
          });
        }
        if (results[0].down>=Number(message)){
          bot.sendMessage(chat_id, `✉️INFO✉️\n📉Значение датчика ${topic} ниже заданной отметки ${results[0].down} \n📢Текущее значение состовляет: ` + message +`\n🕑Время: ${new Date()}\n 🔕Уведомление для датчика отключено. Чтобы вновь включить уведомления нажмите  /restart_send `);
          connection.query('UPDATE topic_info SET `send_status` = ? WHERE topic_name = ?', [1, topic], function (error, results, fields) {
            if (error) throw error;
          });
        }
        
      }
    });
    console.log(message.toString())
    io.emit('message', topic, message.toString());
  });

  res.redirect('/subscribe')

})

bot.on('message', (msg) => {

  // Получаем ID чата и текст сообщения
  const chatId = msg.chat.id;
  const text = msg.text;
  if (text === '/start') {
    bot.sendMessage(chatId, 'Привет!👋🏻\n Это  бот для метеостанция. \nЧтобы получить ID чата нажми /chat_id');
  }
  else if (text === '/chat_id') {
    bot.sendMessage(chatId, '✅Номер чата (скопируй его для главной страницы ):');
    bot.sendMessage(chatId,`${chatId}`)
  }
  else if (text === '/info') {
    bot.sendMessage(chatId, 'ℹ️Получить номер чата - /chat_id\nℹ️Включить оповещения  - /restart_send\nℹ️Информация о боте  - /info\n');
  }
  else if (text === '/restart_send') {
    bot.sendMessage(chatId, '🔔Все оповещения активированы!');
    connection.query("UPDATE `topic_info` SET `send_status`='0' WHERE `chat_id`=?",chatId, (error, results, fields) => {
      if (error) throw error;
    });
    

  }
  else{
    bot.sendMessage(chatId, 'Команда не распознана, напиши /info для плучения возможностей бота');
  }
});