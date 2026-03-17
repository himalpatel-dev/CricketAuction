import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-player-card',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './player-card.component.html',
    styleUrls: ['./player-card.component.css']
})
export class PlayerCardComponent {
    @Input() player: any;
    @Input() index: number = 0;
    @Input() viewMode: string = 'grid'; // 'grid' or 'list'
    @Input() tournament: any;
    @Input() canEdit: boolean = false;
    @Output() onEdit = new EventEmitter<any>();

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

    getAvatarColor(name: string): string {
        const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#f97316'];
        let hash = 0;
        if (name) {
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
        }
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }

    getAge(dob: string | Date | null): number | string {
        if (!dob) return '';
        const diff_ms = Date.now() - new Date(dob).getTime();
        const age_dt = new Date(diff_ms);
        return Math.abs(age_dt.getUTCFullYear() - 1970);
    }

    getTeamName(teamId: number): string {
        if (!this.tournament || !this.tournament.teams || !teamId) return '';
        const team = this.tournament.teams.find((t: any) => t.id === teamId);
        return team ? team.name : 'Unknown Team';
    }

    getTeamCode(teamId: number): string {
        if (!this.tournament || !this.tournament.teams || !teamId) return '';
        const team = this.tournament.teams.find((t: any) => t.id === teamId);
        if (!team) return '';
        if (team.code) return team.code;
        // Fallback: take first 3 letters
        return team.name.substring(0, 3).toUpperCase();
    }

    getRoleClass(role: string): string {
        switch (role) {
            case 'Batsman': return 'role-batsman';
            case 'Bowler': return 'role-bowler';
            case 'Wicketkeeper': return 'role-wk';
            case 'All-Rounder': return 'role-ar';
            default: return 'role-default';
        }
    }

    hasAnyStats(): boolean {
        if (!this.player.stats) return false;
        const keys = Object.keys(this.player.stats);
        return keys.length > 0 && keys.some(k => this.player.stats[k] !== undefined && this.player.stats[k] !== null);
    }
}
