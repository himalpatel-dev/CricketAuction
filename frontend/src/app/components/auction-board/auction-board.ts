import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuctionService } from '../../services/auction.service';
import { SocketService } from '../../services/socket.service';
import { TournamentService } from '../../services/tournament.service';
import { AuthService } from '../../services/auth.service';
import { ImageService } from '../../services/image.service';
import { ToastService } from '../../services/toast.service';
import { ThemeService } from '../../services/theme.service';

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
  // Public spectator mode (/live/:id) — no login, no controls
  isViewer = false;
  liveLinkCopied = false;
  currentUserId: string | null = null;
  userTeamId: number | null = null;
  teamPlayers: any[] = [];
  private initialAutoStartDone = false;

  // Countdown timer properties
  secondsRemaining: number | null = null;
  timerInterval: any = null;
  isPaused = false;

  // SOLD / UNSOLD result shown until the server calls the next player (~5s)
  resultInfo: { team: any; amount: number } | null = null;
  private resultFallbackTimeout: any = null;

  // Bumped on every new bid so the current-bid card re-renders and pulses
  bidPulseKey = 0;

  // Top announcement bar shown for ~3s on every new bid
  bidAlert: { key: number; team: any; amount: number; raise: string } | null = null;
  private bidAlertTimeout: any = null;

  constructor(
    private route: ActivatedRoute,
    private auctionService: AuctionService,
    public socketService: SocketService,
    private tournamentService: TournamentService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private imageService: ImageService,
    private toast: ToastService,
    public theme: ThemeService
  ) { }

  getPlayerImageUrl(imagePath: string | null | undefined): any {
    return this.imageService.getPlayerImageUrl(imagePath);
  }

  getTeamLogoUrl(logoPath: string | null | undefined): any {
    return this.imageService.getTeamImageUrl(logoPath);
  }

  /** Stable, distinct colour per team for its badge in the live bids feed. */
  teamColor(code: string | null | undefined): string {
    let hue = 0;
    for (const ch of code || '') hue = (hue * 31 + ch.charCodeAt(0)) % 360;
    return `hsl(${hue}, 62%, 40%)`;
  }

  /** How much bid #i raised over the previous bid (history is newest first). */
  bidStep(i: number): string {
    const bid = this.history[i];
    const prev = this.history[i + 1];
    if (!bid) return '';
    if (prev) return `+₹${this.formatPrice(bid.amount - prev.amount)}`;
    if (bid.amount === this.auctionState?.currentPlayer?.basePrice) return 'BASE PRICE';
    return '';
  }

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
    this.isViewer = !!this.route.snapshot.data['viewer'];

    // Public viewer link: always read-only, regardless of who (if anyone) is logged in
    if (this.isViewer) {
      this.isAdmin = false;
      this.userTeamId = null;
      this.auctionMode = 'normal';
      if (this.tournamentId) {
        this.setupSocket();
        await this.loadInitialData();
      }
      return;
    }

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
      this.tournament = await this.fetchTournament();

      const state: any = await this.auctionService.getAuctionState(this.tournamentId);

      // Strict Check: If we are in Unsold mode, only show player if they were originally UNSOLD
      // or if they are already IN_AUCTION.
      // But if they are still UPCOMING, and we are in unsold mode, hide them.
      let validPlayer = state.player;
      // Viewers don't know which round the admin is running, so they always see the current player.
      if (!this.isViewer) {
        if (this.auctionMode === 'unsold' && state.player && state.player.status === 'UPCOMING') {
          validPlayer = null;
        }
        // Conversely, if we are in normal mode and the player is UNSOLD (re-auction), hide them.
        if (this.auctionMode === 'normal' && state.player && state.player.status === 'UNSOLD') {
          validPlayer = null;
        }
      }

      this.isPaused = !!state.isPaused;
      this.clearResult();

      this.auctionState = {
        currentPlayer: validPlayer,
        currentBid: state.currentBid,
        leadingTeam: state.highestBidderTeam,
        status: validPlayer ? 'BIDDING' : 'IDLE'
      };

      if (validPlayer && state.secondsRemaining !== null && state.secondsRemaining > 0) {
        this.startClientTimer(state.secondsRemaining);
      } else {
        this.clearClientTimer();
      }

      if (state.bids) {
        this.history = state.bids.map((b: any) => ({
          id: b.id,
          teamCode: b.team?.code,
          teamName: b.team?.name,
          logoUrl: b.team?.logoUrl,
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

      // Fetch team players if user is a team owner
      if (this.userTeamId) {
        try {
          this.teamPlayers = await this.tournamentService.getTeamPlayers(this.userTeamId);
        } catch (err) {
          console.error('Error fetching team players:', err);
        }
      }

      this.cdr.detectChanges();
    }
  }

  private async fetchTournament() {
    const tournament = await this.tournamentService.getById(this.tournamentId!);
    // Sort teams alphabetically by name
    if (tournament?.teams) {
      tournament.teams.sort((a: any, b: any) => a.name.localeCompare(b.name));
    }
    return tournament;
  }

  // Update purses / squads in the background without touching what's on the board
  private async refreshTournamentData() {
    if (!this.tournamentId) return;
    try {
      this.tournament = await this.fetchTournament();
      if (this.userTeamId) {
        this.teamPlayers = await this.tournamentService.getTeamPlayers(this.userTeamId);
      }
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Error refreshing tournament data:', err);
    }
  }

  /** Show SOLD (with buying team + price) or UNSOLD until the server calls the next player. */
  private showResult(status: 'SOLD' | 'UNSOLD', team: any = null, amount = 0) {
    this.isPaused = false;
    this.auctionState.status = status;
    this.resultInfo = { team, amount };
    this.bidAlert = null;
    this.clearClientTimer();
    this.refreshTournamentData();

    // Server auto-calls the next player 5s after a result. If nothing arrives
    // (e.g. pool finished), resync so the board doesn't stay stuck on the result.
    clearTimeout(this.resultFallbackTimeout);
    this.resultFallbackTimeout = setTimeout(() => this.loadInitialData(false), 6500);
    this.cdr.detectChanges();
  }

  private announceBid(team: any, amount: number, raise: number) {
    this.bidAlert = {
      key: Date.now(),
      team,
      amount,
      raise: raise > 0 ? `+₹${this.formatPrice(raise)}` : 'OPENING BID'
    };
    clearTimeout(this.bidAlertTimeout);
    this.bidAlertTimeout = setTimeout(() => {
      this.bidAlert = null;
      this.cdr.detectChanges();
    }, 3200);
  }

  private clearResult() {
    clearTimeout(this.resultFallbackTimeout);
    this.resultFallbackTimeout = null;
    this.resultInfo = null;
  }

  setupSocket() {
    if (!this.tournamentId) return;

    this.socketService.connectToTournament(this.tournamentId, this.isAdmin);

    this.socketService.on('auction_started', (data: any) => {
      console.log('Auction Started:', data);
      this.clearResult();
      this.isPaused = false;
      this.auctionState = {
        currentPlayer: data.player,
        currentBid: data.player.basePrice,
        leadingTeam: null,
        status: 'BIDDING'
      };
      this.history = [];
      this.startClientTimer(30);
      this.cdr.detectChanges();
    });

    this.socketService.on('new_bid', (data: any) => {
      console.log('New Bid:', data);
      this.isPaused = false;
      const previousBid = this.history[0];
      this.announceBid(data.team, data.amount, previousBid ? data.amount - previousBid.amount : 0);
      this.auctionState.currentBid = data.amount;
      this.auctionState.leadingTeam = data.team;
      this.history.unshift({
        id: data.bid?.id ?? Date.now(),
        teamCode: data.team.code,
        teamName: data.team.name,
        logoUrl: data.team.logoUrl,
        amount: data.amount,
        time: new Date()
      });
      this.bidPulseKey++;
      // Reset client timer to exactly 30 seconds on a new bid
      this.startClientTimer(30);
      this.cdr.detectChanges();
    });

    this.socketService.on('player_sold', (data: any) => {
      console.log('Sold:', data);
      this.showResult('SOLD', data.team, data.amount);
    });

    this.socketService.on('player_unsold', (data: any) => {
      console.log('Unsold:', data);
      this.showResult('UNSOLD');
    });

    this.socketService.on('timer_tick', (data: any) => {
      if (data.secondsRemaining !== undefined && this.auctionState.status === 'BIDDING') {
        this.secondsRemaining = data.secondsRemaining;
        this.isPaused = !!data.isPaused;
        if (this.isPaused) {
          this.clearClientTimerIntervalOnly();
        } else if (!this.timerInterval && this.secondsRemaining !== null) {
          this.startClientTimer(this.secondsRemaining);
        }
        this.cdr.detectChanges();
      }
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
    const remainingSlots = this.getRemainingSlots(teamId);
    if (remainingSlots <= 0) {
      this.toast.warning(`This team has already completed its squad! Cannot bid.`);
      return;
    }

    const maxAllowed = this.getMaxAllowedBid(teamId);
    if (nextBid > maxAllowed) {
      this.toast.warning(`Bid exceeds maximum allowed bid for this team. \nMax Allowed: ₹${this.formatPrice(maxAllowed)} \n(Reserved for squad completion)`);
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
      this.toast.error('Bid failed: ' + (err.error?.message || 'Connection error'));
    }
  }

  async sellPlayer() {
    if (!this.tournamentId || !this.auctionState?.currentPlayer) return;
    try {
      await this.auctionService.sellPlayer(this.tournamentId, this.auctionState.currentPlayer.id);

      // Optimistic Update (socket 'player_sold' shows the same result)
      this.showResult('SOLD', this.auctionState.leadingTeam, this.auctionState.currentBid);

    } catch (err: any) {
      console.error('Sell failed:', err);
    }
  }

  async markUnsold() {
    if (!this.tournamentId || !this.auctionState?.currentPlayer) return;
    try {
      await this.auctionService.markUnsold(this.tournamentId, this.auctionState.currentPlayer.id);

      // Optimistic Update (socket 'player_unsold' shows the same result)
      this.showResult('UNSOLD');

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

    const remainingSlots = this.getRemainingSlots(teamId);
    if (remainingSlots <= 0) return 0;

    // RemainingSlots * MinimumPlayerBasePrice is our reserve amount
    // But one slot is the one we are bidding for right now!
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

  startClientTimer(seconds: number) {
    this.clearClientTimerIntervalOnly();
    this.secondsRemaining = seconds;
    if (!this.isPaused) {
      this.timerInterval = setInterval(() => {
        if (this.secondsRemaining !== null && this.secondsRemaining > 0) {
          this.secondsRemaining--;
          this.cdr.detectChanges();
        } else {
          this.clearClientTimer();
        }
      }, 1000);
    }
  }

  clearClientTimer() {
    this.clearClientTimerIntervalOnly();
    this.secondsRemaining = null;
    this.cdr.detectChanges();
  }

  clearClientTimerIntervalOnly() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ---- Pause the auction the moment the admin leaves the board ----
  // In-app navigation already disconnects in ngOnDestroy. These cover everything else:
  // closing the tab, browser/phone back out of the site, refresh, switching apps / tabs,
  // or locking the phone. Without them the server only notices via heartbeat timeout.

  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      this.leaveBoardAsAdmin();
    } else {
      this.returnToBoard();
    }
  }

  @HostListener('window:pagehide')
  onPageHide() {
    this.leaveBoardAsAdmin();
  }

  @HostListener('window:pageshow', ['$event'])
  onPageShow(event: PageTransitionEvent) {
    // Page restored from the browser's back/forward cache
    if (event.persisted) this.returnToBoard();
  }

  private leaveBoardAsAdmin() {
    if (!this.isAdmin || !this.tournamentId || !this.socketService.hasSocket) return;
    this.auctionService.notifyAdminLeft(this.tournamentId, this.socketService.socketId);
    this.socketService.disconnect();
    this.clearClientTimerIntervalOnly();
  }

  private returnToBoard() {
    if (!this.tournamentId) return;
    // Admin: rejoin as admin (server resumes the timer). Viewers/teams: just refresh state,
    // since events may have been missed while the page was in the background.
    if (!this.socketService.hasSocket) {
      this.setupSocket();
    }
    this.loadInitialData(false);
  }

  get liveViewUrl(): string {
    return `${window.location.origin}/live/${this.tournamentId}`;
  }

  copyLiveLink() {
    navigator.clipboard.writeText(this.liveViewUrl).then(() => {
      this.liveLinkCopied = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.liveLinkCopied = false;
        this.cdr.detectChanges();
      }, 2000);
    }).catch(err => {
      console.error('Could not copy live link:', err);
      prompt('Copy this live auction link:', this.liveViewUrl);
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.clearClientTimer();
    clearTimeout(this.resultFallbackTimeout);
    clearTimeout(this.bidAlertTimeout);
    this.socketService.disconnect();
  }
}
