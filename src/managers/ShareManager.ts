import {
  IShareManager,
  ScreenshotConfig,
  ScreenshotResult,
  SharePosterConfig,
  ShareData,
  InteractionEventType,
  Product,
  Hotspot,
  HotspotType,
  AvatarGesture,
  TourState,
  TourStep
} from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';
import { I18nManager } from './I18nManager';
import { ShowcaseManager } from './ShowcaseManager';
import { AvatarManager, Avatar } from './AvatarManager';
import { HotspotManager } from './HotspotManager';
import { TourManager } from './TourManager';
import { isBrowser, generateId } from '../utils/helpers';

const HOTSPOT_ICON_SMALL: Record<HotspotType, string> = {
  [HotspotType.PRODUCT]: '🛍️',
  [HotspotType.INFO]: 'ℹ️',
  [HotspotType.COUPON]: '🎟️',
  [HotspotType.GAME]: '🎮',
  [HotspotType.PURCHASE]: '🛒',
  [HotspotType.LINK]: '🔗'
};

const HOTSPOT_COLORS: Record<HotspotType, string> = {
  [HotspotType.PRODUCT]: '#4a90d9',
  [HotspotType.INFO]: '#9b59b6',
  [HotspotType.COUPON]: '#e67e22',
  [HotspotType.GAME]: '#27ae60',
  [HotspotType.PURCHASE]: '#e74c3c',
  [HotspotType.LINK]: '#1abc9c'
};

