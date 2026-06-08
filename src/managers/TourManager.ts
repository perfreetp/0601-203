import {
  TourConfig,
  TourStep,
  TourState,
  TourStepProgress,
  InteractionEventType,
  AvatarGesture
} from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';
import { ShowcaseManager } from './ShowcaseManager';
import { AvatarManager } from './AvatarManager';
import { HotspotManager } from './HotspotManager';
import { InteractionManager } from './InteractionManager';

export class TourManager {
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private showcaseManager: ShowcaseManager;
  private avatarManager: AvatarManager;
  private hotspotManager: HotspotManager;
  private interactionManager: InteractionManager;

  private currentTour?: TourConfig;
  private tourState?: TourState;
  private autoAdvanceTimer?: ReturnType<typeof setTimeout>;
  private stepStartTime?: number;
  private pausedElapsed: number = 0;
  private pausedAt?: number;

  constructor(
    eventEmitter: EventEmitter,
    logger: Logger,
    showcaseManager: ShowcaseManager,
    avatarManager: AvatarManager,
    hotspotManager: HotspotManager,
    interactionManager: InteractionManager
  ) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.showcaseManager = showcaseManager;
    this.avatarManager = avatarManager;
    this.hotspotManager = hotspotManager;
    this.interactionManager = interactionManager;
  }

  async loadTour(config: TourConfig): Promise<void> {
    this.currentTour = config;
    this.tourState = {
      tourId: config.id,
      currentStepIndex: -1,
      isPlaying: false,
      isPaused: false,
      isCompleted: false,
      stepProgress: config.steps.map((step) => ({
        stepId: step.id,
        completed: false,
        duration: 0
      })),
      startTime: undefined,
      endTime: undefined
    };

    this.logger.log(`TourManager: Tour loaded - ${config.name} (${config.steps.length} steps)`);
  }

  async startTour(tourId?: string): Promise<void> {
    if (!this.currentTour || (tourId && this.currentTour.id !== tourId)) {
      throw new Error('Tour not loaded. Call loadTour() first.');
    }

    if (this.tourState?.isPlaying && !this.tourState.isPaused) {
      this.logger.warn('TourManager: Tour already playing');
      return;
    }

    if (this.tourState?.isCompleted && !this.currentTour.loop) {
      this.logger.warn('TourManager: Tour already completed');
      return;
    }

    this.tourState!.isPlaying = true;
    this.tourState!.isPaused = false;
    this.tourState!.startTime = this.tourState!.startTime || Date.now();
    this.tourState!.isCompleted = false;

    if (this.tourState!.currentStepIndex < 0) {
      this.tourState!.currentStepIndex = 0;
    }

    this.eventEmitter.emit(InteractionEventType.TOUR_START, {
      tourId: this.currentTour.id,
      tourName: this.currentTour.name,
      totalSteps: this.currentTour.steps.length
    });

    this.logger.log(`TourManager: Tour started - ${this.currentTour.name}`);
    await this.executeCurrentStep();
  }

  pauseTour(): void {
    if (!this.tourState?.isPlaying || this.tourState.isPaused) return;

    this.tourState.isPaused = true;
    this.tourState.isPlaying = false;
    this.pausedAt = Date.now();

    if (this.stepStartTime) {
      this.pausedElapsed = (this.pausedAt - this.stepStartTime);
    }

    this.clearAutoAdvanceTimer();

    this.eventEmitter.emit(InteractionEventType.TOUR_PAUSE, {
      tourId: this.tourState.tourId,
      currentStepIndex: this.tourState.currentStepIndex
    });

    this.logger.log('TourManager: Tour paused');
  }

  async resumeTour(): Promise<void> {
    if (!this.tourState?.isPaused) return;

    this.tourState.isPaused = false;
    this.tourState.isPlaying = true;

    if (this.pausedAt && this.stepStartTime) {
      this.stepStartTime = Date.now() - this.pausedElapsed;
    }
    this.pausedAt = undefined;
    this.pausedElapsed = 0;

    this.eventEmitter.emit(InteractionEventType.TOUR_RESUME, {
      tourId: this.tourState.tourId,
      currentStepIndex: this.tourState.currentStepIndex
    });

    this.logger.log('TourManager: Tour resumed');
    this.scheduleAutoAdvance();
  }

  async nextStep(): Promise<void> {
    if (!this.tourState || !this.currentTour) return;

    this.completeCurrentStep();

    if (this.tourState.currentStepIndex < this.currentTour.steps.length - 1) {
      this.tourState.currentStepIndex++;
      this.eventEmitter.emit(InteractionEventType.TOUR_STEP_CHANGE, {
        tourId: this.tourState.tourId,
        currentStepIndex: this.tourState.currentStepIndex,
        stepId: this.currentTour.steps[this.tourState.currentStepIndex].id
      });
      await this.executeCurrentStep();
    } else if (this.currentTour.loop) {
      this.tourState.currentStepIndex = 0;
      this.tourState.stepProgress.forEach((sp) => {
        sp.completed = false;
        sp.duration = 0;
        sp.startTime = undefined;
        sp.endTime = undefined;
        sp.completedAt = undefined;
      });
      this.eventEmitter.emit(InteractionEventType.TOUR_STEP_CHANGE, {
        tourId: this.tourState.tourId,
        currentStepIndex: 0,
        stepId: this.currentTour.steps[0].id
      });
      await this.executeCurrentStep();
    } else {
      this.tourState.isPlaying = false;
      this.tourState.isCompleted = true;
      this.tourState.endTime = Date.now();
      this.eventEmitter.emit(InteractionEventType.TOUR_COMPLETE, {
        tourId: this.tourState.tourId,
        totalSteps: this.currentTour.steps.length,
        duration: this.tourState.endTime - (this.tourState.startTime || Date.now())
      });
      this.logger.log('TourManager: Tour completed');
    }
  }

  async goToStep(stepIndex: number): Promise<void> {
    if (!this.tourState || !this.currentTour) return;
    if (stepIndex < 0 || stepIndex >= this.currentTour.steps.length) {
      this.logger.warn(`TourManager: Invalid step index ${stepIndex}`);
      return;
    }

    this.completeCurrentStep();
    this.tourState.currentStepIndex = stepIndex;
    this.tourState.isPlaying = true;
    this.tourState.isPaused = false;

    this.eventEmitter.emit(InteractionEventType.TOUR_STEP_CHANGE, {
      tourId: this.tourState.tourId,
      currentStepIndex: stepIndex,
      stepId: this.currentTour.steps[stepIndex].id
    });

    await this.executeCurrentStep();
  }

  completeStep(stepId?: string): void {
    if (!this.tourState || !this.currentTour) return;

    const targetIndex = stepId
      ? this.currentTour.steps.findIndex((s) => s.id === stepId)
      : this.tourState.currentStepIndex;

    if (targetIndex < 0) return;

    const stepProgress = this.tourState.stepProgress[targetIndex];
    if (stepProgress && !stepProgress.completed) {
      const now = Date.now();
      stepProgress.completed = true;
      stepProgress.endTime = now;
      stepProgress.completedAt = now;
      if (stepProgress.startTime) {
        stepProgress.duration = now - stepProgress.startTime;
      }

      this.eventEmitter.emit(InteractionEventType.TOUR_STEP_COMPLETE, {
        tourId: this.tourState.tourId,
        stepId: stepProgress.stepId,
        stepIndex: targetIndex,
        duration: stepProgress.duration
      });

      this.logger.log(`TourManager: Step completed - ${stepProgress.stepId}`);
      this.syncTourStateToProgress();
    }
  }

  getTourState(): TourState | undefined {
    return this.tourState
      ? {
          ...this.tourState,
          stepProgress: this.tourState.stepProgress.map((sp) => ({ ...sp }))
        }
      : undefined;
  }

  getCurrentStep(): TourStep | undefined {
    if (!this.currentTour || !this.tourState) return undefined;
    return this.currentTour.steps[this.tourState.currentStepIndex];
  }

  getTourSteps(): TourStep[] {
    return this.currentTour?.steps ? [...this.currentTour.steps] : [];
  }

  getStepProgress(stepId: string): TourStepProgress | undefined {
    return this.tourState?.stepProgress.find((sp) => sp.stepId === stepId)
      ? { ...this.tourState.stepProgress.find((sp) => sp.stepId === stepId)! }
      : undefined;
  }

  stopTour(): void {
    if (!this.tourState) return;
    this.completeCurrentStep();
    this.tourState.isPlaying = false;
    this.tourState.isPaused = false;
    this.clearAutoAdvanceTimer();
    this.clearHighlights();
    this.logger.log('TourManager: Tour stopped');
  }

  resetTour(): void {
    if (!this.currentTour) return;
    this.clearAutoAdvanceTimer();
    this.clearHighlights();
    this.tourState = {
      tourId: this.currentTour.id,
      currentStepIndex: -1,
      isPlaying: false,
      isPaused: false,
      isCompleted: false,
      stepProgress: this.currentTour.steps.map((step) => ({
        stepId: step.id,
        completed: false,
        duration: 0
      })),
      startTime: undefined,
      endTime: undefined
    };
    this.pausedElapsed = 0;
    this.pausedAt = undefined;
    this.stepStartTime = undefined;
    this.syncTourStateToProgress();
    this.logger.log('TourManager: Tour reset');
  }

  private async executeCurrentStep(): Promise<void> {
    if (!this.tourState || !this.currentTour) return;

    const step = this.currentTour.steps[this.tourState.currentStepIndex];
    const stepProgress = this.tourState.stepProgress[this.tourState.currentStepIndex];

    if (stepProgress) {
      stepProgress.startTime = Date.now();
    }
    this.stepStartTime = Date.now();
    this.pausedElapsed = 0;

    this.clearHighlights();

    if (step.focusPosition) {
      this.showcaseManager.setCameraTarget(step.focusPosition);
    }

    if (step.productId) {
      this.interactionManager.recordProductView(step.productId);
    }

    if (step.highlightHotspotIds && step.highlightHotspotIds.length > 0) {
      step.highlightHotspotIds.forEach((hid) => {
        const hotspot = this.hotspotManager.getHotspot(hid);
        if (hotspot) {
          this.highlightHotspot(hid);
        }
      });
    } else if (step.hotspotId) {
      this.highlightHotspot(step.hotspotId);
    }

    if (step.avatarGreeting || step.avatarSpeech) {
      try {
        const activeAvatar = this.avatarManager.getActiveAvatar();
        if (activeAvatar) {
          if (step.avatarGesture) {
            await this.avatarManager.playGesture(step.avatarGesture as AvatarGesture);
          }
          if (step.avatarSpeech) {
            await this.avatarManager.speak({ text: step.avatarSpeech });
          } else if (step.avatarGreeting) {
            await this.avatarManager.greet();
          }
        }
      } catch (err) {
        this.logger.warn('TourManager: Avatar action failed', err);
      }
    } else if (step.avatarGesture) {
      try {
        await this.avatarManager.playGesture(step.avatarGesture as AvatarGesture);
      } catch (err) {
        this.logger.warn('TourManager: Avatar gesture failed', err);
      }
    }

    this.eventEmitter.emit(InteractionEventType.TOUR_STEP_CHANGE, {
      tourId: this.tourState.tourId,
      currentStepIndex: this.tourState.currentStepIndex,
      stepId: step.id,
      stepTitle: step.title
    });

    this.scheduleAutoAdvance();
    this.syncTourStateToProgress();
    this.logger.log(`TourManager: Executing step ${this.tourState.currentStepIndex + 1} - ${step.title}`);
  }

  private completeCurrentStep(): void {
    if (!this.tourState || !this.currentTour) return;

    const stepProgress = this.tourState.stepProgress[this.tourState.currentStepIndex];
    if (stepProgress && !stepProgress.completed && stepProgress.startTime) {
      const now = Date.now();
      stepProgress.endTime = now;
      stepProgress.completedAt = now;
      stepProgress.duration = now - stepProgress.startTime;
      stepProgress.completed = true;

      this.eventEmitter.emit(InteractionEventType.TOUR_STEP_COMPLETE, {
        tourId: this.tourState.tourId,
        stepId: stepProgress.stepId,
        stepIndex: this.tourState.currentStepIndex,
        duration: stepProgress.duration
      });
    }

    this.clearAutoAdvanceTimer();
    this.syncTourStateToProgress();
  }

  private scheduleAutoAdvance(): void {
    this.clearAutoAdvanceTimer();

    if (!this.tourState || !this.currentTour) return;

    const step = this.currentTour.steps[this.tourState.currentStepIndex];
    if (step.autoAdvance) {
      const delay = step.autoAdvanceDelay || 5000;
      this.autoAdvanceTimer = setTimeout(async () => {
        if (this.tourState?.isPlaying && !this.tourState?.isPaused) {
          await this.nextStep();
        }
      }, delay);
    }
  }

  private clearAutoAdvanceTimer(): void {
    if (this.autoAdvanceTimer) {
      clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = undefined;
    }
  }

  private highlightHotspot(hotspotId: string): void {
    const hotspotEl = document.querySelector(`[data-hotspot-id="${hotspotId}"]`) as HTMLElement;
    if (hotspotEl) {
      hotspotEl.style.boxShadow = '0 0 0 4px rgba(255, 215, 0, 0.8), 0 0 30px rgba(255, 215, 0, 0.6)';
      hotspotEl.style.transform = 'translate(-50%, -50%) scale(1.25)';
      hotspotEl.style.zIndex = '100';
      hotspotEl.dataset.tourHighlighted = 'true';
    }
  }

  private clearHighlights(): void {
    const highlighted = document.querySelectorAll('[data-tour-highlighted="true"]');
    highlighted.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.boxShadow = '';
      htmlEl.style.transform = '';
      htmlEl.style.zIndex = '';
      delete htmlEl.dataset.tourHighlighted;
    });
  }

  private syncTourStateToProgress(): void {
    if (!this.tourState) return;
    const progress = this.interactionManager.getVisitProgress();
    if (progress) {
      progress.tourState = {
        ...this.tourState,
        stepProgress: this.tourState.stepProgress.map((sp) => ({ ...sp }))
      };
    }
  }

  restoreTourState(state: TourState, tour?: TourConfig): void {
    if (tour) {
      this.currentTour = tour;
    }
    this.tourState = {
      ...state,
      stepProgress: state.stepProgress.map((sp) => ({ ...sp }))
    };
    this.logger.log(`TourManager: Tour state restored - ${state.tourId}`);
  }

  destroy(): void {
    this.stopTour();
    this.currentTour = undefined;
    this.tourState = undefined;
    this.logger.log('TourManager: Destroyed');
  }
}
