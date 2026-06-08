import {
  SDKConfig,
  SDKState,
  SceneTheme,
  Language,
  PerformanceLevel,
  InteractionEventType,
  EventCallback,
  Product,
  ProductDescription,
  AvatarConfig,
  AvatarGesture,
  AnimationConfig,
  VoicePlaybackConfig,
  HotspotConfig,
  Hotspot,
  HotspotType,
  Coupon,
  CameraConfig,
  LightPreset,
  LightConfig,
  Vector3,
  CustomThemeConfig,
  MiniGame,
  SharePosterConfig,
  ScreenshotConfig,
  ScreenshotResult,
  ShareData,
  UserFeedback,
  VisitProgress,
  TourConfig,
  TourStep,
  TourState,
  TourStepProgress,
  AnalyticsConfig,
  AnalyticsState,
  AnalyticsBatchResult
} from './types';

import { EventEmitter } from './core/EventEmitter';
import { Logger } from './core/Logger';
import { ShowcaseManager } from './managers/ShowcaseManager';
import { AvatarManager } from './managers/AvatarManager';
import { HotspotManager } from './managers/HotspotManager';
import { InteractionManager } from './managers/InteractionManager';
import { ShareManager } from './managers/ShareManager';
import { I18nManager } from './managers/I18nManager';
import { TourManager } from './managers/TourManager';
import { AnalyticsManager } from './managers/AnalyticsManager';
import { generateSessionId, getPerformanceLevel } from './utils/helpers';

export class MetaverseSDK {
  private config: SDKConfig;
  private sessionId: string;
  private state: SDKState;
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private showcaseManager: ShowcaseManager;
  private avatarManager: AvatarManager;
  private hotspotManager: HotspotManager;
  private interactionManager: InteractionManager;
  private shareManager: ShareManager;
  private i18nManager: I18nManager;
  private tourManager: TourManager;
  private analyticsManager: AnalyticsManager;
  private initialized: boolean = false;
  private destroyed: boolean = false;

  constructor(config: SDKConfig) {
    this.config = config;
    this.sessionId = generateSessionId();

    this.logger = new Logger('MetaverseSDK', config.debug || false);
    this.eventEmitter = new EventEmitter(this.sessionId, config.userId);

    this.state = {
      initialized: false,
      sceneLoaded: false,
      avatarReady: false,
      isPlaying: false,
      isPaused: false,
      performanceLevel: config.performanceLevel || (getPerformanceLevel() as PerformanceLevel),
      currentTheme: config.theme || SceneTheme.MINIMAL,
      currentLanguage: config.language || Language.ZH_CN,
      effectsEnabled: config.enableEffects !== false,
      audioEnabled: config.enableAudio !== false
    };

    this.showcaseManager = new ShowcaseManager(
      config.containerId,
      this.eventEmitter,
      this.logger,
      this.state.currentTheme,
      this.state.performanceLevel,
      this.state.effectsEnabled
    );
    this.i18nManager = new I18nManager(
      this.state.currentLanguage,
      this.eventEmitter,
      this.logger
    );
    this.interactionManager = new InteractionManager(this.eventEmitter, this.logger);
    this.avatarManager = new AvatarManager(
      this.eventEmitter,
      this.logger,
      this.i18nManager,
      this.showcaseManager,
      this.state.audioEnabled
    );
    this.hotspotManager = new HotspotManager(
      this.eventEmitter,
      this.logger,
      this.i18nManager,
      this.showcaseManager,
      this.interactionManager
    );
    this.tourManager = new TourManager(
      this.eventEmitter,
      this.logger,
      this.showcaseManager,
      this.avatarManager,
      this.hotspotManager,
      this.interactionManager
    );
    this.shareManager = new ShareManager(
      this.eventEmitter,
      this.logger,
      this.i18nManager,
      this.showcaseManager,
      this.avatarManager,
      this.hotspotManager,
      this.tourManager
    );
    this.analyticsManager = new AnalyticsManager(
      this.config.analytics || { enabled: false },
      this.eventEmitter,
      this.logger
    );

    this.setupInteractionListeners();

    this.logger.log('MetaverseSDK: Instance created');
  }

  async init(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('MetaverseSDK: Already initialized');
      return;
    }

    if (this.destroyed) {
      throw new Error('MetaverseSDK instance has been destroyed');
    }

    this.logger.log('MetaverseSDK: Initializing...');

