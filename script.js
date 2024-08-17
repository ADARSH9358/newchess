const socket = io();
let board = [];
let playerColor = null;
let selectedPiece = null;
let possibleMoves = [];
let gameState = {
    board: [],
    turn: 'white',
    winner: null
};
let userName;
let userRoom;
let localStream;
let peerConnection;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const callButton = document.getElementById('callButton');

const config = {
    iceServers: [
        {
            urls: "turn:relay1.expressturn.com:3478",
            username: "efD08GKZ1QV5X7KPMN",
            credential: "2vS3rl5sPO0tp3P9",
        }
    ]
};

callButton.addEventListener('click', startCall);


socket.on('connect', () => {
    console.log('Connected to server');
});

// Handle the login form submission (only on the login page)
function handleLogin(event) {
    event.preventDefault();
    
    userName = document.getElementById("name").value;
    userRoom = document.getElementById("email").value;

    if (userName) {
        // Store user data in localStorage
        localStorage.setItem("userName", userName);
        localStorage.setItem("userRoom", userRoom);
        document.querySelector(".player-name").innerText=`You : ${userName}`;

        const loginSection = document.getElementById('loginSection');
        const gameSection = document.getElementById('gameSection');
        if (loginSection && gameSection) {
            // Hide login section and show game section
            loginSection.style.display = 'none';
            gameSection.style.display = 'block';

            // Emit the joinRoom event
            socket.emit('joinRoom', { name: userName, room: userRoom });
        } else {
            console.error("Login or game section not found");
        }
    } else {
        console.error("Please enter a name");
    }

    return false; // Prevent default form submission behavior
}
socket.on('playerColor', (color) => {
    playerColor = color;
    // if (color === "white") {
    //     document.getElementById("whosTurn").innerHTML = `<div>It is ${userName}'s turn</div>`;
    // }
    // console.log('You are playing as', color);
});


// web rtc


callButton.addEventListener('click', startCall);
// hangUpButton.addEventListener('click', hangUp);

async function startCall() {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true,video: true });
    localVideo.style.display = "block"; 
    localVideo.srcObject = localStream;
    // localVideo.style.display = "none"; 
    peerConnection = new RTCPeerConnection(config);
    peerConnection.addStream(localStream);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', event.candidate);
        }
    };

    peerConnection.onaddstream = (event) => {
        // const remoteAudio = new Audio();
        // remoteAudio.srcObject = event.stream;
        // remoteAudio.play();
        remoteVideo.style.display = 'block';
        remoteVideo.srcObject = event.stream;
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);
}

socket.on('offer', async (offer) => {
    if (!peerConnection) {
        startCall();
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('candidate', (candidate) => {
    const iceCandidate = new RTCIceCandidate(candidate);
    peerConnection.addIceCandidate(iceCandidate);
});

function hangUp() {
    peerConnection.close();
    localStream.getTracks().forEach(track => track.stop());
    peerConnection = null;
}


socket.on('initGame', (gameState) => {
    board = gameState.board;
    renderBoard(board);

});
// io.to(roomState.players.white.id).emit('opponentName', roomState.players.black.name);
// 

socket.on("roomFull",(mess)=>{
    alert(mess);
    return ;
})
socket.on('updateBoard', (gameState) => {
    board = gameState.board;
    // let turnDiv=  document.querySelector('#turn')
    // document.getElementById("whosTurn").style.display = "block"
    let color=gameState.turn;
    console.log(color);
    let ans=gameState.players[color].name;
    console.log(ans);
    // document.getElementById("whosTurn").innerHTML=`<div>It is ${ans} turn</div>`;
    
    possibleMoves = [];
    renderBoard(board);
  
});

socket.on('invalidMove', (data) => {
    alert(data.message);
});
socket.on('gameOver', (data) => {
    gameState.winner = data.winner;
    if(data.winner === userName){
        window.location.href = 'gamewinner.html';
    }
    else{
        window.location.href = 'looser.html';
    }
   
    // document.querySelector('.win').innerHTML=`<h1>the winner is ${data.winner}</h1>`;
  });


  socket.on('opponentName', (opponentName) => {

    document.querySelector("#Opponent").innerText=`Opponent : ${opponentName}`;
    // window.location.href = 'chess.html';

    // opponentDiv.classList.add('opponenthighlight');
});

function renderBoard(board) {
    const chessboard = document.querySelector('.chessboard');
    chessboard.innerHTML = ''; // Clear the chessboard before rendering

    if (playerColor === 'white') {
        chessboard.classList.add('rotate-board');
    } else {
        chessboard.classList.remove('rotate-board');
    }


    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            // Create a new div for each cell
            const cell = document.createElement('div');
            cell.id = `${col + 1}_${8 - row}`;
            // cell.className = `gamecell piece ${(row + col) % 2 === 0 ? 'white' : 'grey'}`;
            cell.className = `gamecell ${(row + col) % 2 === 0 ? 'white' : 'grey'}`;

            if (board[row][col]) {
                // Add piece to the cell
                cell.innerHTML = `<span class="${board[row][col].type}">${getPieceSymbol(board[row][col])}</span>`;
                if (!gameState.winner) {
                    if (board[row][col].color === playerColor) {
                        cell.addEventListener('click', () => selectPiece(row, col));
                    } else {
                        cell.addEventListener('click', () => movePiece(row, col));
                    }
                }
            } else {
                // Add click event for empty cell if the game is not over
                if (!gameState.winner) {
                    cell.addEventListener('click', () => movePiece(row, col));
                }
            }

            // Highlight possible moves
            if (possibleMoves.some(move => move.row === row && move.col === col)) {
                cell.classList.add('highlight');
            }

            // Append the cell to the chessboard
            chessboard.appendChild(cell);
        }
    }
}



function getPieceSymbol(piece) {
    switch (piece.type) {
        case 'pawn': return piece.color === 'white' ? '♙' : '♟';
        case 'rook': return piece.color === 'white' ? '♖' : '♜';
        case 'knight': return piece.color === 'white' ? '♘' : '♞';
        case 'bishop': return piece.color === 'white' ? '♗' : '♝';
        case 'queen': return piece.color === 'white' ? '♕' : '♛';
        case 'king': return piece.color === 'white' ? '♔' : '♚';
        default: return '';
    }
}

function selectPiece(row, col) {
    selectedPiece = { row, col };
    const piece = board[row][col];
    if (piece && piece.color === playerColor) {
        console.log(piece);
        console.log(row,col);
        socket.emit('getPossibleMoves', { piece, position: selectedPiece });
    }
}
// to highlight it
socket.on('possibleMoves', (moves) => {
    possibleMoves = moves;
    renderBoard(board);
});

function movePiece(row, col) {
    if (selectedPiece) {
        const move = {
            from: selectedPiece,
            to: { row, col }
        };
        socket.emit('movePiece', move);
        selectedPiece = null;
        possibleMoves = [];
    }
}