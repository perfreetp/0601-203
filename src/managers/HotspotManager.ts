import {
  Hotspot,
  HotspotConfig,
  HotspotType,
  ProductDescription,
  Coupon,
  InteractionEventType,
  InteractionEvent
} from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';
import { I18nManager } from './I18nManager';

export class HotspotManager {
  private hotspots: Map<string, Hotspot> = new Map();
  private productDescriptions: Map<string, ProductDescription> = new Map();
  private coupons: Map<string, Coupon> = new Map();
  private clickHistory: Array<{ hotspotId: string; timestamp: number }> = [];
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private i18n: I18nManager;
  private clickCallbacks: Map<string, (hotspot: Hotspot) => void> = new Map();
  private hoverCallbacks: Map<string, (hotspot: Hotspot) => void> = new Map();

  constructor(eventEmitter: EventEmitter, logger: Logger, i18n: I18nManager) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.i18n = i18n;
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
    const removed = this.hotspots.delete(hotspotId);
    if (removed) {
      this.logger.log(`HotspotManager: Hotspot ${hotspotId} removed`);
    }
    return removed;
  }

  clearHotspots(): void {
    this.hotspots.clear();
    this.clickCallbacks.clear();
    this.hoverCallbacks.clear();
    this.logger.log('HotspotManager: All hotspots cleared');
  }

  updateHotspot(hotspotId: string, updates: Partial<Hotspot>): boolean {
    const hotspot = this.hotspots.get(hotspotId);
    if (hotspot) {
      Object.assign(hotspot, updates);
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

    this.logger.log(`HotspotManager: Hotspot ${hotspotId} clicked`);
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

    this.logger.log(`HotspotManager: Coupon ${couponId} claimed successfully`);
    return { ...coupon };
  }

  removeCoupon(couponId: string): boolean {
    return this.coupons.delete(couponId);
  }

  openPurchaseEntry(productId?: string): void {
    this.eventEmitter.emit(InteractionEventType.PURCHASE_INTENT, {
      productId,
      timestamp: Date.now()
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
    this.logger.log(`HotspotManager: Showing coupon ${couponId}`);
    return { ...coupon };
  }

  destroy(): void {
    this.hotspots.clear();
    this.productDescriptions.clear();
    this.coupons.clear();
    this.clickHistory = [];
    this.clickCallbacks.clear();
    this.hoverCallbacks.clear();
    this.logger.log('HotspotManager: Destroyed');
  }
}
