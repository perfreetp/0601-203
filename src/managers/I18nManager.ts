import { Language, InteractionEventType, SubtitleConfig } from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';

const DEFAULT_TRANSLATIONS: Record<Language, Record<string, string>> = {
  [Language.ZH_CN]: {
    'greeting.default': '欢迎光临！很高兴为您服务。',
    'greeting.product': '让我为您介绍这款产品。',
    'action.click_to_view': '点击查看详情',
    'action.buy_now': '立即购买',
    'action.add_to_cart': '加入购物车',
    'action.claim_coupon': '领取优惠券',
    'action.share': '分享',
    'action.screenshot': '截图',
    'action.close': '关闭',
    'action.confirm': '确认',
    'action.cancel': '取消',
    'hotspot.product': '商品',
    'hotspot.info': '信息',
    'hotspot.coupon': '优惠券',
    'hotspot.game': '小游戏',
    'hotspot.purchase': '购买',
    'hotspot.link': '链接',
    'game.lucky_draw': '幸运抽奖',
    'game.quiz': '知识问答',
    'game.puzzle': '拼图游戏',
    'game.catch': '抓娃娃',
    'game.scratch': '刮刮乐',
    'feedback.rating': '请为本次体验评分',
    'feedback.comment': '留下您的宝贵意见',
    'feedback.submit': '提交反馈',
    'feedback.thank_you': '感谢您的反馈！',
    'coupon.claimed': '优惠券领取成功！',
    'coupon.expired': '优惠券已过期',
    'coupon.unavailable': '优惠券已领完',
    'loading.scene': '正在加载场景...',
    'loading.product': '正在加载商品...',
    'loading.avatar': '正在加载数字人...',
    'loading.complete': '加载完成',
    'error.load_failed': '加载失败，请重试',
    'error.network': '网络错误，请检查网络连接',
    'error.unsupported': '您的设备不支持此功能',
    'share.poster_title': '虚拟展柜',
    'share.invite_text': '邀请您一起参观虚拟展柜',
    'subtitle.default': ''
  },
  [Language.ZH_TW]: {
    'greeting.default': '歡迎光臨！很高興為您服務。',
    'greeting.product': '讓我為您介紹這款產品。',
    'action.click_to_view': '點擊查看詳情',
    'action.buy_now': '立即購買',
    'action.add_to_cart': '加入購物車',
    'action.claim_coupon': '領取優惠券',
    'action.share': '分享',
    'action.screenshot': '截圖',
    'action.close': '關閉',
    'action.confirm': '確認',
    'action.cancel': '取消',
    'hotspot.product': '商品',
    'hotspot.info': '資訊',
    'hotspot.coupon': '優惠券',
    'hotspot.game': '小遊戲',
    'hotspot.purchase': '購買',
    'hotspot.link': '連結',
    'game.lucky_draw': '幸運抽獎',
    'game.quiz': '知識問答',
    'game.puzzle': '拼圖遊戲',
    'game.catch': '抓娃娃',
    'game.scratch': '刮刮樂',
    'feedback.rating': '請為本次體驗評分',
    'feedback.comment': '留下您的寶貴意見',
    'feedback.submit': '提交回饋',
    'feedback.thank_you': '感謝您的回饋！',
    'coupon.claimed': '優惠券領取成功！',
    'coupon.expired': '優惠券已過期',
    'coupon.unavailable': '優惠券已領完',
    'loading.scene': '正在載入場景...',
    'loading.product': '正在載入商品...',
    'loading.avatar': '正在載入數字人...',
    'loading.complete': '載入完成',
    'error.load_failed': '載入失敗，請重試',
    'error.network': '網路錯誤，請檢查網路連線',
    'error.unsupported': '您的裝置不支援此功能',
    'share.poster_title': '虛擬展櫃',
    'share.invite_text': '邀請您一起參觀虛擬展櫃',
    'subtitle.default': ''
  },
  [Language.EN_US]: {
    'greeting.default': 'Welcome! I am happy to assist you.',
    'greeting.product': 'Let me introduce this product to you.',
    'action.click_to_view': 'Click to view details',
    'action.buy_now': 'Buy Now',
    'action.add_to_cart': 'Add to Cart',
    'action.claim_coupon': 'Claim Coupon',
    'action.share': 'Share',
    'action.screenshot': 'Screenshot',
    'action.close': 'Close',
    'action.confirm': 'Confirm',
    'action.cancel': 'Cancel',
    'hotspot.product': 'Product',
    'hotspot.info': 'Info',
    'hotspot.coupon': 'Coupon',
    'hotspot.game': 'Game',
    'hotspot.purchase': 'Purchase',
    'hotspot.link': 'Link',
    'game.lucky_draw': 'Lucky Draw',
    'game.quiz': 'Quiz',
    'game.puzzle': 'Puzzle',
    'game.catch': 'Claw Machine',
    'game.scratch': 'Scratch Card',
    'feedback.rating': 'Please rate your experience',
    'feedback.comment': 'Leave your valuable comments',
    'feedback.submit': 'Submit Feedback',
    'feedback.thank_you': 'Thank you for your feedback!',
    'coupon.claimed': 'Coupon claimed successfully!',
    'coupon.expired': 'Coupon has expired',
    'coupon.unavailable': 'Coupon is no longer available',
    'loading.scene': 'Loading scene...',
    'loading.product': 'Loading product...',
    'loading.avatar': 'Loading avatar...',
    'loading.complete': 'Loading complete',
    'error.load_failed': 'Failed to load, please try again',
    'error.network': 'Network error, please check your connection',
    'error.unsupported': 'Your device does not support this feature',
    'share.poster_title': 'Virtual Showcase',
    'share.invite_text': 'Invite you to visit the virtual showcase',
    'subtitle.default': ''
  },
  [Language.JA_JP]: {
    'greeting.default': 'ようこそ！ご案内いたします。',
    'greeting.product': 'この製品をご紹介いたします。',
    'action.click_to_view': 'クリックして詳細を見る',
    'action.buy_now': '今すぐ購入',
    'action.add_to_cart': 'カートに追加',
    'action.claim_coupon': 'クーポンを受け取る',
    'action.share': 'シェア',
    'action.screenshot': 'スクリーンショット',
    'action.close': '閉じる',
    'action.confirm': '確認',
    'action.cancel': 'キャンセル',
    'hotspot.product': '商品',
    'hotspot.info': '情報',
    'hotspot.coupon': 'クーポン',
    'hotspot.game': 'ゲーム',
    'hotspot.purchase': '購入',
    'hotspot.link': 'リンク',
    'game.lucky_draw': '幸運抽選',
    'game.quiz': 'クイズ',
    'game.puzzle': 'パズル',
    'game.catch': 'クレーンゲーム',
    'game.scratch': 'スクラッチカード',
    'feedback.rating': '体験を評価してください',
    'feedback.comment': '貴重なご意見をお聞かせください',
    'feedback.submit': 'フィードバックを送信',
    'feedback.thank_you': 'フィードバックありがとうございます！',
    'coupon.claimed': 'クーポンを取得しました！',
    'coupon.expired': 'クーポンは期限切れです',
    'coupon.unavailable': 'クーポンは利用できません',
    'loading.scene': 'シーンを読み込み中...',
    'loading.product': '商品を読み込み中...',
    'loading.avatar': 'アバターを読み込み中...',
    'loading.complete': '読み込み完了',
    'error.load_failed': '読み込みに失敗しました。もう一度お試しください',
    'error.network': 'ネットワークエラー。接続を確認してください',
    'error.unsupported': 'お使いのデバイスはこの機能に対応していません',
    'share.poster_title': 'バーチャルショーケース',
    'share.invite_text': 'バーチャルショーケースへのご招待',
    'subtitle.default': ''
  },
  [Language.KO_KR]: {
    'greeting.default': '어서 오세요! 기꺼이 도와드리겠습니다.',
    'greeting.product': '이 제품을 소개해 드리겠습니다.',
    'action.click_to_view': '클릭하여 자세히 보기',
    'action.buy_now': '지금 구매',
    'action.add_to_cart': '장바구니에 추가',
    'action.claim_coupon': '쿠폰 받기',
    'action.share': '공유',
    'action.screenshot': '스크린샷',
    'action.close': '닫기',
    'action.confirm': '확인',
    'action.cancel': '취소',
    'hotspot.product': '상품',
    'hotspot.info': '정보',
    'hotspot.coupon': '쿠폰',
    'hotspot.game': '게임',
    'hotspot.purchase': '구매',
    'hotspot.link': '링크',
    'game.lucky_draw': '행운 추첨',
    'game.quiz': '퀴즈',
    'game.puzzle': '퍼즐',
    'game.catch': '인형뽑기',
    'game.scratch': '스크래치 카드',
    'feedback.rating': '경험을 평가해 주세요',
    'feedback.comment': '소중한 의견을 남겨 주세요',
    'feedback.submit': '피드백 제출',
    'feedback.thank_you': '피드백 감사합니다!',
    'coupon.claimed': '쿠폰이 성공적으로 발급되었습니다!',
    'coupon.expired': '쿠폰이 만료되었습니다',
    'coupon.unavailable': '쿠폰을 더 이상 사용할 수 없습니다',
    'loading.scene': '장면 로딩 중...',
    'loading.product': '상품 로딩 중...',
    'loading.avatar': '아바타 로딩 중...',
    'loading.complete': '로딩 완료',
    'error.load_failed': '로드에 실패했습니다. 다시 시도해 주세요',
    'error.network': '네트워크 오류. 연결을 확인해 주세요',
    'error.unsupported': '기기가 이 기능을 지원하지 않습니다',
    'share.poster_title': '가상 쇼케이스',
    'share.invite_text': '가상 쇼케이스에 초대합니다',
    'subtitle.default': ''
  }
};

