import {
  IShareManager,
  ScreenshotConfig,
  ScreenshotResult,
  SharePosterConfig,
  ShareData,
  InteractionEventType
} from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';
import { I18nManager } from './I18nManager';
import { isBrowser, generateId } from '../utils/helpers';

const DEFAULT_SCREENSHOT_CONFIG: Required<ScreenshotConfig> = {
  format: 'png',
  quality: 0.92,
  width: 1920,
  height: 1080,
  includeUI: true,
  watermark: ''
};

const DEFAULT_POSTER_CONFIG: Required<SharePosterConfig> = {
  title: '',
  subtitle: '',
  includeQRCode: true,
  qrCodeUrl: '',
  logoUrl: '',
  backgroundImageUrl: '',
  watermark: '',
  format: 'png',
  quality: 0.92,
  width: 750,
  height: 1334
};

export class ShareManager implements IShareManager {
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private i18n: I18nManager;
  private canvas?: HTMLCanvasElement;

  constructor(eventEmitter: EventEmitter, logger: Logger, i18n: I18nManager) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.i18n = i18n;
  }

  async takeScreenshot(config?: ScreenshotConfig): Promise<ScreenshotResult> {
    const finalConfig: Required<ScreenshotConfig> = {
      ...DEFAULT_SCREENSHOT_CONFIG,
      ...(config || {})
    };

    this.logger.log(`ShareManager: Taking screenshot (${finalConfig.width}x${finalConfig.height})`);

    const result = await this.createScreenshot(finalConfig);

    this.eventEmitter.emit(InteractionEventType.SCREENSHOT, {
      width: finalConfig.width,
      height: finalConfig.height,
      format: finalConfig.format
    });

    return result;
  }

  private async createScreenshot(config: Required<ScreenshotConfig>): Promise<ScreenshotResult> {
    if (!isBrowser()) {
      throw new Error('Screenshot is only available in browser environment');
    }

    const canvas = this.getOrCreateCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, config.width, config.height);

    const gradient = ctx.createLinearGradient(0, 0, config.width, config.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, config.width, config.height);

    if (config.watermark) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(config.watermark, 50, config.height - 100);
      ctx.restore();
    }

    const dataUrl = canvas.toDataURL(
      config.format === 'png' ? 'image/png' : 'image/jpeg',
      config.quality
    );

    const blob = await this.dataUrlToBlob(dataUrl);

    return {
      dataUrl,
      blob,
      width: config.width,
      height: config.height
    };
  }

  async generatePoster(config?: SharePosterConfig): Promise<ScreenshotResult> {
    const finalConfig: Required<SharePosterConfig> = {
      ...DEFAULT_POSTER_CONFIG,
      title: config?.title || this.i18n.t('share.poster_title'),
      subtitle: config?.subtitle || this.i18n.t('share.invite_text'),
      ...(config || {})
    };

    this.logger.log(`ShareManager: Generating poster - ${finalConfig.title}`);

    const result = await this.createPoster(finalConfig);

    this.eventEmitter.emit(InteractionEventType.SHARE, {
      type: 'poster',
      title: finalConfig.title
    });

    return result;
  }

  private async createPoster(config: Required<SharePosterConfig>): Promise<ScreenshotResult> {
    if (!isBrowser()) {
      throw new Error('Poster generation is only available in browser environment');
    }

    const canvas = this.getOrCreateCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, config.width, config.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, config.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, config.width, config.height);

    if (config.backgroundImageUrl) {
      try {
        const img = await this.loadImage(config.backgroundImageUrl);
        ctx.drawImage(img, 0, 0, config.width, config.height);
      } catch (error) {
        this.logger.warn('ShareManager: Failed to load background image', error);
      }
    }

    const centerX = config.width / 2;

    if (config.logoUrl) {
      try {
        const logo = await this.loadImage(config.logoUrl);
        const logoSize = 80;
        ctx.drawImage(logo, centerX - logoSize / 2, 60, logoSize, logoSize);
      } catch (error) {
        this.logger.warn('ShareManager: Failed to load logo', error);
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(config.title, centerX, 200);

    if (config.subtitle) {
      ctx.font = '24px sans-serif';
      ctx.globalAlpha = 0.8;
      ctx.fillText(config.subtitle, centerX, 250);
      ctx.globalAlpha = 1;
    }

    const qrSize = 200;
    const qrY = config.height - qrSize - 180;

    ctx.fillStyle = '#ffffff';
    const qrPadding = 10;
    ctx.fillRect(
      centerX - qrSize / 2 - qrPadding,
      qrY - qrPadding,
      qrSize + qrPadding * 2,
      qrSize + qrPadding * 2
    );

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(
            centerX - qrSize / 2 + i * (qrSize / 8),
            qrY + j * (qrSize / 8),
            qrSize / 8,
            qrSize / 8
          );
        }
      }
    }

    if (config.includeQRCode) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px sans-serif';
      ctx.fillText('扫码体验', centerX, qrY + qrSize + 40);
    }

    if (config.watermark) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px sans-serif';
      ctx.rotate(-Math.PI / 8);
      for (let y = 0; y < config.height; y += 150) {
        ctx.fillText(config.watermark, -100, y);
      }
      ctx.restore();
    }

    const dataUrl = canvas.toDataURL(
      config.format === 'png' ? 'image/png' : 'image/jpeg',
      config.quality
    );

    const blob = await this.dataUrlToBlob(dataUrl);

    return {
      dataUrl,
      blob,
      width: config.width,
      height: config.height
    };
  }

  async shareToPlatform(platform: string, data: ShareData): Promise<void> {
    this.logger.log(`ShareManager: Sharing to ${platform}`);

    if (isBrowser() && (navigator as unknown as { share?: (data: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as unknown as { share: (data: ShareData) => Promise<void> }).share({
          title: data.title,
          text: data.text,
          url: data.url
        });
      } catch (error) {
        if ((error as { name?: string }).name !== 'AbortError') {
          this.logger.warn('ShareManager: Native share failed, falling back', error);
          this.fallbackShare(platform, data);
        }
      }
    } else {
      this.fallbackShare(platform, data);
    }

    this.eventEmitter.emit(InteractionEventType.SHARE, {
      platform,
      hasImage: !!data.imageUrl,
      hasUrl: !!data.url
    });
  }

  private fallbackShare(platform: string, data: ShareData): void {
    const shareUrls: Record<string, (data: ShareData) => string> = {
      wechat: () => data.url || '',
      weibo: (d) =>
        `https://service.weibo.com/share/share.php?url=${encodeURIComponent(d.url || '')}&title=${encodeURIComponent(d.title || '')}`,
      twitter: (d) =>
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(d.text || '')}&url=${encodeURIComponent(d.url || '')}`,
      facebook: (d) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(d.url || '')}`,
      whatsapp: (d) => `https://wa.me/?text=${encodeURIComponent((d.text || '') + ' ' + (d.url || ''))}`,
      default: (d) => d.url || ''
    };

    const shareFn = shareUrls[platform] || shareUrls.default;
    const url = shareFn(data);

    if (isBrowser() && url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  }

  downloadImage(dataUrl: string, filename?: string): void {
    if (!isBrowser()) {
      this.logger.warn('ShareManager: Download is only available in browser');
      return;
    }

    const actualFilename = filename || `screenshot_${generateId('img')}.png`;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = actualFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.logger.log(`ShareManager: Image downloaded as ${actualFilename}`);
  }

  copyToClipboard(text: string): Promise<boolean> {
    if (!isBrowser()) {
      return Promise.resolve(false);
    }

    if ((navigator as unknown as { clipboard?: { writeText: (text: string) => Promise<void> } }).clipboard) {
      return (navigator as unknown as { clipboard: { writeText: (text: string) => Promise<void> } }).clipboard
        .writeText(text)
        .then(() => true)
        .catch(() => false);
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  private getOrCreateCanvas(width: number, height: number): HTMLCanvasElement {
    if (!this.canvas) {
      if (!isBrowser()) {
        throw new Error('Canvas is only available in browser environment');
      }
      this.canvas = document.createElement('canvas');
    }
    this.canvas.width = width;
    this.canvas.height = height;
    return this.canvas;
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  private dataUrlToBlob(dataUrl: string): Promise<Blob | undefined> {
    return new Promise((resolve) => {
      if (!isBrowser()) {
        resolve(undefined);
        return;
      }

      try {
        const arr = dataUrl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) {
          resolve(undefined);
          return;
        }
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        resolve(new Blob([u8arr], { type: mime }));
      } catch {
        resolve(undefined);
      }
    });
  }

  destroy(): void {
    this.canvas = undefined;
    this.logger.log('ShareManager: Destroyed');
  }
}
