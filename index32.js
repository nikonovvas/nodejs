const express = require('express');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');
const app = express();
const port = 3000;
const mqttBroker = 'mqtt://broker.hivemq.com:1883'; // адрес MQTT брокера
const client = mqtt.connect(mqttBroker);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Обработчик GET запроса на главную страницу
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
app.get('/subscribe', (req, res) => {
  res.sendFile(__dirname + '/subscribe.html');
});



// Обработчик POST запроса на форму подписки на топик
app.post('/subscribe', (req, res) => {
  const brokerAddress = req.body.server;
  const brokerPort = req.body.port;
  console.log(req.body)
  // Настраиваем Socket.io для работы с клиентской стороной
  const io = require('socket.io')(server);
  const clients = {};
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
  // Обработчик подключения клиента
  io.on('connection', (socket) => {

    console.log('Client connected ' + mqttBroker);

    // Обработчик подписки на топик
    socket.on('subscribe', (topic) => {
      console.log("Подпишемся на " + topic)
      subscribe(client, topic);
      // messageAll(client, topic);
    });
  });

  client.on('message', (topic, message) => {
    console.log(`Прослушиваем ${topic}`);
    console.log(`${topic}: ${message.toString()}`);
    // Отправляем данные на клиентскую сторону для отображения на графике
    console.log(message.toString())
    io.emit('data', message.toString(),topic);
  });
  res.redirect('/subscribe')
})

// Запускаем сервер
const server = app.listen(port, () => {
  console.log(`http://localhost:3000/`);
});