    try {
      await this.showcaseManager.load();
      this.state.sceneLoaded = true;

      if (this.config.autoPlay) {
        this.interactionManager.startVisit(this.config.userId);
        this.state.isPlaying = true;
      }

      const activeSessionId = this.interactionManager.getActiveSessionId();
      if (activeSessionId) {
        this.analyticsManager.setSession(activeSessionId, this.config.userId);
      }
      if (this.config.analytics?.enabled) {
        this.analyticsManager.startAutoTracking();
        void this.analyticsManager.flushOfflineEvents();
      }

      this.initialized = true;
      this.state.initialized = true;

      this.logger.log('MetaverseSDK: Initialized successfully');
    } catch (error) {
      this.logger.error('MetaverseSDK: Initialization failed', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getState(): SDKState {
    return { ...this.state };
  }

  getSessionId(): string {
    return this.sessionId;
  }

  on(event: InteractionEventType, callback: EventCallback): void {
    this.eventEmitter.on(event, callback);
  }

  off(event: InteractionEventType, callback: EventCallback): void {
    this.eventEmitter.off(event, callback);
  }

  once(event: InteractionEventType, callback: EventCallback): void {
    this.eventEmitter.once(event, callback);
  }

  setTheme(theme: SceneTheme, customTheme?: CustomThemeConfig): void {
    this.ensureInitialized();
    this.showcaseManager.setTheme(theme, customTheme);
    this.state.currentTheme = theme;
  }

  getTheme(): SceneTheme {
    return this.state.currentTheme;
  }

  async loadProduct(product: Product): Promise<void> {
    this.ensureInitialized();
    await this.showcaseManager.loadProduct(product);
    if (!this.interactionManager.getActiveSessionId()) {
      this.interactionManager.startVisit(this.config.userId);
    }
    this.interactionManager.recordProductView(product.id);
  }

  async loadProducts(products: Product[]): Promise<void> {
    this.ensureInitialized();
    await this.showcaseManager.loadProducts(products);
    if (!this.interactionManager.getActiveSessionId()) {
      this.interactionManager.startVisit(this.config.userId);
    }
    products.forEach((p) => this.interactionManager.recordProductView(p.id));
  }

  getProduct(productId: string): Product | undefined {
    return this.showcaseManager.getProduct(productId);
  }

  getAllProducts(): Product[] {
    return this.showcaseManager.getAllProducts();
  }

  removeProduct(productId: string): boolean {
    this.ensureInitialized();
    return this.showcaseManager.removeProduct(productId);
  }

  setProductDescription(description: ProductDescription): void {
    this.hotspotManager.setProductDescription(description);
  }

  getProductDescription(productId: string): ProductDescription | undefined {
    return this.hotspotManager.getProductDescription(productId);
  }

  setLightPreset(preset: LightPreset): void {
    this.ensureInitialized();
    this.showcaseManager.setLightPreset(preset);
  }

  setLightConfig(config: LightConfig): void {
    this.ensureInitialized();
    this.showcaseManager.setLightConfig(config);
  }

  getLightConfig(): LightConfig {
    return this.showcaseManager.getLightConfig();
  }

  setCameraConfig(config: CameraConfig): void {
    this.ensureInitialized();
    this.showcaseManager.setCameraConfig(config);
  }

  getCameraConfig(): CameraConfig {
    return this.showcaseManager.getCameraConfig();
  }

  setCameraPosition(position: Vector3): void {
    this.ensureInitialized();
    this.showcaseManager.setCameraPosition(position);
  }

  setCameraTarget(target: Vector3): void {
    this.ensureInitialized();
    this.showcaseManager.setCameraTarget(target);
  }

  setAutoRotate(enabled: boolean, speed?: number): void {
    this.ensureInitialized();
    this.showcaseManager.setAutoRotate(enabled, speed);
  }

  async createAvatar(config: AvatarConfig) {
    this.ensureInitialized();
    const avatar = await this.avatarManager.createAvatar(config);
    if (!this.state.avatarReady) {
      this.state.avatarReady = true;
    }
    return avatar;
  }

  setActiveAvatar(avatarId: string): boolean {
    return this.avatarManager.setActiveAvatar(avatarId);
  }

  getActiveAvatar() {
    return this.avatarManager.getActiveAvatar();
  }

  playAnimation(animation: AnimationConfig, avatarId?: string): Promise<void> {
    this.ensureInitialized();
    return this.avatarManager.playAnimation(animation, avatarId);
  }

  playGesture(gesture: AvatarGesture, avatarId?: string): Promise<void> {
    this.ensureInitialized();
    return this.avatarManager.playGesture(gesture, avatarId);
  }

  stopAnimation(avatarId?: string): void {
    this.avatarManager.stopAnimation(avatarId);
  }

  async greet(avatarId?: string): Promise<void> {
    this.ensureInitialized();
    await this.avatarManager.greet(avatarId);
  }

  async introduceProduct(productName: string, avatarId?: string): Promise<void> {
    this.ensureInitialized();
    await this.avatarManager.introduceProduct(productName, avatarId);
  }

  async speak(config: VoicePlaybackConfig, avatarId?: string): Promise<void> {
    this.ensureInitialized();
    await this.avatarManager.speak(config, avatarId);
  }

  stopSpeaking(avatarId?: string): void {
    this.avatarManager.stopSpeaking(avatarId);
  }

  addHotspot(config: HotspotConfig): Hotspot {
    this.ensureInitialized();
    return this.hotspotManager.addHotspot(config);
  }

  addHotspots(configs: HotspotConfig[]): Hotspot[] {
    this.ensureInitialized();
    return this.hotspotManager.addHotspots(configs);
  }

  getHotspot(hotspotId: string): Hotspot | undefined {
    return this.hotspotManager.getHotspot(hotspotId);
  }

  getHotspotsByType(type: HotspotType): Hotspot[] {
    return this.hotspotManager.getHotspotsByType(type);
  }

  getAllHotspots(): Hotspot[] {
    return this.hotspotManager.getAllHotspots();
  }

  removeHotspot(hotspotId: string): boolean {
    this.ensureInitialized();
    return this.hotspotManager.removeHotspot(hotspotId);
  }

  clickHotspot(hotspotId: string): void {
    this.ensureInitialized();
    this.hotspotManager.clickHotspot(hotspotId);
    this.interactionManager.recordHotspotClick(hotspotId);
  }

  setHotspotVisible(hotspotId: string, visible: boolean): boolean {
    return this.hotspotManager.setHotspotVisible(hotspotId, visible);
  }

  addCoupon(coupon: Coupon): void {
    this.hotspotManager.addCoupon(coupon);
  }

  addCoupons(coupons: Coupon[]): void {
    this.hotspotManager.addCoupons(coupons);
  }

  getCoupon(couponId: string): Coupon | undefined {
    return this.hotspotManager.getCoupon(couponId);
  }

  getAvailableCoupons(): Coupon[] {
    return this.hotspotManager.getAvailableCoupons();
  }

  claimCoupon(couponId: string): Coupon | null {
    this.ensureInitialized();
    const coupon = this.hotspotManager.claimCoupon(couponId);
    if (coupon) {
      this.interactionManager.recordCouponClaim(couponId);
    }
    return coupon;
  }

  openPurchaseEntry(productId?: string): void {
    this.ensureInitialized();
    this.hotspotManager.openPurchaseEntry(productId);
  }

  addGame(game: MiniGame): void {
    this.interactionManager.addGame(game);
  }

  addGames(games: MiniGame[]): void {
    this.interactionManager.addGames(games);
  }

  getGame(gameId: string): MiniGame | undefined {
    return this.interactionManager.getGame(gameId);
  }

  getAllGames(): MiniGame[] {
    return this.interactionManager.getAllGames();
  }

  async startGame(gameId: string): Promise<MiniGame | null> {
    this.ensureInitialized();
    return this.interactionManager.startGame(gameId);
  }

  completeGame(gameId: string) {
    this.ensureInitialized();
    return this.interactionManager.completeGame(gameId);
  }

  startVisit(userId?: string): VisitProgress {
    this.ensureInitialized();
    const progress = this.interactionManager.startVisit(userId || this.config.userId);
    this.state.isPlaying = true;
    this.state.isPaused = false;
    return progress;
  }

  endVisit(): VisitProgress | null {
    this.ensureInitialized();
    const progress = this.interactionManager.endVisit();
    this.state.isPlaying = false;
    return progress;
  }

  getVisitProgress(): VisitProgress | undefined {
    return this.interactionManager.getVisitProgress();
  }

  saveVisitProgress(): VisitProgress | null {
    this.ensureInitialized();
    return this.interactionManager.saveVisitProgress();
  }

  loadVisitProgress(sessionId: string): VisitProgress | null {
    return this.interactionManager.loadVisitProgress(sessionId);
  }

  getTotalVisitDuration(): number {
    return this.interactionManager.getTotalVisitDuration();
  }

  startAreaTracking(areaId: string): void {
    this.interactionManager.startAreaTracking(areaId);
  }

  stopAreaTracking(): void {
    this.interactionManager.stopAreaTracking();
  }

  submitFeedback(
    feedback: Omit<UserFeedback, 'sessionId' | 'timestamp'> & { sessionId?: string }
  ): UserFeedback {
    this.ensureInitialized();
    return this.interactionManager.submitFeedback(feedback);
  }

  getAverageRating(): number {
    return this.interactionManager.getAverageRating();
  }

  async takeScreenshot(config?: ScreenshotConfig): Promise<ScreenshotResult> {
    this.ensureInitialized();
    return this.shareManager.takeScreenshot(config);
  }

  async generatePoster(config?: SharePosterConfig): Promise<ScreenshotResult> {
    this.ensureInitialized();
    return this.shareManager.generatePoster(config);
  }

  async shareToPlatform(platform: string, data: ShareData): Promise<void> {
    this.ensureInitialized();
    return this.shareManager.shareToPlatform(platform, data);
  }

  downloadImage(dataUrl: string, filename?: string): void {
    this.shareManager.downloadImage(dataUrl, filename);
  }

  copyToClipboard(text: string): Promise<boolean> {
    return this.shareManager.copyToClipboard(text);
  }

  setLanguage(language: Language): void {
    this.i18nManager.setLanguage(language);
    this.state.currentLanguage = language;
  }

  getLanguage(): Language {
    return this.i18nManager.getLanguage();
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18nManager.t(key, params);
  }

  addTranslations(language: Language, translations: Record<string, string>): void {
    this.i18nManager.addTranslations(language, translations);
  }

  getSupportedLanguages(): Language[] {
    return this.i18nManager.getSupportedLanguages();
  }

  setPerformanceLevel(level: PerformanceLevel): void {
    this.ensureInitialized();
    this.state.performanceLevel = level;
    this.showcaseManager.setPerformanceLevel(level);
  }

  getPerformanceLevel(): PerformanceLevel {
    return this.state.performanceLevel;
  }

  setEffectsEnabled(enabled: boolean): void {
    this.ensureInitialized();
    this.state.effectsEnabled = enabled;
    this.showcaseManager.setEffectsEnabled(enabled);
  }

  areEffectsEnabled(): boolean {
    return this.showcaseManager.areEffectsEnabled();
  }

  setAudioEnabled(enabled: boolean): void {
    this.state.audioEnabled = enabled;
    this.avatarManager.setAudioEnabled(enabled);
  }

  isAudioEnabled(): boolean {
    return this.state.audioEnabled;
  }

  play(): void {
    this.ensureInitialized();
    this.showcaseManager.play();
    this.state.isPlaying = true;
    this.state.isPaused = false;
    if (!this.interactionManager.getActiveSessionId()) {
      this.interactionManager.startVisit(this.config.userId);
    }
  }

  pause(): void {
    this.ensureInitialized();
    this.showcaseManager.pause();
    this.state.isPaused = true;
  }

  reset(): void {
    this.ensureInitialized();
    this.showcaseManager.reset();
    this.hotspotManager.clearHotspots();
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.logger.log('MetaverseSDK: Reset');
  }

  destroy(): void {
    if (this.destroyed) {
      this.logger.warn('MetaverseSDK: Already destroyed');
      return;
    }

    this.logger.log('MetaverseSDK: Destroying...');

    try {
      this.interactionManager.endVisit();
    } catch (e) {
      // ignore
    }

    this.showcaseManager.destroy();
    this.avatarManager.destroy();
    this.hotspotManager.destroy();
    this.interactionManager.destroy();
    this.shareManager.destroy();
    this.i18nManager.destroy();
    this.tourManager.destroy();
    void this.analyticsManager.destroy();
    this.eventEmitter.destroy();

    this.initialized = false;
    this.destroyed = true;
    this.state.initialized = false;

    this.logger.log('MetaverseSDK: Destroyed');
  }

  private setupInteractionListeners(): void {
    this.eventEmitter.on(InteractionEventType.HOTSPOT_CLICK, (event) => {
      const hotspotId = event.data?.hotspotId as string;
      if (hotspotId) {
        if (!this.interactionManager.getActiveSessionId()) {
          this.interactionManager.startVisit(this.config.userId);
        }
        this.interactionManager.recordHotspotClick(hotspotId);
      }
    });

    this.eventEmitter.on(InteractionEventType.COUPON_CLAIM, (event) => {
      const couponId = event.data?.couponId as string;
      if (couponId) {
        if (!this.interactionManager.getActiveSessionId()) {
          this.interactionManager.startVisit(this.config.userId);
        }
        this.interactionManager.recordCouponClaim(couponId);
      }
    });

    this.eventEmitter.on(InteractionEventType.GAME_START, (event) => {
      const gameId = event.data?.gameId as string;
      if (gameId) {
        if (!this.interactionManager.getActiveSessionId()) {
          this.interactionManager.startVisit(this.config.userId);
        }
        const progress = this.interactionManager.getVisitProgress();
        if (progress && !progress.playedGames.includes(gameId)) {
          progress.playedGames.push(gameId);
        }
      }
    });
  }

  async loadTour(config: TourConfig): Promise<void> {
    this.ensureInitialized();
    await this.tourManager.loadTour(config);
  }

  async startTour(tourId?: string): Promise<void> {
    this.ensureInitialized();
    await this.tourManager.startTour(tourId);
  }

  pauseTour(): void {
    this.ensureInitialized();
    this.tourManager.pauseTour();
  }

  async resumeTour(): Promise<void> {
    this.ensureInitialized();
    await this.tourManager.resumeTour();
  }

  async nextTourStep(): Promise<void> {
    this.ensureInitialized();
    await this.tourManager.nextStep();
  }

  async goToTourStep(stepIndex: number): Promise<void> {
    this.ensureInitialized();
    await this.tourManager.goToStep(stepIndex);
  }

  completeTourStep(stepId?: string): void {
    this.ensureInitialized();
    this.tourManager.completeStep(stepId);
  }

  stopTour(): void {
    this.ensureInitialized();
    this.tourManager.stopTour();
  }

  resetTour(): void {
    this.ensureInitialized();
    this.tourManager.resetTour();
  }

  getTourState(): TourState | undefined {
    return this.tourManager.getTourState();
  }

  getCurrentTourStep(): TourStep | undefined {
    return this.tourManager.getCurrentStep();
  }

  getTourSteps(): TourStep[] {
    return this.tourManager.getTourSteps();
  }

  getTourStepProgress(stepId: string): TourStepProgress | undefined {
    return this.tourManager.getStepProgress(stepId);
  }

  exportVisitProgress(): string | null {
    this.ensureInitialized();
    return this.interactionManager.exportVisitProgress();
  }

  importVisitProgress(json: string): VisitProgress | null {
    const progress = this.interactionManager.importVisitProgress(json);
    if (progress) {
      if (progress.claimedCoupons && progress.claimedCoupons.length > 0) {
        this.hotspotManager.syncClaimedCoupons(progress.claimedCoupons);
      }
      if (progress.tourState) {
        const tourSteps = this.tourManager.getTourSteps();
        if (tourSteps.length > 0) {
          const tourConfig: TourConfig = {
            id: progress.tourState.tourId,
            name: progress.tourState.tourId,
            steps: tourSteps
          };
          this.tourManager.restoreTourState(progress.tourState, tourConfig);
        }
      }
      if (progress.sessionId) {
        this.analyticsManager.setSession(progress.sessionId, progress.userId);
      }
    }
    return progress;
  }

  trackEvent(eventType: string, properties?: Record<string, unknown>): void {
    this.analyticsManager.track(eventType, properties);
  }

  async flushAnalytics(): Promise<AnalyticsBatchResult> {
    this.ensureInitialized();
    return this.analyticsManager.flush();
  }

  async flushOfflineAnalytics(): Promise<AnalyticsBatchResult> {
    this.ensureInitialized();
    return this.analyticsManager.flushOfflineEvents();
  }

  getAnalyticsState(): AnalyticsState {
    return this.analyticsManager.getState();
  }

  clearOfflineAnalytics(): void {
    this.analyticsManager.clearOfflineEvents();
  }

  setAnalyticsSession(sessionId: string, userId?: string): void {
    this.analyticsManager.setSession(sessionId, userId);
  }

  configureAnalytics(_config: Partial<AnalyticsConfig>): void {
    this.logger.warn('configureAnalytics: config updates require SDK re-init for full effect');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('MetaverseSDK is not initialized. Call init() first.');
    }
    if (this.destroyed) {
      throw new Error('MetaverseSDK instance has been destroyed.');
    }
  }
}
