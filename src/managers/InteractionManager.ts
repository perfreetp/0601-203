import {
  MiniGame,
  GameReward,
  VisitProgress,
  UserFeedback,
  VisitDurationRecord,
  Vector3,
  InteractionEventType,
  PlayedGameRecord,
  BenefitItem,
  BenefitType,
  Coupon
} from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';
import { generateId } from '../utils/helpers';

export class InteractionManager {
  private games: Map<string, MiniGame> = new Map();
  private visitProgress: Map<string, VisitProgress> = new Map();
  private activeSessionId?: string;
  private durationRecords: VisitDurationRecord[] = [];
  private areaStartTime: Map<string, number> = new Map();
  private currentArea?: string;
  private currentProductId?: string;
  private feedbacks: UserFeedback[] = [];
  private eventEmitter: EventEmitter;
  private logger: Logger;

  constructor(eventEmitter: EventEmitter, logger: Logger) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
  }

  startVisit(userId?: string): VisitProgress {
    const sessionId = generateId('sess');
    const now = Date.now();

    const progress: VisitProgress = {
      userId: userId || generateId('guest'),
      sessionId,
      startTime: now,
      duration: 0,
      viewedProducts: [],
      clickedHotspots: [],
      claimedCoupons: [],
      playedGames: [],
      playedGameRecords: [],
      benefits: [],
      completed: false
    };

    this.visitProgress.set(sessionId, progress);
    this.activeSessionId = sessionId;

    this.eventEmitter.emit(InteractionEventType.VISIT_START, {
      sessionId,
      userId: progress.userId,
      timestamp: now
    });

    this.logger.log(`InteractionManager: Visit started - session ${sessionId}`);
    return progress;
  }

  endVisit(sessionId?: string): VisitProgress | null {
    const targetSessionId = sessionId || this.activeSessionId;
    if (!targetSessionId) {
      this.logger.warn('InteractionManager: No active session to end');
      return null;
    }

    const progress = this.visitProgress.get(targetSessionId);
    if (!progress) {
      return null;
    }

    const now = Date.now();
    progress.endTime = now;
    progress.duration = now - progress.startTime;
    progress.completed = true;

    if (this.currentArea) {
      this.stopAreaTracking();
    }

    this.eventEmitter.emit(InteractionEventType.VISIT_END, {
      sessionId: targetSessionId,
      userId: progress.userId,
      duration: progress.duration,
      viewedProducts: progress.viewedProducts.length,
      clickedHotspots: progress.clickedHotspots.length,
      claimedCoupons: progress.claimedCoupons.length,
      playedGames: progress.playedGames.length
    });

    this.logger.log(
      `InteractionManager: Visit ended - session ${targetSessionId}, duration: ${progress.duration}ms`
    );

    return progress;
  }

  getVisitProgress(sessionId?: string): VisitProgress | undefined {
    const targetSessionId = sessionId || this.activeSessionId;
    return targetSessionId ? this.visitProgress.get(targetSessionId) : undefined;
  }

  getActiveSessionId(): string | undefined {
    return this.activeSessionId;
  }

  saveVisitProgress(): VisitProgress | null {
    const progress = this.getVisitProgress();
    if (!progress) {
      return null;
    }

    progress.duration = Date.now() - progress.startTime;
    const saved = { ...progress };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          `metaverse_progress_${progress.sessionId}`,
          JSON.stringify(saved)
        );
      }
    } catch (error) {
      this.logger.warn('InteractionManager: Failed to save progress to localStorage', error);
    }

    this.logger.log(`InteractionManager: Progress saved for session ${progress.sessionId}`);
    return saved;
  }

  loadVisitProgress(sessionId: string): VisitProgress | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(`metaverse_progress_${sessionId}`);
        if (stored) {
          const progress = JSON.parse(stored) as VisitProgress;
          this.visitProgress.set(sessionId, progress);
          this.activeSessionId = sessionId;
          this.logger.log(`InteractionManager: Progress loaded for session ${sessionId}`);
          return progress;
        }
      }
    } catch (error) {
      this.logger.warn('InteractionManager: Failed to load progress from localStorage', error);
    }
    return null;
  }

  exportVisitProgress(): string | null {
    const progress = this.getVisitProgress();
    if (!progress) {
      this.logger.warn('InteractionManager: No progress to export');
      return null;
    }
    try {
      const json = JSON.stringify(progress, null, 2);
      this.logger.log(`InteractionManager: Progress exported (${json.length} chars)`);
      return json;
    } catch (error) {
      this.logger.warn('InteractionManager: Failed to export progress', error);
      return null;
    }
  }

  importVisitProgress(json: string): VisitProgress | null {
    try {
      const progress = JSON.parse(json) as VisitProgress;
      if (!progress.sessionId || !progress.userId) {
        this.logger.warn('InteractionManager: Invalid progress data (missing sessionId/userId)');
        return null;
      }

      progress.viewedProducts = progress.viewedProducts || [];
      progress.clickedHotspots = progress.clickedHotspots || [];
      progress.claimedCoupons = progress.claimedCoupons || [];
      progress.playedGames = progress.playedGames || [];
      progress.playedGameRecords = progress.playedGameRecords || [];
      progress.benefits = progress.benefits || [];
      progress.duration = progress.duration || 0;
      progress.completed = progress.completed || false;

      this.visitProgress.set(progress.sessionId, progress);
      this.activeSessionId = progress.sessionId;

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(
            `metaverse_progress_${progress.sessionId}`,
            JSON.stringify(progress)
          );
        }
      } catch (e) {
        this.logger.warn('InteractionManager: Could not persist imported progress', e);
      }

      this.logger.log(`InteractionManager: Progress imported for session ${progress.sessionId}`);
      this.logger.log(`  - Viewed products: ${progress.viewedProducts.length}`);
      this.logger.log(`  - Clicked hotspots: ${progress.clickedHotspots.length}`);
      this.logger.log(`  - Claimed coupons: ${progress.claimedCoupons.length}`);
      this.logger.log(`  - Played games: ${progress.playedGames.length}`);
      if (progress.tourState) {
        this.logger.log(`  - Tour steps: ${progress.tourState.stepProgress.filter(s => s.completed).length}/${progress.tourState.stepProgress.length}`);
      }

      return progress;
    } catch (error) {
      this.logger.warn('InteractionManager: Failed to import progress', error);
      return null;
    }
  }

  recordProductView(productId: string): void {
    const progress = this.getVisitProgress();
    if (progress && !progress.viewedProducts.includes(productId)) {
      progress.viewedProducts.push(productId);
      this.logger.log(`InteractionManager: Product view recorded - ${productId}`);
    }
    this.currentProductId = productId;
  }

  recordHotspotClick(hotspotId: string): void {
    const progress = this.getVisitProgress();
    if (progress && !progress.clickedHotspots.includes(hotspotId)) {
      progress.clickedHotspots.push(hotspotId);
      this.logger.log(`InteractionManager: Hotspot click recorded - ${hotspotId}`);
    }
  }

  recordCouponClaim(couponId: string, coupon?: Coupon): void {
    const progress = this.getVisitProgress();
    if (!progress) return;

    if (!progress.claimedCoupons.includes(couponId)) {
      progress.claimedCoupons.push(couponId);
      this.logger.log(`InteractionManager: Coupon claim recorded - ${couponId}`);
    }

    const benefitExists = progress.benefits.some((b) => b.couponId === couponId);
    if (!benefitExists) {
      const benefit: BenefitItem = {
        id: generateId('ben'),
        type: BenefitType.COUPON,
        title: coupon?.title || `优惠券 ${couponId}`,
        description: coupon?.description,
        icon: '🎟️',
        couponId,
        acquiredAt: Date.now(),
        source: coupon?.source === 'game_reward' ? 'game_reward'
          : coupon?.source === 'tour_reward' ? 'tour_reward'
          : coupon?.source === 'temporary_reward' ? 'imported'
          : 'coupon_hotspot',
        expiryDate: coupon?.expiryDate,
        isValid: true,
        metadata: { discountType: coupon?.discountType, discountValue: coupon?.discountValue }
      };
      progress.benefits.push(benefit);

      this.eventEmitter.emit(InteractionEventType.BENEFIT_AWARDED, {
        benefitId: benefit.id,
        benefitType: benefit.type,
        couponId,
        source: benefit.source,
        actionCategory: 'benefit'
      });
    }
  }

  recordCurrentPosition(position: Vector3): void {
    const progress = this.getVisitProgress();
    if (progress) {
      progress.currentPosition = { ...position };
    }
  }

  startAreaTracking(areaId: string): void {
    if (this.currentArea && this.currentArea !== areaId) {
      this.stopAreaTracking();
    }
    this.currentArea = areaId;
    this.areaStartTime.set(areaId, Date.now());
    this.logger.log(`InteractionManager: Area tracking started - ${areaId}`);
  }

  stopAreaTracking(): void {
    if (!this.currentArea) return;

    const startTime = this.areaStartTime.get(this.currentArea);
    if (startTime) {
      const endTime = Date.now();
      const record: VisitDurationRecord = {
        sessionId: this.activeSessionId || generateId('sess'),
        startTime,
        endTime,
        duration: endTime - startTime,
        area: this.currentArea,
        productId: this.currentProductId
      };
      this.durationRecords.push(record);
      this.areaStartTime.delete(this.currentArea);
      this.logger.log(
        `InteractionManager: Area tracking stopped - ${this.currentArea}, duration: ${record.duration}ms`
      );
    }
    this.currentArea = undefined;
  }

  getDurationRecords(): VisitDurationRecord[] {
    return [...this.durationRecords];
  }

  getTotalVisitDuration(sessionId?: string): number {
    const progress = this.getVisitProgress(sessionId);
    if (!progress) return 0;
    return progress.endTime ? progress.duration : Date.now() - progress.startTime;
  }

  getAreaDuration(areaId: string): number {
    return this.durationRecords
      .filter((r) => r.area === areaId)
      .reduce((sum, r) => sum + r.duration, 0);
  }

  addGame(game: MiniGame): void {
    this.games.set(game.id, game);
    this.logger.log(`InteractionManager: Game added - ${game.id} (${game.name})`);
  }

  addGames(games: MiniGame[]): void {
    games.forEach((g) => this.addGame(g));
  }

  getGame(gameId: string): MiniGame | undefined {
    return this.games.get(gameId);
  }

  getAllGames(): MiniGame[] {
    return Array.from(this.games.values());
  }

  removeGame(gameId: string): boolean {
    return this.games.delete(gameId);
  }

  async startGame(gameId: string): Promise<MiniGame | null> {
    const game = this.games.get(gameId);
    if (!game) {
      this.logger.warn(`InteractionManager: Game ${gameId} not found`);
      return null;
    }

    const progress = this.getVisitProgress();
    if (progress) {
      if (!progress.playedGames.includes(gameId)) {
        progress.playedGames.push(gameId);
      }
      const existingRecord = progress.playedGameRecords.find((r) => r.gameId === gameId);
      if (!existingRecord) {
        const record: PlayedGameRecord = {
          gameId,
          startedAt: Date.now(),
          completed: false
        };
        progress.playedGameRecords.push(record);
      }
    }

    this.eventEmitter.emit(InteractionEventType.GAME_START, {
      gameId,
      gameName: game.name,
      gameType: game.type,
      actionCategory: 'game'
    });

    this.logger.log(`InteractionManager: Game started - ${gameId}`);
    return game;
  }

  completeGame(gameId: string, reward?: GameReward, matchedCouponId?: string): GameReward | null {
    const game = this.games.get(gameId);
    if (!game) {
      this.logger.warn(`InteractionManager: Game ${gameId} not found`);
      return null;
    }

    const finalReward = reward || this.selectGameReward(game);

    const progress = this.getVisitProgress();
    if (progress) {
      const record = progress.playedGameRecords.find((r) => r.gameId === gameId);
      if (record) {
        record.completed = true;
        record.completedAt = Date.now();
        record.reward = finalReward || undefined;
        record.matchedCouponId = matchedCouponId;
      }

      if (finalReward) {
        const benefitExists = progress.benefits.some(
          (b) => b.type === BenefitType.GAME_REWARD && b.reward?.id === finalReward.id
        );
        if (!benefitExists) {
          const benefit: BenefitItem = {
            id: generateId('ben'),
            type: BenefitType.GAME_REWARD,
            title: finalReward.name,
            icon: finalReward.type === 'coupon' ? '🎟️' : finalReward.type === 'points' ? '⭐' : finalReward.type === 'product' ? '🛍️' : '🏅',
            reward: finalReward,
            couponId: matchedCouponId,
            acquiredAt: Date.now(),
            source: 'game_reward',
            isValid: true,
            metadata: { gameId, gameName: game.name }
          };
          progress.benefits.push(benefit);

          this.eventEmitter.emit(InteractionEventType.BENEFIT_AWARDED, {
            benefitId: benefit.id,
            benefitType: benefit.type,
            gameId,
            rewardId: finalReward.id,
            matchedCouponId,
            source: 'game_reward',
            actionCategory: 'benefit'
          });
        }
      }
    }

    this.eventEmitter.emit(InteractionEventType.GAME_COMPLETE, {
      gameId,
      gameName: game.name,
      reward: finalReward,
      matchedCouponId,
      actionCategory: 'game'
    });

    this.logger.log(`InteractionManager: Game completed - ${gameId}, reward: ${finalReward?.name}`);
    return finalReward;
  }

  private selectGameReward(game: MiniGame): GameReward | null {
    if (!game.rewards || game.rewards.length === 0) {
      return null;
    }

    const totalProbability = game.rewards.reduce((sum, r) => sum + (r.probability || 1), 0);
    let random = Math.random() * totalProbability;

    for (const reward of game.rewards) {
      random -= reward.probability || 1;
      if (random <= 0) {
        return reward;
      }
    }

    return game.rewards[game.rewards.length - 1];
  }

  submitFeedback(feedback: Omit<UserFeedback, 'sessionId' | 'timestamp'> & { sessionId?: string }): UserFeedback {
    const submitted: UserFeedback = {
      ...feedback,
      sessionId: feedback.sessionId || this.activeSessionId || generateId('sess'),
      timestamp: Date.now()
    };

    this.feedbacks.push(submitted);

    this.eventEmitter.emit(InteractionEventType.FEEDBACK_SUBMIT, {
      rating: submitted.rating,
      category: submitted.category,
      hasComment: !!submitted.comment
    });

    this.logger.log(
      `InteractionManager: Feedback submitted - rating: ${submitted.rating}, session: ${submitted.sessionId}`
    );

    return submitted;
  }

  getFeedbacks(): UserFeedback[] {
    return [...this.feedbacks];
  }

  getAverageRating(): number {
    if (this.feedbacks.length === 0) return 0;
    const sum = this.feedbacks.reduce((s, f) => s + f.rating, 0);
    return sum / this.feedbacks.length;
  }

  addBenefit(benefit: Omit<BenefitItem, 'id' | 'acquiredAt'>): BenefitItem {
    const progress = this.getVisitProgress();
    const newBenefit: BenefitItem = {
      ...benefit,
      id: generateId('ben'),
      acquiredAt: Date.now()
    };
    if (progress) {
      progress.benefits.push(newBenefit);
    }
    this.eventEmitter.emit(InteractionEventType.BENEFIT_AWARDED, {
      benefitId: newBenefit.id,
      benefitType: newBenefit.type,
      source: newBenefit.source,
      actionCategory: 'benefit'
    });
    return newBenefit;
  }

  getAllBenefits(): BenefitItem[] {
    return this.getVisitProgress()?.benefits || [];
  }

  getBenefitsByType(type: BenefitType): BenefitItem[] {
    return this.getAllBenefits().filter((b) => b.type === type);
  }

  getPlayedGameRecords(): PlayedGameRecord[] {
    return this.getVisitProgress()?.playedGameRecords || [];
  }

  getPlayedGameRecord(gameId: string): PlayedGameRecord | undefined {
    return this.getPlayedGameRecords().find((r) => r.gameId === gameId);
  }

  selectCoupon(couponId: string | undefined): void {
    const progress = this.getVisitProgress();
    if (!progress) return;
    if (couponId === undefined) {
      delete progress.selectedCouponId;
      this.logger.log('InteractionManager: Coupon selection cleared');
    } else if (!progress.claimedCoupons.includes(couponId)) {
      this.logger.warn(`InteractionManager: Cannot select unclaimed coupon ${couponId}`);
      return;
    } else {
      progress.selectedCouponId = couponId;
      this.logger.log(`InteractionManager: Coupon selected - ${couponId}`);
    }
    this.eventEmitter.emit(InteractionEventType.COUPON_SELECTED, {
      couponId: progress.selectedCouponId,
      actionCategory: 'benefit'
    });
  }

  getSelectedCouponId(): string | undefined {
    return this.getVisitProgress()?.selectedCouponId;
  }

  onVisitDurationUpdate(callback: (duration: number) => void): () => void {
    const interval = setInterval(() => {
      const duration = this.getTotalVisitDuration();
      callback(duration);
    }, 1000);

    return () => clearInterval(interval);
  }

  destroy(): void {
    this.games.clear();
    this.visitProgress.clear();
    this.durationRecords = [];
    this.areaStartTime.clear();
    this.feedbacks = [];
    this.activeSessionId = undefined;
    this.currentArea = undefined;
    this.currentProductId = undefined;
    this.logger.log('InteractionManager: Destroyed');
  }
}
