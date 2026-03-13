import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-team-card',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './team-card.component.html',
    styleUrls: ['./team-card.component.css']
})
export class TeamCardComponent {
    @Input() team: any;
    @Output() edit = new EventEmitter<any>();

    onEdit() {
        this.edit.emit(this.team);
    }

    formatPrice(amount: number) {
        if (!amount) return '0';
        if (amount >= 10000000) return (amount / 10000000).toFixed(2) + 'Cr';
        if (amount >= 100000) return (amount / 100000).toFixed(0) + 'L';
        return amount.toLocaleString();
    }
}
