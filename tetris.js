class Tetris {
    constructor(difficulty = 'medium', username = 'Player') {
        this.canvas = document.getElementById('tetris');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById('nextPiece');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        this.BLOCK_SIZE = 30;
        this.BOARD_WIDTH = 10;
        this.BOARD_HEIGHT = 20;
        
        // Set initial speed based on difficulty
        this.difficulty = difficulty;
        switch (difficulty) {
            case 'easy':
                this.initialDropInterval = 650;
                this.levelSpeedMultiplier = 1.0;
                break;
            case 'hard':
                this.initialDropInterval = 350;
                this.levelSpeedMultiplier = 1.5;
                break;
            default: // medium
                this.initialDropInterval = 500;
                this.levelSpeedMultiplier = 1.2;
        }
        
        this.board = Array(this.BOARD_HEIGHT).fill().map(() => Array(this.BOARD_WIDTH).fill(0));
        this.score = 0;
        this.level = 1;
        this.gameOver = false;
        this.dropCounter = 0;
        this.dropInterval = this.initialDropInterval;
        this.lastTime = 0;
        
        this.colors = [
            null,
            '#FF0D72', // I
            '#0DC2FF', // J
            '#0DFF72', // L
            '#F538FF', // O
            '#FF8E0D', // S
            '#FFE138', // T
            '#3877FF'  // Z
        ];

        this.pieces = [
            [[1, 1, 1, 1]], // I
            [[2, 0, 0], [2, 2, 2]], // J
            [[0, 0, 3], [3, 3, 3]], // L
            [[4, 4], [4, 4]], // O
            [[0, 5, 5], [5, 5, 0]], // S
            [[0, 6, 0], [6, 6, 6]], // T
            [[7, 7, 0], [0, 7, 7]]  // Z
        ];

        this.currentPiece = null;
        this.currentPos = { x: 0, y: 0 };
        this.nextPiece = this.createPiece();
        
        this.animations = [];
        this.ghostPieceY = 0;
        
        this.initializeControls();
        this.initializeMobileControls();
        this.resetGame();
        this.update();
    }

    createPiece() {
        const piece = this.pieces[Math.floor(Math.random() * this.pieces.length)];
        return {
            matrix: piece,
            pos: {
                x: Math.floor(this.BOARD_WIDTH / 2) - Math.floor(piece[0].length / 2),
                y: 0
            }
        };
    }

    rotateMatrix(matrix) {
        // Create a new matrix with swapped dimensions
        const N = matrix.length;
        const M = matrix[0].length;
        const rotated = Array(M).fill().map(() => Array(N).fill(0));
        
        // Perform the rotation
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < M; x++) {
                rotated[x][N - 1 - y] = matrix[y][x];
            }
        }
        return rotated;
    }

    collide(piece, pos) {
        for (let y = 0; y < piece.matrix.length; y++) {
            for (let x = 0; x < piece.matrix[y].length; x++) {
                if (piece.matrix[y][x] !== 0 &&
                    (this.board[y + pos.y] &&
                    this.board[y + pos.y][x + pos.x]) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    merge(piece) {
        piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.board[y + piece.pos.y][x + piece.pos.x] = value;
                }
            });
        });
    }

    clearLines() {
        let linesCleared = 0;
        outer: for (let y = this.board.length - 1; y >= 0; y--) {
            for (let x = 0; x < this.board[y].length; x++) {
                if (this.board[y][x] === 0) {
                    continue outer;
                }
            }

            const row = this.board.splice(y, 1)[0];
            this.board.unshift(row.fill(0));
            y++;
            linesCleared++;

            // Add clear line animation
            this.animations.push({
                type: 'clearLine',
                y: y,
                alpha: 1,
                duration: 500
            });
        }

        if (linesCleared > 0) {
            this.updateScore(linesCleared);
        }
    }

    updateScore(lines) {
        const points = [40, 100, 300, 1200];
        this.score += points[lines - 1] * this.level;
        document.getElementById('score').textContent = this.score;
        document.getElementById('score').classList.add('score-animation');
        setTimeout(() => {
            document.getElementById('score').classList.remove('score-animation');
        }, 300);

        this.level = Math.floor(this.score / 1000) + 1;
        document.getElementById('level').textContent = this.level;
        this.dropInterval = this.initialDropInterval - (this.level - 1) * 70 * this.levelSpeedMultiplier;
        this.dropInterval = Math.max(this.dropInterval, 100);
    }

    drawBoard() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.board.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.ctx.fillStyle = this.colors[value];
                    this.ctx.fillRect(
                        x * this.BLOCK_SIZE,
                        y * this.BLOCK_SIZE,
                        this.BLOCK_SIZE - 1,
                        this.BLOCK_SIZE - 1
                    );
                }
            });
        });
    }

    drawPiece(piece, offset, context = this.ctx, blockSize = this.BLOCK_SIZE) {
        piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    context.fillStyle = this.colors[value];
                    context.fillRect(
                        (x + offset.x) * blockSize,
                        (y + offset.y) * blockSize,
                        blockSize - 1,
                        blockSize - 1
                    );
                }
            });
        });
    }

    drawGhostPiece() {
        const ghost = {
            matrix: this.currentPiece.matrix,
            pos: { ...this.currentPiece.pos }
        };

        while (!this.collide(ghost, { x: ghost.pos.x, y: ghost.pos.y + 1 })) {
            ghost.pos.y++;
        }

        this.ctx.globalAlpha = 0.2;
        this.drawPiece(ghost, ghost.pos);
        this.ctx.globalAlpha = 1;
    }

    drawNextPiece() {
        this.nextCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        const blockSize = 25;
        const offset = {
            x: (this.nextCanvas.width / blockSize - this.nextPiece.matrix[0].length) / 2,
            y: (this.nextCanvas.height / blockSize - this.nextPiece.matrix.length) / 2
        };
        
        this.drawPiece(this.nextPiece, offset, this.nextCtx, blockSize);
    }

    drawAnimations(deltaTime) {
        this.animations = this.animations.filter(anim => {
            if (anim.type === 'clearLine') {
                this.ctx.fillStyle = `rgba(255, 255, 255, ${anim.alpha})`;
                this.ctx.fillRect(
                    0,
                    anim.y * this.BLOCK_SIZE,
                    this.canvas.width,
                    this.BLOCK_SIZE
                );
                anim.alpha -= deltaTime / anim.duration;
                return anim.alpha > 0;
            }
            return false;
        });
    }

    update(time = 0) {
        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        this.dropCounter += deltaTime;

        if (this.dropCounter > this.dropInterval) {
            this.drop();
        }

        this.drawBoard();
        this.drawGhostPiece();
        this.drawPiece(this.currentPiece, this.currentPiece.pos);
        this.drawNextPiece();
        this.drawAnimations(deltaTime);

        if (!this.gameOver) {
            requestAnimationFrame(this.update.bind(this));
        } else {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '30px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Game Over!', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.font = '20px Arial';
            this.ctx.fillText('Press R to restart', this.canvas.width / 2, this.canvas.height / 2 + 40);
        }
    }

    drop() {
        this.currentPiece.pos.y++;
        if (this.collide(this.currentPiece, this.currentPiece.pos)) {
            this.currentPiece.pos.y--;
            this.merge(this.currentPiece);
            this.clearLines();
            this.resetPiece();
            this.dropCounter = 0;
        }
        this.dropCounter = 0;
    }

    hardDrop() {
        while (!this.collide(this.currentPiece, { x: this.currentPiece.pos.x, y: this.currentPiece.pos.y + 1 })) {
            this.currentPiece.pos.y++;
        }
        this.drop();
    }

    move(dir) {
        this.currentPiece.pos.x += dir;
        if (this.collide(this.currentPiece, this.currentPiece.pos)) {
            this.currentPiece.pos.x -= dir;
        }
    }

    rotatePiece() {
        // Skip rotation for O piece (square)
        if (this.currentPiece.matrix.length === 2 && this.currentPiece.matrix[0].length === 2) {
            return;
        }

        const originalMatrix = this.currentPiece.matrix;
        const originalX = this.currentPiece.pos.x;
        const originalY = this.currentPiece.pos.y;
        
        // Try normal rotation first
        const rotated = this.rotateMatrix(this.currentPiece.matrix);
        this.currentPiece.matrix = rotated;
        
        // Wall kick positions to try (x offset)
        const kicks = [0, 1, -1, 2, -2];
        
        let validRotationFound = false;
        
        for (let kick of kicks) {
            this.currentPiece.pos.x = originalX + kick;
            
            if (!this.collide(this.currentPiece, this.currentPiece.pos)) {
                validRotationFound = true;
                break;
            }
        }
        
        if (!validRotationFound) {
            // If no valid position found, revert the rotation
            this.currentPiece.matrix = originalMatrix;
            this.currentPiece.pos.x = originalX;
            this.currentPiece.pos.y = originalY;
        }
    }

    resetPiece() {
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.createPiece();
        
        if (this.collide(this.currentPiece, this.currentPiece.pos)) {
            this.gameOver = true;
        }
    }

    resetGame() {
        this.board = Array(this.BOARD_HEIGHT).fill().map(() => Array(this.BOARD_WIDTH).fill(0));
        this.score = 0;
        this.level = 1;
        this.gameOver = false;
        this.dropInterval = this.initialDropInterval;
        this.animations = [];
        document.getElementById('score').textContent = '0';
        document.getElementById('level').textContent = '1';
        this.currentPiece = this.createPiece();
        this.nextPiece = this.createPiece();
        this.update();
    }

    initializeControls() {
        document.addEventListener('keydown', event => {
            if (this.gameOver) {
                if (event.key === 'r' || event.key === 'R') {
                    this.resetGame();
                }
                return;
            }

            switch (event.key) {
                case 'ArrowLeft':
                    this.move(-1);
                    break;
                case 'ArrowRight':
                    this.move(1);
                    break;
                case 'ArrowDown':
                    this.drop();
                    break;
                case 'ArrowUp':
                    this.rotatePiece();
                    break;
                case ' ':
                    event.preventDefault();
                    this.hardDrop();
                    break;
                case 'Escape':
                    this.gameOver = true;
                    showMainMenu();
                    break;
            }
        });
    }

    gameOver() {
        this.gameOver = true;
        // Add score to high scores
        addHighScore(this.username, this.score, this.level, this.difficulty);
    }

    initializeMobileControls() {
        // Helper function to handle both touch and mouse events
        const addButtonControl = (id, action, isRepeatable = false) => {
            const button = document.getElementById(id);
            if (!button) return;

            let intervalId = null;
            const repeatDelay = 100; // Milliseconds between repeated actions

            const startAction = (e) => {
                e.preventDefault();
                if (this.gameOver) return;
                
                action.call(this);
                if (isRepeatable) {
                    intervalId = setInterval(() => action.call(this), repeatDelay);
                }
            };

            const stopAction = (e) => {
                e.preventDefault();
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
            };

            // Touch events
            button.addEventListener('touchstart', startAction, { passive: false });
            button.addEventListener('touchend', stopAction);
            button.addEventListener('touchcancel', stopAction);

            // Mouse events
            button.addEventListener('mousedown', startAction);
            button.addEventListener('mouseup', stopAction);
            button.addEventListener('mouseleave', stopAction);
        };

        // Add controls for each button
        addButtonControl('leftBtn', () => this.move(-1), true);
        addButtonControl('rightBtn', () => this.move(1), true);
        addButtonControl('downBtn', () => this.drop(), true);
        addButtonControl('rotateBtn', () => this.rotatePiece());
        addButtonControl('dropBtn', () => this.hardDrop());

        // Prevent default touch behavior to avoid scrolling while playing
        document.addEventListener('touchmove', (e) => {
            if (e.target.closest('.mobile-controls')) {
                e.preventDefault();
            }
        }, { passive: false });
    }
}

