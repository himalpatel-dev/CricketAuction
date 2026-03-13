import { Component, Input } from '@angular/core';
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

    formatPrice(amount: number) {
        if (!amount) return '0';
        if (amount >= 10000000) return (amount / 10000000).toFixed(0).replace(/\.0$/, '') + 'Cr';
        if (amount >= 100000) return (amount / 100000).toFixed(0).replace(/\.0$/, '') + 'L';
        return amount.toLocaleString();
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

    getRoleClass(role: string): string {
        switch (role) {
            case 'Batsman': return 'text-emerald-500 bg-emerald-500/10 px-[6px] py-[2px] rounded font-black';
            case 'Bowler': return 'text-[#f43f5e] bg-[#f43f5e]/10 px-[6px] py-[2px] rounded font-black';
            case 'Wicketkeeper': return 'text-sky-500 bg-sky-500/10 px-[6px] py-[2px] rounded font-black';
            case 'All-Rounder': return 'text-amber-500 bg-amber-500/10 px-[6px] py-[2px] rounded font-black';
            default: return 'text-gray-400 bg-gray-500/10 px-[6px] py-[2px] rounded font-black';
        }
    }
}
