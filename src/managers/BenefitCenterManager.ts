import {
  BenefitItem,
  BenefitType,
  BenefitState,
  Coupon,
  InteractionEventType,
  PlayedGameRecord
} from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';
import { I18nManager } from './I18nManager';
import { ShowcaseManager } from './ShowcaseManager';
import { HotspotManager } from './HotspotManager';
import { InteractionManager } from './InteractionManager';
import { isBrowser } from '../utils/helpers';

type BenefitPanelTab = 'coupons' | 'games' | 'tour';

export class BenefitCenterManager {
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private showcaseManager: ShowcaseManager;
  private hotspotManager: HotspotManager;
  private interactionManager: InteractionManager;
  private currentEntry?: 'product_detail' | 'purchase' | 'game_result' | 'direct';
  private activePanel?: HTMLElement;
  private activeOverlay?: HTMLElement;
  private onCouponSelectedCallback?: (couponId: string | undefined) => void;
  private initialized: boolean = false;

  constructor(
    eventEmitter: EventEmitter,
    logger: Logger,
    _i18n: I18nManager,
    showcaseManager: ShowcaseManager,
    hotspotManager: HotspotManager,
    interactionManager: InteractionManager
  ) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.showcaseManager = showcaseManager;
    this.hotspotManager = hotspotManager;
    this.interactionManager = interactionManager;
    this.initialized = true;
    this.logger.log('BenefitCenterManager: Initialized');
  }

  openBenefitCenter(
    entry: BenefitPanelTab | 'product_detail' | 'purchase' | 'game_result' | 'direct' = 'direct',
    onCouponSelected?: (couponId: string | undefined) => void
  ): void {
    if (!this.initialized || !isBrowser()) return;
    this.closePanel();

    let defaultTab: BenefitPanelTab = 'coupons';
    if (entry === 'games' || entry === 'game_result') defaultTab = 'games';
    if (entry === 'tour') defaultTab = 'tour';
    if (entry === 'coupons' || entry === 'product_detail' || entry === 'purchase' || entry === 'direct') defaultTab = 'coupons';

    this.currentEntry = entry === 'coupons' || entry === 'games' || entry === 'tour' ? 'direct' : entry;
    this.onCouponSelectedCallback = onCouponSelected;

    const uiLayer = this.showcaseManager.getUILayer();
    if (!uiLayer) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:absolute;top:0;left:0;right:0;bottom:0;
      background:rgba(0,0,0,0.55);z-index:9996;pointer-events:auto;
    `;
    overlay.addEventListener('click', () => this.closePanel());
    this.activeOverlay = overlay;

    const panel = document.createElement('div');
    panel.style.cssText = `
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      background:#fff;border-radius:18px;padding:24px;width:440px;max-width:90%;max-height:78vh;
      box-shadow:0 24px 64px rgba(0,0,0,0.3);z-index:9997;pointer-events:auto;
      display:flex;flex-direction:column;
    `;
    panel.addEventListener('click', (e) => e.stopPropagation());
    this.activePanel = panel;

    const header = this.renderHeader(entry);
    panel.appendChild(header);

    const tabs = this.renderTabs(defaultTab);
    panel.appendChild(tabs);

    const content = document.createElement('div');
    content.style.cssText = 'overflow-y:auto;margin-top:14px;flex:1;padding-right:4px;';
    panel.appendChild(content);

    this.renderTabContent(defaultTab, content, entry === 'purchase');

    uiLayer.appendChild(overlay);
    uiLayer.appendChild(panel);

    this.eventEmitter.emit(InteractionEventType.BENEFIT_CENTER_OPEN, {
      entry: this.currentEntry,
      initialTab: defaultTab,
      actionCategory: 'benefit'
    });
    this.logger.log(`BenefitCenterManager: Opened from ${this.currentEntry}, tab=${defaultTab}`);
  }

  private renderHeader(entry: string): HTMLElement {
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:20px;font-weight:700;color:#222;';
    const titleMap: Record<string, string> = {
      product_detail: '商品权益',
      purchase: '选择可用优惠券',
      game_result: '我的奖励',
      direct: '会员权益中心',
      coupons: '会员权益中心',
      games: '会员权益中心',
      tour: '会员权益中心'
    };
    title.textContent = `🎁 ${titleMap[entry] || '会员权益中心'}`;
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      width:32px;height:32px;border:none;background:#f3f4f6;border-radius:50%;
      font-size:16px;color:#666;cursor:pointer;display:flex;align-items:center;justify-content:center;
    `;
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.closePanel());
    header.appendChild(closeBtn);

    return header;
  }

  private renderTabs(defaultTab: BenefitPanelTab): HTMLElement {
    const tabsWrap = document.createElement('div');
    tabsWrap.style.cssText = `
      display:flex;background:#f4f5f7;border-radius:10px;padding:4px;margin-top:14px;
    `;
    const tabDefs: { key: BenefitPanelTab; label: string; icon: string }[] = [
      { key: 'coupons', label: '优惠券', icon: '🎟️' },
      { key: 'games', label: '游戏奖励', icon: '🎮' },
      { key: 'tour', label: '导览奖励', icon: '🧭' }
    ];

    const activateTab = (key: BenefitPanelTab) => {
      const buttons = tabsWrap.querySelectorAll<HTMLButtonElement>('button');
      buttons.forEach((b) => {
        const isActive = b.dataset.tab === key;
        b.style.background = isActive ? '#fff' : 'transparent';
        b.style.color = isActive ? '#222' : '#888';
        b.style.fontWeight = isActive ? '700' : '500';
        b.style.boxShadow = isActive ? '0 2px 8px rgba(0,0,0,0.08)' : 'none';
      });
      const content = this.activePanel?.querySelector('div[role="tabpanel"]') as HTMLElement | null;
      if (content) {
        this.renderTabContent(key, content, this.currentEntry === 'purchase');
      }
    };

    for (const tab of tabDefs) {
      const btn = document.createElement('button');
      btn.dataset.tab = tab.key;
      btn.style.cssText = `
        flex:1;padding:8px 10px;border:none;border-radius:8px;background:transparent;
        font-size:13px;color:#888;cursor:pointer;font-weight:500;transition:all 0.2s;
      `;
      btn.textContent = `${tab.icon} ${tab.label}`;
      btn.addEventListener('click', () => activateTab(tab.key));
      tabsWrap.appendChild(btn);
    }

    setTimeout(() => activateTab(defaultTab), 0);
    return tabsWrap;
  }

  private renderTabContent(tab: BenefitPanelTab, container: HTMLElement, showCouponSelect: boolean): void {
    container.innerHTML = '';
    container.setAttribute('role', 'tabpanel');

    const allBenefits = this.interactionManager.getAllBenefits();
    if (tab === 'coupons') {
      this.renderCouponList(container, showCouponSelect);
    } else if (tab === 'games') {
      this.renderGameRewards(container, allBenefits.filter((b) => b.type === BenefitType.GAME_REWARD));
    } else if (tab === 'tour') {
      this.renderTourRewards(container, allBenefits.filter((b) => b.type === BenefitType.TOUR_REWARD));
    }
  }

  private renderCouponList(container: HTMLElement, showCouponSelect: boolean): void {
    const coupons = this.hotspotManager.getAllCoupons().filter((c) => c.claimed);
    const selectedId = this.interactionManager.getSelectedCouponId();

    if (coupons.length === 0) {
      container.innerHTML = `
        <div style="padding:40px 0;text-align:center;color:#999;font-size:14px">
          <div style="font-size:44px;margin-bottom:10px">🎟️</div>
          还没有可用的优惠券<br/>去逛逛，领几张吧~
        </div>
      `;
      return;
    }

    for (const coupon of coupons) {
      const card = this.renderCouponCard(coupon, selectedId === coupon.id, showCouponSelect);
      container.appendChild(card);
    }

    if (showCouponSelect) {
      const noUseBtn = document.createElement('button');
      noUseBtn.style.cssText = `
        width:100%;margin-top:14px;padding:12px;border:1px dashed #ccc;background:#fff;
        color:#666;border-radius:10px;cursor:pointer;font-size:13px;
      `;
      noUseBtn.textContent = selectedId === undefined ? '✓ 不使用优惠券' : '不使用优惠券';
      if (selectedId === undefined) {
        noUseBtn.style.background = '#f0f7ff';
        noUseBtn.style.borderColor = '#4a90d9';
        noUseBtn.style.color = '#4a90d9';
      }
      noUseBtn.addEventListener('click', () => {
        this.interactionManager.selectCoupon(undefined);
        this.onCouponSelectedCallback?.(undefined);
        if (this.currentEntry === 'purchase') {
          this.closePanel();
        } else {
          this.renderTabContent('coupons', container, showCouponSelect);
        }
      });
      container.appendChild(noUseBtn);
    }
  }

  private renderCouponCard(coupon: Coupon, isSelected: boolean, showCouponSelect: boolean): HTMLElement {
    const card = document.createElement('div');
    const isSelectedStyle = isSelected
      ? 'border:2px solid #4a90d9;background:#f0f7ff;box-shadow:0 4px 14px rgba(74,144,217,0.2);'
      : 'border:1px solid #ececf0;background:#fff;';
    card.style.cssText = `
      ${isSelectedStyle}border-radius:12px;padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:14px;
      transition:all 0.2s;cursor:${showCouponSelect ? 'pointer' : 'default'};
    `;

    const leftTag = document.createElement('div');
    const isPercent = coupon.discountType === 'percentage';
    leftTag.style.cssText = `
      background:linear-gradient(135deg,#ff6b35,#f7931e);color:#fff;border-radius:10px;
      padding:10px 12px;min-width:68px;text-align:center;
    `;
    leftTag.innerHTML = `
      <div style="font-size:20px;font-weight:800;line-height:1">
        ${isPercent ? coupon.discountValue : `¥${coupon.discountValue}`}
      </div>
      <div style="font-size:11px;margin-top:2px;opacity:0.9">
        ${isPercent ? '折扣' : coupon.discountType === 'shipping' ? '包邮' : '立减'}
      </div>
    `;
    card.appendChild(leftTag);

    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0;';
    info.innerHTML = `
      <div style="font-size:14px;font-weight:700;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${coupon.title}</div>
      <div style="font-size:12px;color:#888;margin-top:3px">
        ${coupon.minPurchaseAmount ? `满 ¥${coupon.minPurchaseAmount} 可用` : '无门槛使用'}
        ${coupon.expiryDate ? ` · ${coupon.expiryDate}` : ''}
      </div>
      ${coupon.isTemporary ? '<div style="font-size:11px;color:#f7931e;margin-top:3px">⚡ 奖励券</div>' : ''}
    `;
    card.appendChild(info);

    if (showCouponSelect) {
      const radio = document.createElement('div');
      radio.style.cssText = `
        width:22px;height:22px;border-radius:50%;border:2px solid ${isSelected ? '#4a90d9' : '#ccc'};
        display:flex;align-items:center;justify-content:center;
      `;
      if (isSelected) {
        radio.innerHTML = '<div style="width:10px;height:10px;border-radius:50%;background:#4a90d9"></div>';
      }
      card.appendChild(radio);

      card.addEventListener('click', () => {
        this.interactionManager.selectCoupon(coupon.id);
        this.onCouponSelectedCallback?.(coupon.id);
        if (this.currentEntry === 'purchase') {
          this.closePanel();
        } else {
          const parent = card.parentElement;
          if (parent) this.renderTabContent('coupons', parent, true);
        }
      });
    }

    return card;
  }

  private renderGameRewards(container: HTMLElement, benefits: BenefitItem[]): void {
    const records = this.interactionManager.getPlayedGameRecords();
    if (benefits.length === 0 && records.length === 0) {
      container.innerHTML = `
        <div style="padding:40px 0;text-align:center;color:#999;font-size:14px">
          <div style="font-size:44px;margin-bottom:10px">🎮</div>
          还没有游戏奖励<br/>去玩小游戏，赢取奖品吧~
        </div>
      `;
      return;
    }

    for (const record of records) {
      const rewardBenefit = benefits.find((b) => b.metadata?.gameId === record.gameId);
      const card = this.renderGameRecordCard(record, rewardBenefit);
      container.appendChild(card);
    }
  }

  private renderGameRecordCard(record: PlayedGameRecord, benefit?: BenefitItem): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = `
      border:1px solid #ececf0;background:#fff;border-radius:12px;padding:14px;margin-bottom:10px;
    `;
    const time = record.completedAt ? new Date(record.completedAt).toLocaleString() : new Date(record.startedAt).toLocaleString();
    const rewardText = record.completed && benefit
      ? `${benefit.icon || '🎁'} ${benefit.title}`
      : record.completed
        ? '已完成'
        : '进行中';
    const statusColor = record.completed ? '#27ae60' : '#f39c12';
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-size:14px;font-weight:700;color:#222">🎮 小游戏</div>
        <div style="font-size:12px;color:${statusColor};font-weight:600">
          ${record.completed ? '✓ 已完成' : '⏳ 进行中'}
        </div>
      </div>
      <div style="font-size:13px;color:#555;margin-top:4px">${rewardText}</div>
      <div style="font-size:11px;color:#999;margin-top:6px">${time}</div>
    `;
    return card;
  }

  private renderTourRewards(container: HTMLElement, benefits: BenefitItem[]): void {
    if (benefits.length === 0) {
      container.innerHTML = `
        <div style="padding:40px 0;text-align:center;color:#999;font-size:14px">
          <div style="font-size:44px;margin-bottom:10px">🧭</div>
          还没有导览奖励<br/>完成参观导览，解锁专属福利~
        </div>
      `;
      return;
    }
    for (const b of benefits) {
      const card = document.createElement('div');
      card.style.cssText = `
        border:1px solid #ececf0;background:#fff;border-radius:12px;padding:14px;margin-bottom:10px;
      `;
      card.innerHTML = `
        <div style="font-size:14px;font-weight:700;color:#222">${b.icon || '🧭'} ${b.title}</div>
        ${b.description ? `<div style="font-size:12px;color:#888;margin-top:4px">${b.description}</div>` : ''}
        <div style="font-size:11px;color:#999;margin-top:6px">${new Date(b.acquiredAt).toLocaleString()}</div>
      `;
      container.appendChild(card);
    }
  }

  closePanel(): void {
    if (this.activePanel) {
      this.activePanel.remove();
      this.activePanel = undefined;
    }
    if (this.activeOverlay) {
      this.activeOverlay.remove();
      this.activeOverlay = undefined;
    }
    if (this.currentEntry) {
      this.eventEmitter.emit(InteractionEventType.BENEFIT_CENTER_CLOSE, {
        entry: this.currentEntry,
        actionCategory: 'benefit'
      });
    }
    this.currentEntry = undefined;
    this.onCouponSelectedCallback = undefined;
  }

  getBenefitState(): BenefitState {
    const claimedCoupons = this.hotspotManager.getAllCoupons().filter((c) => c.claimed);
    return {
      coupons: claimedCoupons,
      benefits: this.interactionManager.getAllBenefits(),
      playedGameRecords: this.interactionManager.getPlayedGameRecords(),
      selectedCouponId: this.interactionManager.getSelectedCouponId()
    };
  }

  openFromGameResult(): void {
    this.openBenefitCenter('game_result');
  }

  openFromPurchase(onSelected?: (couponId: string | undefined) => void): void {
    this.openBenefitCenter('purchase', onSelected);
  }

  openFromProductDetail(): void {
    this.openBenefitCenter('product_detail');
  }

  destroy(): void {
    this.closePanel();
    this.initialized = false;
    this.logger.log('BenefitCenterManager: Destroyed');
  }
}
