import { Component } from '@angular/core';
import { ToastService, ToastType } from '../../services/toast.service';

@Component({
    selector: 'app-toast-container',
    standalone: true,
    templateUrl: './toast-container.html',
    styleUrls: ['./toast-container.css']
})
export class ToastContainerComponent {
    readonly icons: Record<ToastType, string> = {
        success: '✓',
        error: '✕',
        warning: '!',
        info: 'i'
    };

    readonly titles: Record<ToastType, string> = {
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Info'
    };

    constructor(public toastService: ToastService) { }
}
