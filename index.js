const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const path = require('path');

const fs = require('fs');

// for logFile
function logToFile(message) {
    const logFilePath = path.join(__dirname, 'user_activity.log');
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;

    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.error('Failed to write to log file:', err);
        }
    });
}

app.use(express.static(path.join(__dirname)));

// Serve index.html on the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let gameState = {
    rooms: {} // Each room will have its own game state
};

function initializeBoard() {
    let board = [];
    // create a 2d array
    for (let i = 0; i < 8; i++) {
        board[i] = new Array(8).fill(null);
    }
    const pieces = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    for (let i = 0; i < 8; i++) {
        board[0][i] = { type: pieces[i], color: 'white' };
        board[1][i] = { type: 'pawn', color: 'white' };
        board[6][i] = { type: 'pawn', color: 'black' };
        board[7][i] = { type: pieces[i], color: 'black' };
    }

    return board;
}

io.on('connection', (socket) => {
    console.log('A user connected');
    logToFile(`User connected: ${socket.id}`);
    socket.on('joinRoom', ({ name, room }) => {
        socket.join(room);
        console.log(`${name} joined room ${room}`);

        if (!gameState.rooms[room]) {
            gameState.rooms[room] = {
                board: initializeBoard(),
                turn: 'white',
                players: {},
                winner: null
            };
        }
        let roomState = gameState.rooms[room];

        if (!roomState.players.white) {
            roomState.players.white = { id: socket.id, name: name };
            socket.emit('playerColor', 'white');
            logToFile(`User ${name} assigned color: white`);
        } else if (!roomState.players.black) {
            roomState.players.black = { id: socket.id, name: name };
            socket.emit('playerColor', 'black');
            logToFile(`User ${name} assigned color: black`);
            // Notify both players of each other's names
            io.to(roomState.players.white.id).emit('opponentName', roomState.players.black.name);
            io.to(roomState.players.black.id).emit('opponentName', roomState.players.white.name);
        } else {
            const mess="Sorry, room is full.Please try other room";
            socket.emit('roomFull', mess);
        }
        // if(roomState.players.black && roomState.players.white){
            socket.emit('initGame', roomState);
        // }
        // console.log(`room state: ${roomState}`)
        socket.on('offer', (offer) => {
            socket.broadcast.emit('offer', offer);
        });

        socket.on('answer', (answer) => {
            socket.broadcast.emit('answer', answer);
        });

        socket.on('candidate', (candidate) => {
            socket.broadcast.emit('candidate', candidate);
        });

        socket.on('movePiece', (move) => {
            if (isValidMove(move, roomState, socket.id)) {
                roomState = updateGameState(roomState, move);
                io.to(room).emit('updateBoard', roomState);
            } else {
                socket.emit('invalidMove', { message: 'Invalid move or not your turn' });
            }
        });

        socket.on('getPossibleMoves', ({ piece, position }) => {
            const possibleMoves = calculatePossibleMoves(piece, position, roomState, socket.id);
            // console.log("possible ", possibleMoves);
            socket.emit('possibleMoves', possibleMoves);
        });

        socket.on('disconnect', () => {
            console.log(`${name} disconnected from room ${room}`);
            if (roomState.players.white && roomState.players.white.id === socket.id) {
                delete roomState.players.white;
            } else if (roomState.players.black && roomState.players.black.id === socket.id) {
                delete roomState.players.black;
            }

            // If both players are disconnected, you may want to clear the room state
            if (!roomState.players.white && !roomState.players.black) {
                delete gameState.rooms[room];
            }
        });
    });
});
function calculatePossibleMoves(piece, from, gameState,id) {
    let board=gameState.board
    const moves = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const to = { row, col };

            if (isValidMove({ from, to }, { ...gameState, board }, id)) {
                moves.push(to);
            }
        }
    }
    return moves;
}
function isValidMove(move, gameState, playerId) {
    const { from, to } = move;
    const piece = gameState.board[from.row][from.col];
    
    if (!piece || piece.color !== gameState.turn) {
        // console.log("1f")
        return false;
    }
    if (gameState.turn === 'white' && gameState.players.white.id !== playerId) {
        //  console.log("2f") ;
         return false;
        }
    if (gameState.turn === 'black' && gameState.players.black.id !== playerId){  return false;}

    const target = gameState.board[to.row][to.col];
    if (target && target.color === piece.color) { return false;}

    switch (piece.type) {
        case 'pawn':
            return isValidPawnMove(from, to, piece.color, gameState.board);
        case 'rook':
            return isValidRookMove(from, to, gameState.board);
        case 'knight':
            return isValidKnightMove(from, to);
        case 'bishop':
            return isValidBishopMove(from, to, gameState.board);
        case 'queen':
            return isValidQueenMove(from, to, gameState.board);
        case 'king':
            return isValidKingMove(from, to, gameState.board);
        default:
            return false;
    }
}

function isValidPawnMove(from, to, color, board) {
    const direction = color === 'white' ? 1 : -1;
    const startRow = color === 'white' ? 1 : 6;

    if (to.row === from.row + direction && to.col === from.col && !board[to.row][to.col]) {
        return true;
    }

    if (from.row === startRow && to.row === from.row + 2 * direction && to.col === from.col && !board[to.row][to.col] && !board[from.row + direction][from.col]) {
        return true;
    }

    if (to.row === from.row + direction && Math.abs(to.col - from.col) === 1 && board[to.row][to.col] && board[to.row][to.col].color !== color) {
        return true;
    }
    // console.log("5f")
    return false;
}

function isValidRookMove(from, to, board) {
    if (from.row !== to.row && from.col !== to.col) return false;
    
    if (from.row === to.row) {
        const [start, end] = from.col < to.col ? [from.col, to.col] : [to.col, from.col];
        for (let i = start + 1; i < end; i++) {
            if (board[from.row][i]) return false;
        }
    } else {
        const [start, end] = from.row < to.row ? [from.row, to.row] : [to.row, from.row];
        for (let i = start + 1; i < end; i++) {
            if (board[i][from.col]) return false;
        }
    }
    
    return true;
}

function isValidKnightMove(from, to) {
    const rowDiff = Math.abs(from.row - to.row);
    const colDiff = Math.abs(from.col - to.col);
    return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
}

function isValidBishopMove(from, to, board) {
    const rowDiff = Math.abs(from.row - to.row);
    const colDiff = Math.abs(from.col - to.col);
    if (rowDiff !== colDiff) return false;
    
    const rowStep = from.row < to.row ? 1 : -1;
    const colStep = from.col < to.col ? 1 : -1;
    
    for (let i = 1; i < rowDiff; i++) {
        if (board[from.row + i * rowStep][from.col + i * colStep]) return false;
    }
    
    return true;
}

function isValidQueenMove(from, to, board) {
    return isValidRookMove(from, to, board) || isValidBishopMove(from, to, board);
}

function isValidKingMove(from, to, board) {
    const rowDiff = Math.abs(from.row - to.row);
    const colDiff = Math.abs(from.col - to.col);
    return rowDiff <= 1 && colDiff <= 1;
}


function updateGameState(gameState, move) {
    const { from, to } = move;
    const piece = gameState.board[from.row][from.col];
    const capturedPiece = gameState.board[to.row][to.col];

    gameState.board[to.row][to.col] = piece;
    gameState.board[from.row][from.col] = null;
    gameState.turn = gameState.turn === 'white' ? 'black' : 'white';

    if (capturedPiece && capturedPiece.type === 'king') {
        gameState.winner = piece.color;
        io.emit('gameOver', { winner: piece.color });
    }

    return gameState;
}

let PORT=3001;
server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});





