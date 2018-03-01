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

const users = [];
const wordBank = ['Foot', 'Dog', 'Yo-yo', 'Phone', 'Flower', 'Eye', 'Computer', 'Car', 'Airplane', 'Pikachu', 'Sword', 'Cat', 'Velociraptor', 'Sun', 'Dragon',
  'Bat', 'Hat', 'Balloon', 'Clock', 'Kite', 'Keys', 'Bed', 'Glasses', 'Headphones', 'Robbery', 'Tree', 'Cookie', 'Snail', 'Guitar', 'Crown',
  'Fire', 'Moose', 'Robot', 'Snowflake', 'Stars', 'Planet', 'Snowman', 'Skateboard', 'Cow', 'Bridge', 'Pool', 'Penguin', 'Cape', 'Pizza',
  'Baseball', 'Soccer', 'Basketball', 'Hockey', 'Frisbee', 'Angel', 'Wheelbarrow', 'Hammer', 'Tuxedo', 'Sled', 'Baguette', 'Television',
  'Fight', 'Alien', 'Candy', 'Lamp', 'Cheese', 'Doorknob', 'Ice Cream', 'Cowboy', 'Pirate', 'Tie', 'Spoon', 'Owl', 'Money', 'Pencil',
  'Laptop', 'Surfing', 'Shark', 'Explosion', 'Torture', 'Lightning', 'Cloud', 'Blueberries', 'Scar', 'Ice Skating', 'Textbook', 'Helicopter'];
const roundWord = [];
const roundNum = [];
let usersInRoom = 0;
let num;

app.listen(PORT);

const onJoined = (sock) => {
  const socket = sock;
  socket.on('searchRoom', (data) => {
    for (let i = 0; i < usersInRoom; i++) {
      if (users[`${i}:${data.room}`] === data.name) {
        socket.emit('nameTaken', { msg: 'Sorry, this username exists in this room already.' });
      }
    }
    if (roundNum[data.room] >= 1) {
      socket.emit('gameStarted', { msg: 'Sorry, this room already has a game in progress.' });
    }
    // if player with username not in room and if game in room not started, let player join
    socket.emit('letJoin', { name: data.name, roomNum: data.room });
  });

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
    users[`${usersInRoom}:${socket.roomNum}`] = data.name;
    usersInRoom++;
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
    if (roundNum[socket.roomNum] > 0) {
      if (data.msg.toLowerCase() === roundWord[socket.roomNum].toLowerCase()) {
        socket.score++;
        io.sockets.in(socket.roomNum).emit('msg', { name: 'Server', msg: `${socket.name} has guessed the word [${roundWord[socket.roomNum]}]. Their score is now ${socket.score}!` });
        if (socket.score < 10) {
          socket.emit('endRound');
          const endMsg = {
            name: 'Server',
            msg: 'Starting new round...',
          };
          io.sockets.in(socket.roomNum).emit('msg', endMsg);
        } else if (socket.score === 10) {
          io.sockets.in(socket.roomNum).emit('msg', { name: 'Server', msg: `${socket.name} has won the game!` });
          io.sockets.in(socket.roomNum).emit('endGame');
          roundNum[socket.roomNum] = 0;
        }
      } else {
        io.sockets.in(socket.roomNum).emit('msg', { name: data.name, msg: data.msg });
      }
    } else {
      io.sockets.in(socket.roomNum).emit('msg', { name: data.name, msg: data.msg });
    }
  });
};

const onGame = (sock) => {
  const socket = sock;

  socket.on('clickStart', () => {
    if (io.sockets.adapter.rooms[socket.roomNum].length >= 2) {
      roundNum[socket.roomNum] = 1;
      io.sockets.in(socket.roomNum).emit('startGame', { numUsers: io.sockets.adapter.rooms[socket.roomNum].length });
      socket.emit('continueGame', { maxPlayers: io.sockets.adapter.rooms[socket.roomNum].length, roundNum: roundNum[socket.roomNum] - 1 });
    } else {
      socket.emit('failStart');
    }
  });

  socket.on('chooseWord', (data) => {
    const room = io.sockets.adapter.rooms[socket.roomNum];
    const artist = data.roundNum % room.length;
    num = Math.floor(Math.random() * wordBank.length);
    roundWord[socket.roomNum] = wordBank[num];
    io.sockets.in(socket.roomNum).emit('showWord', { currWord: roundWord[socket.roomNum], currArtist: users[`${artist}:${socket.roomNum}`] });

    const startMsg = {
      name: 'Server',
      msg: `${users[`${artist}:${socket.roomNum}`]} is the artist. They will try to draw the randomly generated word.`,
    };
    io.sockets.in(socket.roomNum).emit('msg', startMsg);
  });

  socket.on('nextRound', () => {
    roundNum[socket.roomNum]++;
    socket.emit('continueGame', { maxPlayers: io.sockets.adapter.rooms[socket.roomNum].length, roundNum: roundNum[socket.roomNum] - 1 });
  });

  socket.on('restart', () => {
    socket.score = 0;
    roundNum[socket.roomNum] = 0;
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
  socket.on('disconnect', () => {
    io.sockets.in(socket.roomNum).emit('endGame');
    if (roundNum[socket.roomNum] >= 1) {
      const quitMsg = {
        name: 'Server',
        msg: `${socket.name} has quit, ending game...`,
      };
      io.sockets.in(socket.roomNum).emit('msg', quitMsg);
    } else {
      const leaveMsg = {
        name: 'Server',
        msg: `${socket.name} has left the room`,
      };
      io.sockets.in(socket.roomNum).emit('msg', leaveMsg);
    }
    let delUser = false;
    for (let i = 0; i < usersInRoom; i++) {
      if (users[`${i}:${socket.roomNum}`] === socket.name) {
        delete users[`${i}:${socket.roomNum}`];
        delUser = true;
      }
      if (delUser) {
        users[`${i}:${socket.roomNum}`] = users[`${i + 1}:${socket.roomNum}`];
      }
    }
    usersInRoom--;
    socket.leave(socket.roomNum);
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