export class I18nManager {
  private currentLanguage: Language;
  private customTranslations: Map<Language, Record<string, string>> = new Map();
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private activeSubtitle?: SubtitleConfig;
  private subtitleListeners: Array<(subtitle: SubtitleConfig | undefined) => void> = [];

  constructor(
    initialLanguage: Language = Language.ZH_CN,
    eventEmitter: EventEmitter,
    logger: Logger
  ) {
    this.currentLanguage = initialLanguage;
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.logger.log(`I18nManager initialized with language: ${initialLanguage}`);
  }

  getLanguage(): Language {
    return this.currentLanguage;
  }

  setLanguage(language: Language): void {
    if (this.currentLanguage !== language) {
      const oldLanguage = this.currentLanguage;
      this.currentLanguage = language;
      this.logger.log(`Language changed from ${oldLanguage} to ${language}`);
      this.eventEmitter.emit(InteractionEventType.LANGUAGE_CHANGE, {
        oldLanguage,
        newLanguage: language
      });
    }
  }

  addTranslations(language: Language, translations: Record<string, string>): void {
    const existing = this.customTranslations.get(language) || {};
    this.customTranslations.set(language, { ...existing, ...translations });
    this.logger.log(`Added ${Object.keys(translations).length} translations for ${language}`);
  }

