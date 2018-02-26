const http = require('http');
const socketio = require('socket.io');
const fs = require('fs');

const PORT = process.env.PORT || process.env.NODE_PORT || 3000;

const handler = (req, res) => {
  fs.readFile(`${__dirname}/../client/index.html`, (err, data) => {
    if (err) {
      throw err;
    }
    res.writeHead(200);
    res.end(data);
  });
};

const app = http.createServer(handler);

const io = socketio(app);

const users = {};
const wordBank = ['Foot', 'Dog', 'Yo-yo', 'Phone', 'Flower', 'Eye', 'Computer', 'Car', 'Airplane', 'Pikachu', 'Sword', 'Cat', 'Velociraptor', 'Sun', 'Dragon',
  'Bat', 'Hat', 'Balloon', 'Clock', 'Kite', 'Keys', 'Bed', 'Glasses', 'Headphones', 'Robbery', 'Tree', 'Cookie', 'Snail', 'Guitar', 'Crown',
  'Fire', 'Moose', 'Robot', 'Snowflake', 'Stars', 'Planet', 'Snowman', 'Skateboard', 'Cow', 'Bridge', 'Pool', 'Penguin', 'Cape', 'Pizza',
  'Baseball', 'Soccer', 'Basketball', 'Hockey', 'Frisbee', 'Angel', 'Wheelbarrow', 'Hammer', 'Tuxedo', 'Sled', 'Baguette', 'Television',
  'Fight', 'Alien', 'Candy', 'Lamp', 'Cheese', 'Doorknob', 'Ice Cream', 'Cowboy', 'Pirate', 'Tie', 'Spoon', 'Owl', 'Money', 'Pencil'];
let roundWord = '';
let artist = 0;
let usersInRoom = 0;
app.listen(PORT);

const onJoined = (sock) => {
  const socket = sock;
  socket.on('join', (data) => {
    // message back to new user
    const joinMsg = {
      name: 'Server',
      room: data.roomNum,
      msg: 'Welcome to the room, you must have at least 2 people to play.',
    };

    socket.name = data.name;
    socket.roomNum = data.room;
    socket.score = 0;

    socket.join(socket.roomNum);

    // announcement to everyone else in room
    const response = {
      name: 'Server',
      msg: `${data.name} has joined the room.`,
    };
    socket.broadcast.to(socket.roomNum).emit('msg', response);
    usersInRoom = io.sockets.adapter.rooms[socket.roomNum].length - 1;
    console.log(data.name);
    users[usersInRoom] = data.name;
    console.log(users[usersInRoom]);
    // success message to new user
    socket.emit('msg', { name: 'Server', msg: 'You have joined the room.' });
    socket.emit('msg', joinMsg);
  });
};

const onDraw = (sock) => {
  // handle draw inputs to the canvas
  const socket = sock;
  socket.on('draw', (data) => {
    io.sockets.in(socket.roomNum).emit('drawCanvas', data);
  });
};

const onMsg = (sock) => {
  const socket = sock;
  // handle messages in the chat room
  socket.on('msgToServer', (data) => {
    if (data.msg === roundWord && socket.name !== users[artist]) {
      socket.score++;
      io.sockets.in(socket.roomNum).emit('msg', { name: 'Server', msg: `${socket.name} has guessed the word [${roundWord}]. Their score is now ${socket.score}!` });
      if (socket.score < 10) { io.sockets.in(socket.roomNum).emit('endRound'); } else if (socket.score === 10) {
        io.sockets.in(socket.roomNum).emit('msg', { name: 'Server', msg: `${socket.name} has won the game!` });
        io.sockets.in(socket.roomNum).emit('endGame');
      }
    } else { io.sockets.in(socket.roomNum).emit('msg', { name: data.name, msg: data.msg }); }
  });

  socket.on('dcMsg', (data) => {
    io.sockets.in(socket.roomNum).emit('msg', { name: data.name, msg: data.msg });
  });
};

const onGame = (sock) => {
  const socket = sock;
  socket.on('clickStart', () => {
    io.sockets.in(socket.roomNum).emit('checkUsers', { numUsers: io.sockets.adapter.rooms[socket.roomNum].length });
  });

  socket.on('chooseWord', () => {
    const num = Math.floor(Math.random() * wordBank.length);
    roundWord = wordBank[num];
    io.sockets.in(socket.roomNum).emit('showWord', { currWord: roundWord, currArtist: users[artist] });
    console.log(`artist name: ${users[artist]}`);
    console.log(`artist num: ${artist}`);
  });

  // make timer, if it gets to 30 w/e reset timer/hasguessed to false
  socket.on('nextRound', () => {
    artist++;
    if (artist > usersInRoom) { artist = 0; }
    console.log(artist);
    io.sockets.in(socket.roomNum).emit('checkUsers', { numUsers: io.sockets.adapter.rooms[socket.roomNum].length });
  });
};

const onClear = (sock) => {
  // clears canvas for every user
  const socket = sock;
  socket.on('clear', () => {
    io.sockets.in(socket.roomNum).emit('clearCanvas');
  });
};

const onDisconnect = (sock) => {
  // handles disconnect for a user in game
  const socket = sock;
  socket.leave(socket.roomNum);
  socket.on('disconnect', () => {
    delete users[usersInRoom];
    usersInRoom--;
  });
};

io.sockets.on('connection', (socket) => {
  onJoined(socket);
  onMsg(socket);
  onGame(socket);
  onDraw(socket);
  onClear(socket);
  onDisconnect(socket);
});