// Main menu handling
function showMainMenu() {
    document.getElementById('main-menu').style.display = 'block';
    document.getElementById('game-container').style.display = 'none';
}

// High scores handling
const HIGH_SCORES_KEY = 'tetrisHighScores';
let currentDifficulty = 'easy';
let highScores = {
    easy: [],
    medium: [],
    hard: []
};

// Load high scores from localStorage
function loadHighScores() {
    const saved = localStorage.getItem(HIGH_SCORES_KEY);
    if (saved) {
        highScores = JSON.parse(saved);
    }
    updateHighScoreTable(currentDifficulty);
}

// Save high scores to localStorage
function saveHighScores() {
    localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(highScores));
}

// Update the high score table
function updateHighScoreTable(difficulty) {
    const tbody = document.getElementById('highScoreBody');
    const scores = highScores[difficulty] || [];
    
    // Sort scores by score value
    scores.sort((a, b) => b.score - a.score);
    
    // Keep only top 10 scores
    while (scores.length > 10) {
        scores.pop();
    }
    
    // Update table
    tbody.innerHTML = scores.map((score, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${score.username}</td>
            <td>${score.score}</td>
            <td>${score.level}</td>
        </tr>
    `).join('');
}

// Add new score
function addHighScore(username, score, level, difficulty) {
    if (!highScores[difficulty]) {
        highScores[difficulty] = [];
    }
    
    highScores[difficulty].push({ username, score, level });
    highScores[difficulty].sort((a, b) => b.score - a.score);
    
    if (highScores[difficulty].length > 10) {
        highScores[difficulty].pop();
    }
    
    saveHighScores();
    updateHighScoreTable(difficulty);
}

// Initialize tab controls
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        // Update active tab
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Update table
        currentDifficulty = button.getAttribute('data-difficulty');
        updateHighScoreTable(currentDifficulty);
    });
});

// Modified startGame function
function startGame(difficulty) {
    const username = document.getElementById('username').value.trim();
    if (!username) {
        alert('Please enter a username before starting the game!');
        return;
    }
    
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    document.getElementById('currentPlayer').textContent = username;
    window.game = new Tetris(difficulty, username);
}

// Load high scores when page loads
loadHighScores();

// Initialize menu controls
document.querySelectorAll('.difficulty-btn').forEach(button => {
    button.addEventListener('click', () => {
        const difficulty = button.getAttribute('data-difficulty');
        startGame(difficulty);
    });
}); 