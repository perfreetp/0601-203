import {
  Hotspot,
  HotspotConfig,
  HotspotType,
  ProductDescription,
  Coupon,
  InteractionEventType,
  InteractionEvent,
  MiniGame,
  GameReward
} from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';
import { I18nManager } from './I18nManager';
import { ShowcaseManager } from './ShowcaseManager';
import { InteractionManager } from './InteractionManager';
import { isBrowser, generateId } from '../utils/helpers';

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
  private interactionManager: InteractionManager;
  private clickCallbacks: Map<string, (hotspot: Hotspot) => void> = new Map();
  private hoverCallbacks: Map<string, (hotspot: Hotspot) => void> = new Map();

  constructor(
    eventEmitter: EventEmitter,
    logger: Logger,
    i18n: I18nManager,
    showcaseManager: ShowcaseManager,
    interactionManager: InteractionManager
  ) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.i18n = i18n;
    this.showcaseManager = showcaseManager;
    this.interactionManager = interactionManager;
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

    if (productCoupons.length === 0) {
      this.showPopup({
        title: this.i18n.t('action.claim_coupon'),
        content: this.i18n.t('coupon.unavailable')
      });
      return;
    }

    if (productCoupons.length === 1) {
      const coupon = productCoupons[0];
      this.showPopup({
        title: this.i18n.t('action.claim_coupon'),
        content: coupon.claimed
          ? `${coupon.title}\n${this.i18n.t('coupon.already_claimed')}`
          : `${coupon.title}\n${coupon.description || ''}`,
        coupon,
        onConfirm: !coupon.claimed
          ? () => {
              this.claimCoupon(coupon.id);
            }
          : undefined
      });
    } else {
      this.showCouponListPopup(productCoupons);
    }
  }

  private showCouponListPopup(coupons: Coupon[]): void {
    if (!isBrowser()) return;
    this.closePopup();

    const uiLayer = this.showcaseManager.getUILayer();
    if (!uiLayer) return;

    const popup = document.createElement('div');
    popup.className = 'mv-popup mv-coupon-list-popup';
    popup.style.cssText = `
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: #fff;
      border-radius: 16px;
      padding: 24px;
      min-width: 320px;
      max-width: 420px;
      max-height: 70vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      z-index: 9999;
      pointer-events: auto;
    `;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 9998; pointer-events: auto;
    `;
    overlay.addEventListener('click', () => this.closePopup());

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:18px;font-weight:700;color:#333;margin-bottom:16px;';
    titleEl.textContent = this.i18n.t('action.claim_coupon');
    popup.appendChild(titleEl);

    coupons.forEach((coupon) => {
      const card = document.createElement('div');
      const isClaimed = coupon.claimed;
      const isExpired = coupon.expiryDate ? new Date(coupon.expiryDate) < new Date() : false;
      const disabled = isClaimed || isExpired;

      card.style.cssText = `
        background: ${disabled ? '#f5f5f5' : 'linear-gradient(135deg, #fff5e6, #ffe8cc)'};
        border: 2px solid ${disabled ? '#e0e0e0' : '#ff9500'};
        border-radius: 12px;
        padding: 14px 16px;
        margin-bottom: 12px;
        opacity: ${disabled ? 0.6 : 1};
      `;

      const couponTitle = document.createElement('div');
      couponTitle.style.cssText = 'font-size:15px;font-weight:600;color:#333;margin-bottom:4px;';
      couponTitle.textContent = coupon.title;
      card.appendChild(couponTitle);

      const discountText = document.createElement('div');
      discountText.style.cssText = 'font-size:13px;color:#ff6b00;margin-bottom:6px;font-weight:500;';
      discountText.textContent = coupon.discountType === 'percentage'
        ? `${100 - coupon.discountValue}% OFF`
        : coupon.discountType === 'fixed'
        ? `¥${coupon.discountValue} 优惠券`
        : '免邮券';
      card.appendChild(discountText);

      if (coupon.description) {
        const desc = document.createElement('div');
        desc.style.cssText = 'font-size:12px;color:#888;margin-bottom:8px;';
        desc.textContent = coupon.description;
        card.appendChild(desc);
      }

      const statusText = document.createElement('div');
      statusText.style.cssText = 'font-size:11px;color:#999;margin-bottom:10px;';
      if (isClaimed) {
        statusText.textContent = this.i18n.t('coupon.already_claimed');
      } else if (isExpired) {
        statusText.textContent = this.i18n.t('coupon.expired');
      } else if (coupon.expiryDate) {
        statusText.textContent = `有效期至 ${coupon.expiryDate}`;
      }
      card.appendChild(statusText);

      if (!disabled) {
        const claimBtn = document.createElement('button');
        claimBtn.style.cssText = `
          width:100%;padding:8px 12px;border:none;border-radius:8px;
          background:linear-gradient(135deg,#ff9500,#ff6b00);color:#fff;
          font-size:13px;font-weight:600;cursor:pointer;
        `;
        claimBtn.textContent = this.i18n.t('action.claim_coupon');
        claimBtn.addEventListener('click', () => {
          this.claimCoupon(coupon.id);
        });
        card.appendChild(claimBtn);
      }

      popup.appendChild(card);
    });

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      width:100%;padding:10px;margin-top:8px;border:1px solid #ddd;background:#fff;
      border-radius:8px;font-size:14px;cursor:pointer;color:#666;
    `;
    closeBtn.textContent = this.i18n.t('action.close');
    closeBtn.addEventListener('click', () => this.closePopup());
    popup.appendChild(closeBtn);

    uiLayer.appendChild(overlay);
    uiLayer.appendChild(popup);
  }

  private showGamePopup(hotspot: Hotspot): void {
    const gameId = (hotspot.metadata?.gameId as string) || (hotspot.metadata?.game as string);
    const game = gameId ? this.getGame(gameId) : this.getAllGames()[0];

    if (!game) {
      this.showPopup({
        title: this.i18n.t(`game.${hotspot.metadata?.gameType || 'lucky_draw'}`),
        content: this.i18n.t('game.lucky_draw')
      });
      return;
    }

    this.openGamePanel(game);
  }

  private openGamePanel(game: MiniGame): void {
    if (!isBrowser()) return;
    this.closePopup();

    const uiLayer = this.showcaseManager.getUILayer();
    if (!uiLayer) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:absolute;top:0;left:0;right:0;bottom:0;
      background:rgba(0,0,0,0.6);z-index:9998;pointer-events:auto;
    `;
    overlay.addEventListener('click', () => this.closePopup());

    const panel = document.createElement('div');
    panel.className = 'mv-game-panel';
    panel.style.cssText = `
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      background:#fff;border-radius:20px;padding:28px;min-width:320px;max-width:400px;
      box-shadow:0 24px 64px rgba(0,0,0,0.3);z-index:9999;pointer-events:auto;
      animation:mv-popup-in 0.3s ease;
    `;
    panel.addEventListener('click', (e) => e.stopPropagation());

    const header = document.createElement('div');
    header.style.cssText = 'text-align:center;margin-bottom:20px;';
    header.innerHTML = `
      <div style="font-size:44px;margin-bottom:8px">🎮</div>
      <div style="font-size:20px;font-weight:700;color:#333">${game.name}</div>
      <div style="font-size:13px;color:#888;margin-top:4px">${game.description || ''}</div>
    `;
    panel.appendChild(header);

    if (game.rewards && game.rewards.length > 0) {
      const rewardsWrap = document.createElement('div');
      rewardsWrap.style.cssText = `
        background:#f7f9fc;border-radius:12px;padding:14px;margin-bottom:18px;
      `;
      const rTitle = document.createElement('div');
      rTitle.style.cssText = 'font-size:13px;font-weight:600;color:#555;margin-bottom:10px;';
      rTitle.textContent = '🎁 奖品预览';
      rewardsWrap.appendChild(rTitle);

      const rList = document.createElement('div');
      rList.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
      for (const reward of game.rewards) {
        const r = document.createElement('div');
        r.style.cssText = `
          background:#fff;border:1px solid #e8ecf1;border-radius:8px;
          padding:8px 10px;font-size:12px;color:#333;
        `;
        const emoji = reward.type === 'coupon' ? '🎟️' : reward.type === 'product' ? '🛍️' : reward.type === 'points' ? '⭐' : '🏅';
        r.innerHTML = `<span style="margin-right:4px">${emoji}</span>${reward.name}`;
        rList.appendChild(r);
      }
      rewardsWrap.appendChild(rList);
      panel.appendChild(rewardsWrap);
    }

    if (game.type === 'quiz' && (game.config?.questions as unknown[])?.length) {
      const qWrap = document.createElement('div');
      qWrap.style.cssText = 'margin-bottom:18px;';
      const qs = game.config?.questions as Array<{ question: string; options: string[] }>;
      if (qs && qs[0]) {
        const qText = document.createElement('div');
        qText.style.cssText = 'font-size:14px;color:#333;font-weight:600;margin-bottom:10px;';
        qText.textContent = `❓ ${qs[0].question}`;
        qWrap.appendChild(qText);
        for (let i = 0; i < qs[0].options.length; i++) {
          const opt = document.createElement('div');
          opt.style.cssText = `
            padding:10px 12px;border:1px solid #e0e5ec;border-radius:8px;
            font-size:13px;color:#555;margin-bottom:6px;cursor:pointer;
            transition:all 0.2s;
          `;
          opt.textContent = `${String.fromCharCode(65 + i)}. ${qs[0].options[i]}`;
          opt.addEventListener('mouseenter', () => { opt.style.borderColor = '#4a90d9'; opt.style.background = '#f0f7ff'; });
          opt.addEventListener('mouseleave', () => { opt.style.borderColor = '#e0e5ec'; opt.style.background = '#fff'; });
          qWrap.appendChild(opt);
        }
      }
      panel.appendChild(qWrap);
    }

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;';

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      flex:1;padding:12px;border:1px solid #ddd;background:#fff;border-radius:10px;
      font-size:14px;color:#666;cursor:pointer;font-weight:500;
    `;
    closeBtn.textContent = this.i18n.t('action.close');
    closeBtn.addEventListener('click', () => this.closePopup());

    const playBtn = document.createElement('button');
    playBtn.style.cssText = `
      flex:1;padding:12px;border:none;background:linear-gradient(135deg,#27ae60,#2ecc71);
      color:#fff;border-radius:10px;font-size:14px;cursor:pointer;font-weight:600;
      box-shadow:0 4px 12px rgba(39,174,96,0.3);
    `;
    playBtn.textContent = '开始游戏';

    const handleComplete = () => {
      const tempReward = this.interactionManager.completeGame(game.id);
      if (tempReward) {
        const matchedCoupon = this.handleGameReward(tempReward);
        this.interactionManager.completeGame(game.id, tempReward, matchedCoupon?.id);
        this.showGameResult(tempReward);
      } else {
        this.showPopup({
          title: '游戏完成',
          content: '感谢参与！'
        });
      }
    };

    playBtn.addEventListener('click', async () => {
      await this.interactionManager.startGame(game.id);
      playBtn.disabled = true;
      playBtn.textContent = '游戏进行中...';

      setTimeout(() => {
        handleComplete();
      }, 1200);
    });

    btnRow.appendChild(closeBtn);
    btnRow.appendChild(playBtn);
    panel.appendChild(btnRow);

    uiLayer.appendChild(overlay);
    uiLayer.appendChild(panel);
  }

  private handleGameReward(reward: GameReward): Coupon | null {
    if (reward.type !== 'coupon') return null;

    let coupon: Coupon | undefined;
    let matchedCouponId: string | undefined;

    if (typeof reward.value === 'string') {
      coupon = this.getCoupon(reward.value);
      if (coupon) matchedCouponId = coupon.id;
    }

    if (!coupon) {
      coupon = this.matchCouponByReward(reward);
      if (coupon) matchedCouponId = coupon.id;
    }

    if (!coupon) {
      coupon = this.createTemporaryRewardCoupon(reward);
      matchedCouponId = coupon.id;
    }

    if (!coupon.claimed) {
      coupon.claimed = true;
      coupon.claimedAt = Date.now();
      coupon.source = 'game_reward';
      this.eventEmitter.emit(InteractionEventType.COUPON_CLAIM, {
        couponId: coupon.id,
        couponTitle: coupon.title,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        fromGame: true,
        actionCategory: 'benefit'
      });
    }

    this.interactionManager.recordCouponClaim(coupon.id, coupon);
    const progress = this.interactionManager.getVisitProgress();
    if (progress) {
      const gameRecord = progress.playedGameRecords[progress.playedGameRecords.length - 1];
      if (gameRecord) gameRecord.matchedCouponId = matchedCouponId;
    }

    return coupon;
  }

  private matchCouponByReward(reward: GameReward): Coupon | undefined {
    const all = this.getAllCoupons();
    const byName = all.find(
      (c) => !c.claimed && (c.title === reward.name || c.title.includes(reward.name))
    );
    if (byName) return byName;

    if (typeof reward.value === 'number') {
      const byValue = all.find((c) => !c.claimed && c.discountValue === reward.value);
      if (byValue) return byValue;
    }

    const numericFromName = parseFloat(reward.name.replace(/[^\d.]/g, ''));
    if (!isNaN(numericFromName)) {
      const byParsed = all.find((c) => !c.claimed && c.discountValue === numericFromName);
      if (byParsed) return byParsed;
    }
    return undefined;
  }

  private createTemporaryRewardCoupon(reward: GameReward): Coupon {
    const couponId = `tmp_${generateId('reward')}`;
    let discountType: Coupon['discountType'] = 'fixed';
    let discountValue = 0;
    if (typeof reward.value === 'number') {
      discountValue = reward.value;
    } else if (typeof reward.value === 'string') {
      const parsed = parseFloat(reward.value.replace(/[^\d.]/g, ''));
      if (!isNaN(parsed)) discountValue = parsed;
      if (reward.value.includes('折') || reward.value.includes('%')) discountType = 'percentage';
    }
    const coupon: Coupon = {
      id: couponId,
      title: reward.name,
      description: `游戏奖励：${reward.name}`,
      discountType,
      discountValue: discountValue || 10,
      isTemporary: true,
      source: 'temporary_reward',
      claimed: true,
      claimedAt: Date.now()
    };
    this.coupons.set(couponId, coupon);
    this.logger.log(`HotspotManager: Created temporary reward coupon ${couponId} (${coupon.title})`);
    return coupon;
  }

  private showGameResult(reward: GameReward): void {
    const emoji = reward.type === 'coupon' ? '🎟️' : reward.type === 'product' ? '🛍️' : reward.type === 'points' ? '⭐' : '🏅';
    this.showPopup({
      title: `🎉 恭喜获得`,
      content: `${emoji} ${reward.name}`
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
    onSecondary?: { label: string; action: () => void };
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

    if (options.onSecondary) {
      const secBtn = document.createElement('button');
      secBtn.style.cssText = `
        padding: 10px 14px;
        border: 1px solid #4a90d9;
        background: #fff;
        color: #4a90d9;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      `;
      secBtn.textContent = options.onSecondary.label;
      secBtn.addEventListener('click', () => {
        options.onSecondary?.action();
      });
      btnWrap.appendChild(secBtn);
    }

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
    const progress = this.interactionManager.getVisitProgress();
    const isClaimedInProgress = progress?.claimedCoupons.includes(coupon.id);
    const stored = this.coupons.get(coupon.id);
    const finalCoupon: Coupon = {
      ...coupon,
      claimed: stored?.claimed || coupon.claimed || isClaimedInProgress || false,
      claimedAt: stored?.claimedAt || coupon.claimedAt
    };
    this.coupons.set(coupon.id, finalCoupon);

    if (finalCoupon.claimed && !stored?.claimed) {
      this.interactionManager.recordCouponClaim(coupon.id, finalCoupon);
    }
    this.logger.log(
      `HotspotManager: Coupon ${coupon.id} added (claimed=${finalCoupon.claimed}, syncedFromProgress=${isClaimedInProgress})`
    );
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
    coupon.claimedAt = Date.now();
    if (!coupon.source) coupon.source = 'coupon_hotspot';

    this.eventEmitter.emit(InteractionEventType.COUPON_CLAIM, {
      couponId,
      couponTitle: coupon.title,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      source: coupon.source,
      actionCategory: 'benefit'
    });

    this.showPopup({
      title: this.i18n.t('coupon.claimed'),
      content: coupon.title
    });

    this.interactionManager.recordCouponClaim(couponId, coupon);

    this.logger.log(`HotspotManager: Coupon ${couponId} claimed successfully`);
    return { ...coupon };
  }

  addGame(game: MiniGame): void {
    this.games.set(game.id, game);
    this.interactionManager.addGame(game);
  }

  addGames(games: MiniGame[]): void {
    games.forEach((g) => this.addGame(g));
  }

  getGame(gameId: string): MiniGame | undefined {
    return this.interactionManager.getGame(gameId) || this.games.get(gameId);
  }

  getAllGames(): MiniGame[] {
    const fromInteraction = this.interactionManager.getAllGames();
    if (fromInteraction.length > 0) return fromInteraction;
    return Array.from(this.games.values());
  }

  syncClaimedCoupons(couponIds: string[]): void {
    for (const couponId of couponIds) {
      const coupon = this.coupons.get(couponId);
      if (coupon && !coupon.claimed) {
        coupon.claimed = true;
        coupon.claimedAt = coupon.claimedAt || Date.now();
        if (!coupon.source) coupon.source = 'coupon_hotspot';
        this.interactionManager.recordCouponClaim(couponId, coupon);
      }
    }
    this.eventEmitter.emit(InteractionEventType.BENEFIT_RESTORED, {
      restoredCouponCount: couponIds.length,
      actionCategory: 'benefit'
    });
    this.logger.log(`HotspotManager: Synced ${couponIds.length} claimed coupons`);
  }

  removeCoupon(couponId: string): boolean {
    return this.coupons.delete(couponId);
  }

  openPurchaseEntry(productId?: string, benefitCenter?: { openFromPurchase: (cb: (id: string | undefined) => void) => void }): void {
    const progress = this.interactionManager.getVisitProgress();
    const claimedCoupons = progress?.claimedCoupons || [];
    const selectedCouponId = this.interactionManager.getSelectedCouponId();
    const sessionId = progress?.sessionId || this.interactionManager.getActiveSessionId() || '';
    const product = productId ? this.showcaseManager.getProduct(productId) : undefined;
    const selectedCoupon = selectedCouponId ? this.getCoupon(selectedCouponId) : undefined;

    const purchaseData: Record<string, unknown> = {
      productId,
      productName: product?.name,
      productPrice: product?.price,
      currency: product?.currency,
      claimedCoupons,
      selectedCouponId,
      selectedCouponTitle: selectedCoupon?.title,
      selectedCouponDiscountType: selectedCoupon?.discountType,
      selectedCouponDiscountValue: selectedCoupon?.discountValue,
      sessionId,
      timestamp: Date.now()
    };

    this.eventEmitter.emit(InteractionEventType.PURCHASE_INTENT, purchaseData);

    const couponInfo = claimedCoupons.length > 0
      ? `\n\n已领优惠券: ${claimedCoupons.length}张`
      : '';
    const selectedInfo = selectedCoupon
      ? `\n当前选择: ${selectedCoupon.title}${selectedCoupon.discountType === 'percentage' ? ` (${selectedCoupon.discountValue}折)` : selectedCoupon.discountType === 'fixed' ? ` (-¥${selectedCoupon.discountValue})` : ''}`
      : claimedCoupons.length > 0
        ? '\n当前选择: 不使用优惠券'
        : '';

    this.showPopup({
      title: this.i18n.t('action.buy_now'),
      content: product
        ? `${product.name}\n${product.currency || '¥'}${product.price}${couponInfo}${selectedInfo}\n\nsessionId: ${sessionId.substring(0, 12)}...`
        : `${this.i18n.t('action.buy_now')}${couponInfo}${selectedInfo}`,
      productId,
      onConfirm: () => {
        this.eventEmitter.emit(InteractionEventType.PURCHASE_INTENT, {
          ...purchaseData,
          confirmed: true
        });
      },
      onSecondary: benefitCenter
        ? {
            label: '🎟️ 选择优惠券',
            action: () => benefitCenter.openFromPurchase((_cid) => {
              this.openPurchaseEntry(productId, benefitCenter);
            })
          }
        : undefined
    });

    this.logger.log(
      `HotspotManager: Purchase entry opened${productId ? ` for product ${productId}` : ''}, ` +
      `coupons: ${claimedCoupons.length}, selected: ${selectedCouponId || 'none'}, session: ${sessionId.substring(0, 8)}`
    );
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
