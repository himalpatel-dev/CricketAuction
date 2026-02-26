# Cricket Auction Backend

This is the backend for the Hybrid Cricket Player Auction Platform.

## Tech Stack
- **Node.js**: Runtime environment
- **Express**: Web framework
- **Sequelize (PostgreSQL)**: ORM for database
- **Socket.io**: Real-time communication
- **JWT**: Authentication

## Setup

1.  **Install Dependencies**:
    ```bash
    cd backend
    npm install
    ```

2.  **Database Configuration**:
    - Ensure PostgreSQL is running.
    - Create a database named `cricket_auction_db`.
    - Update `.env` with your DB credentials.

3.  **Run Server**:
    ```bash
    npm run dev
    ```

## API Endpoints

### Auth
- `POST /api/auth/register`: Register a new user (Admin/Team).
- `POST /api/auth/login`: Login user.

### Auction
- `GET /api/auction/state`: Get current auction state.
- `POST /api/auction/start-player`: (Admin) Start auction for a player.
- `POST /api/auction/place-bid`: (Admin) Place a bid for a team.
- `POST /api/auction/sell-player`: (Admin) Sell player to a team.

## Socket Events
- `connection`: Client connected.
- `auction_update`: Broadcasts updates (New Bid, Player Sold, Player Start).

## Models
- **User**: Admin/Team accounts.
- **Team**: Team details and budget.
- **Player**: Player stats and status.
- **Bid**: Bid history.
