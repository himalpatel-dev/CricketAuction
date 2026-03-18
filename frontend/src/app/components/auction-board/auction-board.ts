import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuctionService } from '../../services/auction.service';
import { SocketService } from '../../services/socket.service';
import { TournamentService } from '../../services/tournament.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auction-board',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './auction-board.html',
  styleUrls: ['./auction-board.css']
})
export class AuctionBoardComponent implements OnInit, OnDestroy {
  tournamentId: string | null = null;
  auctionState: any = {
    currentPlayer: null,
    currentBid: 0,
    leadingTeam: null,
    status: 'IDLE'
  };
  tournament: any = null;
  history: any[] = [];
  auctionMode: 'normal' | 'unsold' = 'normal';

  loading = true;
  isAdmin = false;
  currentUserId: string | null = null;
  userTeamId: number | null = null;
  private initialAutoStartDone = false;

  constructor(
    private route: ActivatedRoute,
    private auctionService: AuctionService,
    public socketService: SocketService,
    private tournamentService: TournamentService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

  get availablePlayers() {
    const status = this.auctionMode === 'unsold' ? 'UNSOLD' : 'UPCOMING';
    return this.tournament?.players?.filter((p: any) => p.status === status) || [];
  }

  get nextBidPreview(): number {
    if (!this.auctionState?.currentPlayer) return 0;
    if (!this.auctionState.leadingTeam) {
      return this.auctionState.currentPlayer.basePrice;
    }
    return (this.auctionState.currentBid || this.auctionState.currentPlayer.basePrice) + this.currentIncrement;
  }

  backLink = '/admin';

  async ngOnInit() {
    this.tournamentId = this.route.snapshot.paramMap.get('id');
    const user = this.authService.getUser();

    // Treat TOURNAMENT_ADMIN as admin for this page
    this.isAdmin = this.authService.isAdmin() || this.authService.isTournamentAdmin();

    if (this.authService.isTournamentAdmin()) {
      if (String(user.tournamentId) !== String(this.tournamentId)) {
        this.router.navigate(['/auction', user.tournamentId]);
        return;
      }
      // Change back link for tournament admin
      this.backLink = `/tournament-detail/${user.tournamentId}`;
    }

    if (this.authService.isTeam()) {
      this.backLink = '/team-dashboard';
    }

    this.currentUserId = user?.id;
    this.userTeamId = user?.teamId || null;

    // Set auctionMode immediately from snapshot to avoid timing issues with subscription
    this.auctionMode = this.route.snapshot.queryParamMap.get('mode') === 'unsold' ? 'unsold' : 'normal';

    this.route.queryParamMap.subscribe(params => {
      this.auctionMode = params.get('mode') === 'unsold' ? 'unsold' : 'normal';
    });

    if (this.tournamentId) {
      this.setupSocket();
      await this.loadInitialData();
    }
  }

  async loadInitialData(showLoading = true) {
    if (!this.tournamentId) return;
    
    // Prevent the loading overlay from showing if we are just refreshing state
    if (showLoading) this.loading = true;

    try {
      this.tournament = await this.tournamentService.getById(this.tournamentId);
      
      // Sort teams alphabetically by name
      if (this.tournament?.teams) {
        this.tournament.teams.sort((a: any, b: any) => a.name.localeCompare(b.name));
      }

      const state: any = await this.auctionService.getAuctionState(this.tournamentId);
      
      // Strict Check: If we are in Unsold mode, only show player if they were originally UNSOLD
      // or if they are already IN_AUCTION.
      // But if they are still UPCOMING, and we are in unsold mode, hide them.
      let validPlayer = state.player;
      if (this.auctionMode === 'unsold' && state.player && state.player.status === 'UPCOMING') {
          validPlayer = null;
      }
      // Conversely, if we are in normal mode and the player is UNSOLD (re-auction), hide them.
      if (this.auctionMode === 'normal' && state.player && state.player.status === 'UNSOLD') {
          validPlayer = null;
      }

      this.auctionState = {
        currentPlayer: validPlayer,
        currentBid: state.currentBid,
        leadingTeam: state.highestBidderTeam,
        status: validPlayer ? 'BIDDING' : 'IDLE'
      };

      if (state.bids) {
        this.history = state.bids.map((b: any) => ({
          teamCode: b.team?.code,
          amount: b.amount,
          time: b.createdAt
        }));
      }
    } catch (err) {
      console.error('Error loading auction data:', err);
    } finally {
      this.loading = false;
      
      // Auto-set initial increment if needed
      if (this.currentIncrement === 0 && this.tournament) {
        this.currentIncrement = this.incrementOptions[0];
      }

      // Proactive: Auto-start first auction if board is idle and user is admin
      if (this.isAdmin && !this.auctionState.currentPlayer && !this.initialAutoStartDone) {
        this.initialAutoStartDone = true;
        if (this.availablePlayers.length > 0) {
          console.log('Auto-starting first random auction...');
          this.startRandomAuction();
        }
      }

      this.cdr.detectChanges();
    }
  }

  setupSocket() {
    if (!this.tournamentId) return;

    this.socketService.connectToTournament(this.tournamentId);

    this.socketService.on('auction_started', (data: any) => {
      console.log('Auction Started:', data);
      this.auctionState = {
        currentPlayer: data.player,
        currentBid: data.player.basePrice,
        leadingTeam: null,
        status: 'BIDDING'
      };
      this.history = [];
      this.cdr.detectChanges();
    });

    this.socketService.on('new_bid', (data: any) => {
      console.log('New Bid:', data);
      this.auctionState.currentBid = data.amount;
      this.auctionState.leadingTeam = data.team;
      this.history.unshift({
        teamCode: data.team.code,
        amount: data.amount,
        time: new Date()
      });
      this.cdr.detectChanges();
    });

    this.socketService.on('player_sold', (data: any) => {
      console.log('Sold:', data);
      this.auctionState.status = 'SOLD';
      setTimeout(() => this.loadInitialData(false), 3000); // Reload after 3s to show next (background sync)
    });

    this.socketService.on('player_unsold', (data: any) => {
      console.log('Unsold:', data);
      this.auctionState.status = 'UNSOLD';
      setTimeout(() => this.loadInitialData(false), 3000);
    });
  }

  async startRandomAuction() {
    if (!this.tournamentId) return;
    try {
      const status = this.auctionMode === 'unsold' ? 'UNSOLD' : 'UPCOMING';
      await this.auctionService.startPlayerAuction(this.tournamentId, null, status);
    } catch (err) {
      console.error('Error starting random auction:', err);
    }
  }

  async startAuction(playerId: number) {
    if (!this.tournamentId) return;
    try {
      await this.auctionService.startPlayerAuction(this.tournamentId, playerId);
    } catch (err) {
      console.error('Error starting auction:', err);
    }
  }

  // Offline Mode State
  currentIncrement = 0; // Will be set dynamically

  get incrementOptions(): number[] {
    const base = this.tournament?.minimumPlayerBasePrice || 500000;
    // Multipliers: x1, x2, x5, x10 of base price
    return [
      Math.floor(base * 1.0),
      Math.floor(base * 2.0),
      Math.floor(base * 5.0),
      Math.floor(base * 10.0)
    ];
  }


  setIncrement(amount: number) {
    this.currentIncrement = amount;
    this.cdr.detectChanges();
  }

  async placeBid(teamId: number) {
    if (!this.tournamentId || !this.auctionState?.currentPlayer) return;

    // Calculate next bid: 
    // If no bids yet, the opening bid is the base price.
    // If there is already a leader, we add the increment.
    let nextBid = 0;
    if (!this.auctionState.leadingTeam) {
      nextBid = this.auctionState.currentPlayer.basePrice;
    } else {
      nextBid = (this.auctionState.currentBid || this.auctionState.currentPlayer.basePrice) + this.currentIncrement;
    }
    const team = this.tournament.teams.find((t: any) => t.id === teamId);

    // Frontend Check
    const maxAllowed = this.getMaxAllowedBid(teamId);
    if (nextBid > maxAllowed) {
        alert(`Bid exceeds maximum allowed bid for this team. \nMax Allowed: ₹${this.formatPrice(maxAllowed)} \n(Reserved for squad completion)`);
        return;
    }

    try {
      // 1. Call API
      await this.auctionService.placeBid(this.tournamentId, this.auctionState.currentPlayer.id, nextBid, teamId);

      // 2. Optimistic Update (don't wait for socket)
      this.auctionState.currentBid = nextBid;
      this.auctionState.leadingTeam = team;
      // History will be updated by socket event to avoid duplicates
      this.cdr.detectChanges();

    } catch (err: any) {
      console.error('Bid failed:', err);
      alert('Bid failed: ' + (err.error?.message || 'Connection error'));
    }
  }

  async sellPlayer() {
    if (!this.tournamentId || !this.auctionState?.currentPlayer) return;
    try {
      await this.auctionService.sellPlayer(this.tournamentId, this.auctionState.currentPlayer.id);

      // Optimistic Update
      this.auctionState.status = 'SOLD';
      this.cdr.detectChanges();
      setTimeout(() => this.loadInitialData(false), 3000);

    } catch (err: any) {
      console.error('Sell failed:', err);
    }
  }

  async markUnsold() {
    if (!this.tournamentId || !this.auctionState?.currentPlayer) return;
    try {
      await this.auctionService.markUnsold(this.tournamentId, this.auctionState.currentPlayer.id);

      // Optimistic Update
      this.auctionState.status = 'UNSOLD';
      this.cdr.detectChanges();
      setTimeout(() => this.loadInitialData(false), 3000); // Reload to get next player

    } catch (err: any) {
      console.error('Unsold failed:', err);
    }
  }

  getTeamBudget(teamId: number): number {
    const team = this.tournament?.teams?.find((t: any) => t.id === teamId);
    return team ? team.remainingBudget : 0;
  }

  getRemainingSlots(teamId: number): number {
    const team = this.tournament?.teams?.find((t: any) => t.id === teamId);
    if (!this.tournament || !team) return 0;
    return this.tournament.playersPerTeam - (team.playersBought || 0);
  }

  getMaxAllowedBid(teamId: number): number {
    const team = this.tournament?.teams?.find((t: any) => t.id === teamId);
    if (!this.tournament || !team) return 0;
    
    // RemainingSlots * MinimumPlayerBasePrice is our reserve amount
    // But one slot is the one we are bidding for right now!
    const remainingSlots = this.getRemainingSlots(teamId);
    const reserveAmount = (remainingSlots - 1) * this.tournament.minimumPlayerBasePrice;
    
    return team.remainingBudget - reserveAmount;
  }

  formatPrice(amount: number) {
    if (!amount && amount !== 0) return '0';
    if (amount >= 10000000) {
      const cr = amount / 10000000;
      return (cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)) + 'Cr';
    }
    if (amount >= 100000) {
      const l = amount / 100000;
      return (l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)) + 'L';
    }
    if (amount >= 1000) {
      const k = amount / 1000;
      return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K';
    }
    return amount.toLocaleString('en-IN');
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.socketService.disconnect();
  }
}
