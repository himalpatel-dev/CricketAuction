import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard';
import { AddTournamentComponent } from './components/add-tournament/add-tournament';
import { TournamentDetailComponent } from './components/tournament-detail/tournament-detail';
import { AuctionBoardComponent } from './components/auction-board/auction-board';
import { SquadViewComponent } from './components/squad-view/squad-view';
import { TeamListComponent } from './components/team-list/team-list';
import { PlayerListComponent } from './components/player-list/player-list';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'admin', component: AdminDashboardComponent },
    { path: 'add-tournament', component: AddTournamentComponent },
    { path: 'tournament-detail/:id', component: TournamentDetailComponent },
    { path: 'auction/:id', component: AuctionBoardComponent },
    { path: 'squads/:id', component: SquadViewComponent },
    { path: 'teams/:id', component: TeamListComponent },
    { path: 'players/:id', component: PlayerListComponent },
    { path: 'register', loadComponent: () => import('./components/player-registration/player-registration').then(m => m.PlayerRegistrationComponent) },
    { path: 'team-dashboard', loadComponent: () => import('./components/team-dashboard/team-dashboard').then(m => m.TeamDashboardComponent) },
    { path: '**', redirectTo: 'login' }
];
