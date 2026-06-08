import {
  Hotspot,
  HotspotConfig,
  HotspotType,
  ProductDescription,
  Coupon,
  InteractionEventType,
  InteractionEvent,
  MiniGame
} from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';
import { I18nManager } from './I18nManager';
import { ShowcaseManager } from './ShowcaseManager';
import { isBrowser } from '../utils/helpers';

const HOTSPOT_ICONS: Record<HotspotType, string> = {
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

export class HotspotManager {
  private hotspots: Map<string, Hotspot> = new Map();
  private hotspotElements: Map<string, HTMLElement> = new Map();
  private productDescriptions: Map<string, ProductDescription> = new Map();
  private coupons: Map<string, Coupon> = new Map();
  private games: Map<string, MiniGame> = new Map();
  private clickHistory: Array<{ hotspotId: string; timestamp: number }> = [];
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private i18n: I18nManager;
  private showcaseManager: ShowcaseManager;
  private clickCallbacks: Map<string, (hotspot: Hotspot) => void> = new Map();
  private hoverCallbacks: Map<string, (hotspot: Hotspot) => void> = new Map();

  constructor(
    eventEmitter: EventEmitter,
    logger: Logger,
    i18n: I18nManager,
    showcaseManager: ShowcaseManager
  ) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.i18n = i18n;
    this.showcaseManager = showcaseManager;
  }

  addHotspot(config: HotspotConfig): Hotspot {
    this.logger.log(`HotspotManager: Adding hotspot ${config.id} (${config.type})`);

    const hotspot: Hotspot = {
      id: config.id,
      type: config.type,
      position: { ...config.position },
      productId: config.productId,
      title: config.title || this.i18n.t(`hotspot.${config.type}`),
      description: config.description || '',
      iconUrl: config.iconUrl,
      visible: true,
      active: true,
      metadata: config.metadata
    };

    this.hotspots.set(config.id, hotspot);
    this.renderHotspotElement(hotspot);

    if (config.onClick) {
      this.clickCallbacks.set(config.id, config.onClick);
    }
    if (config.onHover) {
      this.hoverCallbacks.set(config.id, config.onHover);
    }

    return hotspot;
  }

  addHotspots(configs: HotspotConfig[]): Hotspot[] {
    return configs.map((config) => this.addHotspot(config));
  }

  private renderHotspotElement(hotspot: Hotspot): void {
    if (!isBrowser()) return;

    const hotspotsLayer = this.showcaseManager.getHotspotsLayer();
    if (!hotspotsLayer) return;

    const existingEl = this.hotspotElements.get(hotspot.id);
    if (existingEl) {
      existingEl.remove();
    }

    const { x, y, z } = hotspot.position;
    const leftPct = 50 + x * 15;
    const bottomPct = 20 + y * 12;
    const color = HOTSPOT_COLORS[hotspot.type];

    const el = document.createElement('div');
    el.className = 'mv-hotspot';
    el.dataset.hotspotId = hotspot.id;
    el.style.cssText = `
      position: absolute;
      left: ${leftPct}%;
      bottom: ${bottomPct}%;
      transform: translateX(-50%);
      z-index: ${Math.round(200 - z * 15)};
      pointer-events: auto;
      cursor: pointer;
    `;

    const pulse = document.createElement('div');
    pulse.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 48px;
      height: 48px;
      margin: -24px 0 0 -24px;
      border-radius: 50%;
      background: ${color};
      opacity: 0.4;
      animation: mv-hotspot-pulse 1.5s ease-out infinite;
      pointer-events: none;
    `;
    el.appendChild(pulse);

    const button = document.createElement('div');
    button.className = 'mv-hotspot-btn';
    button.style.cssText = `
      position: relative;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${color}, ${this.lightenColor(color, 20)});
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: #fff;
      box-shadow: 0 4px 16px ${color}66, 0 2px 4px rgba(0,0,0,0.2);
      border: 2px solid #fff;
      transition: all 0.3s ease;
      z-index: 2;
    `;
    button.textContent = HOTSPOT_ICONS[hotspot.type];
    el.appendChild(button);

    const label = document.createElement('div');
    label.style.cssText = `
      position: absolute;
      top: 50%;
      left: 58px;
      transform: translateY(-50%);
      background: rgba(0,0,0,0.75);
      color: #fff;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      backdrop-filter: blur(8px);
    `;
    label.textContent = hotspot.title;
    el.appendChild(label);

    el.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.15)';
      label.style.opacity = '1';
      this.hoverHotspot(hotspot.id);
    });
    el.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      label.style.opacity = '0';
    });
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clickHotspot(hotspot.id);
    });

    const styleEl = document.getElementById('mv-hotspot-styles');
    if (!styleEl && isBrowser()) {
      const style = document.createElement('style');
      style.id = 'mv-hotspot-styles';
      style.textContent = `
        @keyframes mv-hotspot-pulse {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    hotspotsLayer.appendChild(el);
    this.hotspotElements.set(hotspot.id, el);
  }

  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }

  getHotspot(hotspotId: string): Hotspot | undefined {
    return this.hotspots.get(hotspotId);
  }

  getHotspotsByType(type: HotspotType): Hotspot[] {
    return Array.from(this.hotspots.values()).filter((h) => h.type === type);
  }

  getProductHotspots(productId: string): Hotspot[] {
    return Array.from(this.hotspots.values()).filter((h) => h.productId === productId);
  }

  getAllHotspots(): Hotspot[] {
    return Array.from(this.hotspots.values());
  }

  getVisibleHotspots(): Hotspot[] {
    return Array.from(this.hotspots.values()).filter((h) => h.visible);
  }

  removeHotspot(hotspotId: string): boolean {
    this.clickCallbacks.delete(hotspotId);
    this.hoverCallbacks.delete(hotspotId);
    const el = this.hotspotElements.get(hotspotId);
    if (el) {
      el.remove();
      this.hotspotElements.delete(hotspotId);
    }
    const removed = this.hotspots.delete(hotspotId);
    if (removed) {
      this.logger.log(`HotspotManager: Hotspot ${hotspotId} removed`);
    }
    return removed;
  }

  clearHotspots(): void {
    this.hotspotElements.forEach((el) => el.remove());
    this.hotspotElements.clear();
    this.hotspots.clear();
    this.clickCallbacks.clear();
    this.hoverCallbacks.clear();
    this.logger.log('HotspotManager: All hotspots cleared');
  }

  updateHotspot(hotspotId: string, updates: Partial<Hotspot>): boolean {
    const hotspot = this.hotspots.get(hotspotId);
    if (hotspot) {
      Object.assign(hotspot, updates);
      if (updates.visible !== undefined || updates.active !== undefined) {
        const el = this.hotspotElements.get(hotspotId);
        if (el) {
          el.style.display = hotspot.visible && hotspot.active ? 'block' : 'none';
        }
      }
      this.logger.log(`HotspotManager: Hotspot ${hotspotId} updated`);
      return true;
    }
    return false;
  }

  setHotspotVisible(hotspotId: string, visible: boolean): boolean {
    return this.updateHotspot(hotspotId, { visible });
  }

  setHotspotActive(hotspotId: string, active: boolean): boolean {
    return this.updateHotspot(hotspotId, { active });
  }

  clickHotspot(hotspotId: string): void {
    const hotspot = this.hotspots.get(hotspotId);
    if (!hotspot || !hotspot.visible || !hotspot.active) {
      this.logger.warn(`HotspotManager: Hotspot ${hotspotId} not clickable`);
      return;
    }

    this.clickHistory.push({ hotspotId, timestamp: Date.now() });

    this.eventEmitter.emit(InteractionEventType.HOTSPOT_CLICK, {
      hotspotId,
      hotspotType: hotspot.type,
      productId: hotspot.productId,
      title: hotspot.title
    });

    const callback = this.clickCallbacks.get(hotspotId);
    if (callback) {
      try {
        callback(hotspot);
      } catch (error) {
        this.logger.error(`HotspotManager: Error in click callback for ${hotspotId}:`, error);
      }
    }

    this.handleHotspotAction(hotspot);

    this.logger.log(`HotspotManager: Hotspot ${hotspotId} clicked`);
  }

  private handleHotspotAction(hotspot: Hotspot): void {
    switch (hotspot.type) {
      case HotspotType.PRODUCT:
        if (hotspot.productId) {
          this.showProductDescriptionPopup(hotspot.productId, hotspot.title);
        }
        break;
      case HotspotType.COUPON:
        this.showHotspotCouponPopup(hotspot);
        break;
      case HotspotType.PURCHASE:
        this.openPurchaseEntry(hotspot.productId);
        break;
      case HotspotType.GAME:
        this.showGamePopup(hotspot);
        break;
      case HotspotType.INFO:
        this.showInfoPopup(hotspot);
        break;
      case HotspotType.LINK:
        break;
    }
  }

  private showProductDescriptionPopup(productId: string, title: string): void {
    const description = this.productDescriptions.get(productId);
    this.showPopup({
      title: description?.title || title,
      content: description?.content || this.i18n.t('action.click_to_view'),
      productId,
      description
    });
  }

  private showHotspotCouponPopup(hotspot: Hotspot): void {
    const productCoupons = hotspot.productId
      ? this.getProductCoupons(hotspot.productId)
      : this.getAvailableCoupons();
    const coupon = productCoupons[0];

    this.showPopup({
      title: this.i18n.t('action.claim_coupon'),
      content: coupon
        ? `${coupon.title}\n${coupon.description || ''}`
        : this.i18n.t('coupon.unavailable'),
      coupon,
      onConfirm: coupon
        ? () => {
            this.claimCoupon(coupon.id);
          }
        : undefined
    });
  }

  private showGamePopup(hotspot: Hotspot): void {
    const games = this.getAllGames();
    const game = games[0];

    this.showPopup({
      title: game?.name || this.i18n.t(`game.${hotspot.metadata?.gameType || 'lucky_draw'}`),
      content: game?.description || this.i18n.t('game.lucky_draw'),
      game,
      onConfirm: game
        ? () => {
            this.eventEmitter.emit(InteractionEventType.GAME_START, {
              gameId: game.id,
              gameName: game.name
            });
          }
        : undefined
    });
  }

  private showInfoPopup(hotspot: Hotspot): void {
    this.showPopup({
      title: hotspot.title,
      content: hotspot.description || hotspot.title
    });
  }

  private showPopup(options: {
    title: string;
    content: string;
    productId?: string;
    description?: ProductDescription;
    coupon?: Coupon;
    game?: MiniGame;
    onConfirm?: () => void;
  }): void {
    if (!isBrowser()) return;

    this.closePopup();

    const uiLayer = this.showcaseManager.getUILayer();
    if (!uiLayer) return;

    const popup = document.createElement('div');
    popup.className = 'mv-popup';
    popup.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fff;
      border-radius: 16px;
      padding: 24px;
      min-width: 280px;
      max-width: 360px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      z-index: 9999;
      pointer-events: auto;
      animation: mv-popup-in 0.3s ease;
    `;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 9998;
      pointer-events: auto;
    `;
    overlay.addEventListener('click', () => this.closePopup());

    const titleEl = document.createElement('div');
    titleEl.style.cssText = `
      font-size: 18px;
      font-weight: 700;
      color: #333;
      margin-bottom: 12px;
    `;
    titleEl.textContent = options.title;
    popup.appendChild(titleEl);

    const contentEl = document.createElement('div');
    contentEl.style.cssText = `
      font-size: 14px;
      color: #666;
      line-height: 1.6;
      margin-bottom: 20px;
      white-space: pre-line;
    `;
    contentEl.textContent = options.content;
    popup.appendChild(contentEl);

    if (options.description?.specs) {
      const specsEl = document.createElement('div');
      specsEl.style.cssText = `
        background: #f8f8f8;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
      `;
      for (const [key, value] of Object.entries(options.description.specs)) {
        const specRow = document.createElement('div');
        specRow.style.cssText = `
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          padding: 4px 0;
        `;
        specRow.innerHTML = `<span style="color:#999">${key}</span><span style="color:#333;font-weight:500">${value}</span>`;
        specsEl.appendChild(specRow);
      }
      popup.appendChild(specsEl);
    }

    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = `
      display: flex;
      gap: 10px;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      flex: 1;
      padding: 10px 16px;
      border: 1px solid #ddd;
      background: #fff;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      color: #666;
    `;
    closeBtn.textContent = this.i18n.t('action.close');
    closeBtn.addEventListener('click', () => this.closePopup());
    btnWrap.appendChild(closeBtn);

    if (options.onConfirm) {
      const confirmBtn = document.createElement('button');
      confirmBtn.style.cssText = `
        flex: 1;
        padding: 10px 16px;
        border: none;
        background: linear-gradient(135deg, #4a90d9, #357abd);
        color: #fff;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      `;
      confirmBtn.textContent = options.coupon
        ? this.i18n.t('action.claim_coupon')
        : options.game
        ? this.i18n.t('game.lucky_draw')
        : options.productId
        ? this.i18n.t('action.buy_now')
        : this.i18n.t('action.confirm');
      confirmBtn.addEventListener('click', () => {
        if (options.onConfirm) {
          options.onConfirm();
        }
        this.closePopup();
      });
      btnWrap.appendChild(confirmBtn);
    }

    popup.appendChild(btnWrap);

    const styleEl = document.getElementById('mv-popup-styles');
    if (!styleEl && isBrowser()) {
      const style = document.createElement('style');
      style.id = 'mv-popup-styles';
      style.textContent = `
        @keyframes mv-popup-in {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    uiLayer.appendChild(overlay);
    uiLayer.appendChild(popup);
  }

  closePopup(): void {
    if (!isBrowser()) return;
    const uiLayer = this.showcaseManager.getUILayer();
    if (!uiLayer) return;

    const popups = uiLayer.querySelectorAll('.mv-popup');
    popups.forEach((p) => p.remove());

    const overlays = uiLayer.querySelectorAll('div[style*="z-index: 9998"]');
    overlays.forEach((o) => o.remove());
  }

  hoverHotspot(hotspotId: string): void {
    const hotspot = this.hotspots.get(hotspotId);
    if (!hotspot || !hotspot.visible) {
      return;
    }

    this.eventEmitter.emit(InteractionEventType.HOTSPOT_HOVER, {
      hotspotId,
      hotspotType: hotspot.type,
      productId: hotspot.productId
    });

    const callback = this.hoverCallbacks.get(hotspotId);
    if (callback) {
      try {
        callback(hotspot);
      } catch (error) {
        this.logger.error(`HotspotManager: Error in hover callback for ${hotspotId}:`, error);
      }
    }
  }

  getClickHistory(): Array<{ hotspotId: string; timestamp: number }> {
    return [...this.clickHistory];
  }

  getHotspotClickCount(hotspotId: string): number {
    return this.clickHistory.filter((h) => h.hotspotId === hotspotId).length;
  }

  setProductDescription(description: ProductDescription): void {
    this.productDescriptions.set(description.productId, description);
    this.logger.log(`HotspotManager: Product description set for ${description.productId}`);
  }

  getProductDescription(productId: string): ProductDescription | undefined {
    return this.productDescriptions.get(productId);
  }

  removeProductDescription(productId: string): boolean {
    return this.productDescriptions.delete(productId);
  }

  addCoupon(coupon: Coupon): void {
    this.coupons.set(coupon.id, { ...coupon, claimed: false });
    this.logger.log(`HotspotManager: Coupon ${coupon.id} added`);
  }

  addCoupons(coupons: Coupon[]): void {
    coupons.forEach((c) => this.addCoupon(c));
  }

  getCoupon(couponId: string): Coupon | undefined {
    return this.coupons.get(couponId);
  }

  getAllCoupons(): Coupon[] {
    return Array.from(this.coupons.values());
  }

  getAvailableCoupons(): Coupon[] {
    return Array.from(this.coupons.values()).filter((c) => !c.claimed);
  }

  getProductCoupons(productId: string): Coupon[] {
    return Array.from(this.coupons.values()).filter(
      (c) => !c.claimed && (!c.productIds || c.productIds.includes(productId))
    );
  }

  claimCoupon(couponId: string): Coupon | null {
    const coupon = this.coupons.get(couponId);
    if (!coupon) {
      this.logger.warn(`HotspotManager: Coupon ${couponId} not found`);
      return null;
    }
    if (coupon.claimed) {
      this.logger.warn(`HotspotManager: Coupon ${couponId} already claimed`);
      return null;
    }
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      this.logger.warn(`HotspotManager: Coupon ${couponId} expired`);
      return null;
    }

    coupon.claimed = true;

    this.eventEmitter.emit(InteractionEventType.COUPON_CLAIM, {
      couponId,
      couponTitle: coupon.title,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue
    });

    this.showPopup({
      title: this.i18n.t('coupon.claimed'),
      content: coupon.title
    });

    this.logger.log(`HotspotManager: Coupon ${couponId} claimed successfully`);
    return { ...coupon };
  }

  addGame(game: MiniGame): void {
    this.games.set(game.id, game);
  }

  addGames(games: MiniGame[]): void {
    games.forEach((g) => this.addGame(g));
  }

  getAllGames(): MiniGame[] {
    return Array.from(this.games.values());
  }

  removeCoupon(couponId: string): boolean {
    return this.coupons.delete(couponId);
  }

  openPurchaseEntry(productId?: string): void {
    this.eventEmitter.emit(InteractionEventType.PURCHASE_INTENT, {
      productId,
      timestamp: Date.now()
    });

    this.showPopup({
      title: this.i18n.t('action.buy_now'),
      content: productId
        ? `${this.i18n.t('hotspot.product')} ID: ${productId}`
        : this.i18n.t('action.buy_now')
    });

    this.logger.log(`HotspotManager: Purchase entry opened${productId ? ` for product ${productId}` : ''}`);
  }

  onHotspotClick(callback: (hotspot: Hotspot) => void): () => void {
    const handler = (event: InteractionEvent) => {
      const hotspotId = event.data?.hotspotId as string;
      const hotspot = this.hotspots.get(hotspotId);
      if (hotspot) {
        callback(hotspot);
      }
    };
    this.eventEmitter.on(InteractionEventType.HOTSPOT_CLICK, handler);
    return () => {
      this.eventEmitter.off(InteractionEventType.HOTSPOT_CLICK, handler);
    };
  }

  showCouponPopup(couponId: string): Coupon | null {
    const coupon = this.coupons.get(couponId);
    if (!coupon) {
      return null;
    }
    this.showPopup({
      title: coupon.title,
      content: coupon.description || coupon.title,
      coupon,
      onConfirm: () => this.claimCoupon(couponId)
    });
    this.logger.log(`HotspotManager: Showing coupon ${couponId}`);
    return { ...coupon };
  }

  destroy(): void {
    this.hotspotElements.forEach((el) => el.remove());
    this.hotspotElements.clear();
    this.hotspots.clear();
    this.productDescriptions.clear();
    this.coupons.clear();
    this.games.clear();
    this.clickHistory = [];
    this.clickCallbacks.clear();
    this.hoverCallbacks.clear();
    this.closePopup();
    this.logger.log('HotspotManager: Destroyed');
  }
}