  t(key: string, params?: Record<string, string | number>): string {
    const custom = this.customTranslations.get(this.currentLanguage);
    const defaultTranslations = DEFAULT_TRANSLATIONS[this.currentLanguage];
    const fallback = DEFAULT_TRANSLATIONS[Language.ZH_CN];

    let text = custom?.[key] ?? defaultTranslations?.[key] ?? fallback?.[key] ?? key;

    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      }
    }

    return text;
  }

  setSubtitle(subtitle?: SubtitleConfig): void {
    if (subtitle && subtitle.language !== this.currentLanguage) {
      this.logger.debug(`Subtitle language ${subtitle.language} does not match current ${this.currentLanguage}`);
    }
    this.activeSubtitle = subtitle;
    this.notifySubtitleListeners();
  }

  getSubtitle(): SubtitleConfig | undefined {
    return this.activeSubtitle;
  }

  clearSubtitle(): void {
    this.activeSubtitle = undefined;
    this.notifySubtitleListeners();
  }

  onSubtitleChange(callback: (subtitle: SubtitleConfig | undefined) => void): () => void {
    this.subtitleListeners.push(callback);
    return () => {
      this.subtitleListeners = this.subtitleListeners.filter((l) => l !== callback);
    };
  }

  private notifySubtitleListeners(): void {
    this.subtitleListeners.forEach((callback) => {
      try {
        callback(this.activeSubtitle);
      } catch (error) {
        this.logger.error('Error in subtitle listener:', error);
      }
    });
  }

  getSupportedLanguages(): Language[] {
    return Object.values(Language);
  }

  isLanguageSupported(language: Language): boolean {
    return Object.values(Language).includes(language);
  }

  destroy(): void {
    this.subtitleListeners = [];
    this.customTranslations.clear();
  }
}