const GESTURE_EMOJI: Record<AvatarGesture, string> = {
  [AvatarGesture.WAVE]: '👋',
  [AvatarGesture.POINT]: '👆',
  [AvatarGesture.CLAP]: '👏',
  [AvatarGesture.THINK]: '🤔',
  [AvatarGesture.BOW]: '🙇',
  [AvatarGesture.HAND_SHAKE]: '🤝',
  [AvatarGesture.THUMBS_UP]: '👍',
  [AvatarGesture.HEART]: '❤️'
};

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
  private showcaseManager: ShowcaseManager;
  private avatarManager: AvatarManager;
  private hotspotManager: HotspotManager;
  private tourManager: TourManager;
  private canvas?: HTMLCanvasElement;

  constructor(
    eventEmitter: EventEmitter,
    logger: Logger,
    i18n: I18nManager,
    showcaseManager: ShowcaseManager,
    avatarManager: AvatarManager,
    hotspotManager: HotspotManager,
    tourManager: TourManager
  ) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.i18n = i18n;
    this.showcaseManager = showcaseManager;
    this.avatarManager = avatarManager;
    this.hotspotManager = hotspotManager;
    this.tourManager = tourManager;
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

    const themeStyles = this.showcaseManager.getThemeStyles();

    const gradient = ctx.createLinearGradient(0, 0, config.width, config.height);
    const colors = themeStyles.bg.match(/#[a-fA-F0-9]{6}|rgba?\([^)]+\)/g) || ['#1a1a2e', '#0f3460'];
    gradient.addColorStop(0, colors[0] || '#1a1a2e');
    gradient.addColorStop(1, colors[colors.length - 1] || '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, config.width, config.height);

    const scale = config.width / 1920;

    const floorY = config.height * 0.7;
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, config.height);
    floorGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
    floorGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.ellipse(config.width / 2, config.height, config.width * 0.45, config.height * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    const products = this.showcaseManager.getAllProducts();
    products.forEach((product) => {
      const posX = product.position?.x ?? 0;
      const posY = product.position?.y ?? 0;
      const cardX = config.width / 2 + posX * 240 * scale;
      const cardY = config.height * 0.62 - posY * 120 * scale;
      this.drawProductCard(ctx, product, cardX, cardY, config);
    });

    const activeAvatar = this.avatarManager.getActiveAvatar();
    if (activeAvatar) {
      const avX = config.width / 2 + (activeAvatar.position?.x ?? 0) * 180 * scale;
      const avY = config.height * 0.38 + (activeAvatar.position?.y ?? 0) * 100 * scale;
      this.drawDetailedAvatar(ctx, activeAvatar, avX, avY, config);
    }

    const hotspots = this.hotspotManager.getAllHotspots();
    if (hotspots.length > 0) {
      this.drawAllHotspots(ctx, hotspots, config);
    }

    const tourState = this.tourManager.getTourState();
    if (tourState && config.includeUI) {
      this.drawTourProgress(ctx, tourState, this.tourManager.getTourSteps(), config);
    }

    if (config.includeUI) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      const statusParts = [];
      statusParts.push(`📦 ${products.length}商品`);
      if (activeAvatar) statusParts.push(`🧑‍💼 ${activeAvatar.name}`);
      statusParts.push(`🔥 ${hotspots.length}热点`);
      ctx.fillText(statusParts.join('  |  '), 24, 36);
    }

    if (config.watermark) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px sans-serif';
      ctx.rotate(-Math.PI / 8);
      for (let y = 0; y < config.height * 1.5; y += 120) {
        ctx.fillText(config.watermark, -config.width * 0.2, y);
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

  private drawDetailedAvatar(
    ctx: CanvasRenderingContext2D,
    avatar: Avatar,
    x: number,
    y: number,
    config: Required<ScreenshotConfig>
  ): void {
    const scale = config.width / 1920;

    ctx.save();
    ctx.shadowColor = 'rgba(74,144,217,0.5)';
    ctx.shadowBlur = 40 * scale;

    ctx.fillStyle = '#ffe0bd';
    ctx.beginPath();
    ctx.arc(x, y - 40 * scale, 45 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.font = `${52 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(avatar.config.gender === 'male' ? '👨' : avatar.config.gender === 'neutral' ? '🧑' : '👩', x, y - 25 * scale);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 20 * scale;
    ctx.fillStyle = '#4a90d9';
    this.roundRect(ctx, x - 55 * scale, y + 10 * scale, 110 * scale, 110 * scale, 55 * scale);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${18 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(avatar.name, x, y + 150 * scale);

    if (avatar.isGreeting) {
      ctx.save();
      const badgeW = 120 * scale;
      const badgeH = 36 * scale;
      ctx.fillStyle = '#e74c3c';
      ctx.shadowColor = 'rgba(231,76,60,0.6)';
      ctx.shadowBlur = 15 * scale;
      this.roundRect(ctx, x - badgeW / 2, y - 120 * scale, badgeW, badgeH, 18 * scale);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${14 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('✨ 迎宾中', x, y - 95 * scale);
      ctx.restore();
    }

    if (avatar.currentAnimation) {
      const gestureKey = Object.entries(AvatarGesture).find(
        ([, v]) => v === avatar.currentAnimation
      )?.[1] as AvatarGesture | undefined;
      const gestureEmoji = gestureKey ? GESTURE_EMOJI[gestureKey] : undefined;
      if (gestureEmoji) {
        ctx.font = `${44 * scale}px sans-serif`;
        ctx.fillText(gestureEmoji, x + 80 * scale, y + 20 * scale);
      }
    }

    if (avatar.isSpeaking) {
      const barX = x - 30 * scale;
      const barY = y + 75 * scale;
      const barColors = ['#4a90d9', '#5ba0e9', '#6bb0f9'];
      for (let i = 0; i < 3; i++) {
        const h = (18 + Math.sin(Date.now() / 200 + i) * 8) * scale;
        ctx.fillStyle = barColors[i];
        ctx.fillRect(barX + i * 12 * scale, barY - h, 6 * scale, h);
      }

      const subtitle = this.i18n.getSubtitle();
      const subtitleText = subtitle?.text || avatar.subtitleElement?.textContent || '正在为您讲解...';
      this.drawSubtitleBubble(ctx, subtitleText, x, y - 160 * scale, scale);
    }
  }

  private drawSubtitleBubble(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    scale: number
  ): void {
    ctx.save();
    ctx.font = `${15 * scale}px sans-serif`;
    const padding = 14 * scale;
    const textW = ctx.measureText(text).width;
    const bubbleW = textW + padding * 2;
    const bubbleH = 36 * scale;

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 10 * scale;
    this.roundRect(ctx, x - bubbleW / 2, y - bubbleH / 2, bubbleW, bubbleH, 10 * scale);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x - 8 * scale, y + bubbleH / 2 - 1);
    ctx.lineTo(x, y + bubbleH / 2 + 10 * scale);
    ctx.lineTo(x + 8 * scale, y + bubbleH / 2 - 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private drawAllHotspots(
    ctx: CanvasRenderingContext2D,
    hotspots: Hotspot[],
    config: Required<ScreenshotConfig>
  ): void {
    const scale = config.width / 1920;

    hotspots.forEach((hotspot) => {
      const posX = hotspot.position?.x ?? 0;
      const posY = hotspot.position?.y ?? 0;
      const x = config.width / 2 + posX * 200 * scale;
      const y = config.height * 0.55 - posY * 100 * scale;
      const color = HOTSPOT_COLORS[hotspot.type];
      const icon = HOTSPOT_ICON_SMALL[hotspot.type];
      const r = 22 * scale;

      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.shadowColor = color + '88';
      ctx.shadowBlur = 12 * scale;
      const grad = ctx.createRadialGradient(x - r / 3, y - r / 3, 2, x, y, r);
      grad.addColorStop(0, this.lightenColor(color, 30));
      grad.addColorStop(1, color);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * scale;
      ctx.stroke();
      ctx.restore();

      ctx.font = `${22 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, x, y + 1);

      if (hotspot.title) {
        ctx.save();
        ctx.font = `${11 * scale}px sans-serif`;
        const labelW = ctx.measureText(hotspot.title).width + 14 * scale;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.roundRect(ctx, x + r + 6 * scale, y - 10 * scale, labelW, 22 * scale, 6 * scale);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(hotspot.title, x + r + 13 * scale, y + 1 * scale);
        ctx.restore();
      }
    });
  }

  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  private drawTourProgress(
    ctx: CanvasRenderingContext2D,
    tourState: TourState,
    tourSteps: TourStep[],
    config: Required<ScreenshotConfig>
  ): void {
    const scale = config.width / 1920;
    const panelW = 420 * scale;
    const panelH = 96 * scale;
    const panelX = config.width - panelW - 24 * scale;
    const panelY = 24 * scale;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this.roundRect(ctx, panelX, panelY, panelW, panelH, 14 * scale);
    ctx.fill();

    const title = tourState.isCompleted ? '导览已完成' : tourState.isPaused ? '导览已暂停' : '导览进行中';
    const icon = tourState.isCompleted ? '✅' : tourState.isPaused ? '⏸️' : '▶️';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${15 * scale}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`${icon} ${title}`, panelX + 16 * scale, panelY + 30 * scale);

    const totalSteps = tourSteps.length;
    const completedCount = tourState.stepProgress.filter((s) => s.completed).length;
    const progress = totalSteps > 0 ? Math.min(1, completedCount / totalSteps) : 0;

    const barX = panelX + 16 * scale;
    const barY = panelY + 44 * scale;
    const barW = panelW - 32 * scale;
    const barH = 8 * scale;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    this.roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();

    ctx.fillStyle = '#4a90d9';
    this.roundRect(ctx, barX, barY, barW * progress, barH, barH / 2);
    ctx.fill();

    const currentStep = tourSteps[tourState.currentStepIndex];
    const stepLabel = currentStep
      ? `步骤 ${tourState.currentStepIndex + 1}/${totalSteps}：${currentStep.title}`
      : `${completedCount}/${totalSteps} 步`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `${12 * scale}px sans-serif`;
    ctx.fillText(stepLabel, panelX + 16 * scale, panelY + 76 * scale);
    ctx.restore();
  }

  private drawProductCard(
    ctx: CanvasRenderingContext2D,
    product: Product,
    x: number,
    y: number,
    config: Required<ScreenshotConfig>
  ): void {
    const cardW = Math.min(180, config.width / 5);
    const cardH = cardW * 1.4;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;

    const themeStyles = this.showcaseManager.getThemeStyles();
    ctx.fillStyle = '#ffffff';
    this.roundRect(ctx, x - cardW / 2, y - cardH / 2, cardW, cardH, 12);
    ctx.fill();
    ctx.restore();

    const imgH = cardH * 0.5;
    if (product.thumbnailUrl) {
      ctx.fillStyle = '#f0f0f0';
      this.roundRect(ctx, x - cardW / 2 + 8, y - cardH / 2 + 8, cardW - 16, imgH - 8, 8);
      ctx.fill();
      ctx.fillStyle = '#999';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📦', x, y - cardH / 2 + imgH / 2 + 8);
    } else {
      const gradient = ctx.createLinearGradient(x - cardW / 2 + 8, y - cardH / 2 + 8, x + cardW / 2 - 8, y - cardH / 2 + imgH);
      gradient.addColorStop(0, themeStyles.accent + '22');
      gradient.addColorStop(1, themeStyles.accent + '44');
      ctx.fillStyle = gradient;
      this.roundRect(ctx, x - cardW / 2 + 8, y - cardH / 2 + 8, cardW - 16, imgH - 8, 8);
      ctx.fill();
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛍️', x, y - cardH / 2 + imgH / 2 + 12);
    }

    ctx.fillStyle = '#333';
    ctx.font = `bold ${Math.max(12, cardW / 12)}px sans-serif`;
    ctx.textAlign = 'center';
    const name = product.name.length > 8 ? product.name.substring(0, 8) + '...' : product.name;
    ctx.fillText(name, x, y - cardH / 2 + imgH + 28);

    if (product.price !== undefined) {
      ctx.fillStyle = '#e74c3c';
      ctx.font = `bold ${Math.max(14, cardW / 10)}px sans-serif`;
      const currency = product.currency || '¥';
      ctx.fillText(`${currency}${product.price}`, x, y - cardH / 2 + imgH + 50);
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
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

    const gradient = ctx.createLinearGradient(0, 0, 0, config.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.4, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, config.width, config.height);

    if (config.backgroundImageUrl) {
      try {
        const img = await this.loadImage(config.backgroundImageUrl);
        ctx.drawImage(img, 0, 0, config.width, config.height);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, config.width, config.height);
      } catch (error) {
        this.logger.warn('ShareManager: Failed to load background image', error);
      }
    }

    const centerX = config.width / 2;

    if (config.logoUrl) {
      try {
        const logo = await this.loadImage(config.logoUrl);
        const logoSize = 80;
        ctx.save();
        ctx.shadowColor = 'rgba(255,255,255,0.3)';
        ctx.shadowBlur = 20;
        ctx.drawImage(logo, centerX - logoSize / 2, 60, logoSize, logoSize);
        ctx.restore();
      } catch (error) {
        this.logger.warn('ShareManager: Failed to load logo', error);
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = '48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏪', centerX, 130);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(config.title, centerX, 220);

    if (config.subtitle) {
      ctx.font = '22px sans-serif';
      ctx.globalAlpha = 0.85;
      ctx.fillText(config.subtitle, centerX, 260);
      ctx.globalAlpha = 1;
    }

    const showcaseY = 300;
    const showcaseH = Math.min(500, config.height * 0.38);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    this.roundRect(ctx, 30, showcaseY, config.width - 60, showcaseH, 20);
    ctx.fill();

    const products = this.showcaseManager.getAllProducts();
    const displayProducts = products.slice(0, 3);
    const productAreaY = showcaseY + showcaseH / 2;

    if (displayProducts.length > 0) {
      const spacing = (config.width - 60) / (displayProducts.length + 1);
      displayProducts.forEach((product, idx) => {
        const px = 30 + spacing * (idx + 1);
        this.drawProductCard(ctx, product, px, productAreaY, {
          format: config.format,
          quality: config.quality,
          width: 300,
          height: 400,
          includeUI: true,
          watermark: ''
        });
      });
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✨ 精选商品等你来探索', centerX, productAreaY);
    }

    const container = this.showcaseManager.getContainer();
    if (container) {
      const avatars = container.querySelectorAll('.mv-avatar');
      const hotspots = container.querySelectorAll('.mv-hotspot');
      if (avatars.length > 0 || hotspots.length > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        const parts: string[] = [];
        if (avatars.length > 0) parts.push(`${avatars.length} 位数字导购`);
        if (hotspots.length > 0) parts.push(`${hotspots.length} 个互动点`);
        ctx.fillText(parts.join(' · '), centerX, showcaseY + showcaseH - 30);
      }
    }

    if (config.includeQRCode) {
      const qrSize = 180;
      const qrY = config.height - qrSize - 160;

      ctx.fillStyle = '#ffffff';
      const qrPadding = 12;
      this.roundRect(
        ctx,
        centerX - qrSize / 2 - qrPadding,
        qrY - qrPadding,
        qrSize + qrPadding * 2,
        qrSize + qrPadding * 2,
        12
      );
      ctx.fill();

      if (config.qrCodeUrl) {
        try {
          const qrImg = await this.loadImage(config.qrCodeUrl);
          ctx.drawImage(qrImg, centerX - qrSize / 2, qrY, qrSize, qrSize);
        } catch {
          this.drawQRPattern(ctx, centerX, qrY + qrSize / 2, qrSize);
        }
      } else {
        this.drawQRPattern(ctx, centerX, qrY + qrSize / 2, qrSize);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('扫码立即体验', centerX, qrY + qrSize + 40);
    } else {
      const callToActionY = config.height - 120;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      this.roundRect(ctx, centerX - 140, callToActionY, 280, 56, 28);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('立即进入虚拟展厅', centerX, callToActionY + 36);
    }

    if (config.watermark) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px sans-serif';
      ctx.rotate(-Math.PI / 8);
      for (let y = 0; y < config.height * 1.5; y += 140) {
        ctx.fillText(config.watermark, -config.width * 0.3, y);
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

  private drawQRPattern(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number
  ): void {
    const gridSize = 21;
    const cellSize = size / gridSize;
    const startX = cx - size / 2;
    const startY = cy - size / 2;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const isFinderCorner =
          (i < 7 && j < 7) ||
          (i < 7 && j >= gridSize - 7) ||
          (i >= gridSize - 7 && j < 7);

        if (isFinderCorner) {
          const isOuter = i === 0 || i === 6 || j === 0 || j === 6 ||
            (i >= gridSize - 7 && (i === gridSize - 7 || i === gridSize - 1)) ||
            (j >= gridSize - 7 && (j === gridSize - 7 || j === gridSize - 1));
          const isInner = (i >= 2 && i <= 4 && j >= 2 && j <= 4) ||
            (i >= 2 && i <= 4 && j >= gridSize - 5 && j <= gridSize - 3) ||
            (i >= gridSize - 5 && i <= gridSize - 3 && j >= 2 && j <= 4);

          if (isOuter || isInner) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(startX + j * cellSize, startY + i * cellSize, cellSize, cellSize);
          }
        } else if ((i * 3 + j * 7) % 2 === 0) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(startX + j * cellSize, startY + i * cellSize, cellSize, cellSize);
        }
      }
    }
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
