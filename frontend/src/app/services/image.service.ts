import { Injectable } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { API_CONFIG } from '../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  constructor(private sanitizer: DomSanitizer) {}

  getPlayerImageUrl(imagePath: string | null | undefined): string | SafeUrl | null {
    if (!imagePath) return null;

    // Handle Base64 or Blob URLs
    if (imagePath.startsWith('data:') || imagePath.startsWith('blob:')) {
      return this.sanitizer.bypassSecurityTrustUrl(imagePath);
    }

    // Handle filenames by prefixing with server URL
    if (imagePath.includes('/') || imagePath.includes('\\') || imagePath.includes('.')) {
      return `${API_CONFIG.baseUrl}${API_CONFIG.playerImagePath}${imagePath}`;
    }

    return imagePath;
  }

  getTeamImageUrl(imagePath: string | null | undefined): string | SafeUrl | null {
    if (!imagePath) return '/assets/images/default-team.png';

    if (imagePath.startsWith('data:') || imagePath.startsWith('http')) {
      return imagePath;
    }

    return `${API_CONFIG.baseUrl}${API_CONFIG.teamImagePath}${imagePath}`;
  }

  async blobUrlToBase64(blobUrl: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
