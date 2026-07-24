import { type EventAvailability, dailyLeaderboardCutoffs, features } from './config';

interface FeatureFlagsOptions {
  enabledAll?: boolean
  overrides?: Record<string, EventAvailability>
}

export class FeatureFlags {
  enabledAll?: boolean;
  overrides?: Record<keyof typeof features, EventAvailability>;
  #features: Record<string, EventAvailability> = features;

  constructor(options: FeatureFlagsOptions) {
    this.enabledAll = options.enabledAll ?? false;
    this.overrides = options.overrides ?? {};
    this.#features = { ...features, ...this.overrides };
  }

  isEnabled(feature: keyof typeof features): boolean {
    if (this.enabledAll) {
      return true; // If all features are enabled, return true
    }
    const featureStatus: EventAvailability | undefined = this.#features[feature];

    if (!featureStatus) {
      return false; // Feature not found
    }

    const now = new Date();

    if (typeof featureStatus === 'boolean') {
      return featureStatus; // Feature is simply enabled or disabled
    }

    if ('start' in featureStatus && 'end' in featureStatus) {
      const start = new Date(featureStatus.start);
      const end = new Date(featureStatus.end);
      return now >= start && now <= end; // Check if current time is within the start and end times
    }

    if ('scheduled' in featureStatus) {
      const scheduled = new Date(featureStatus.scheduled);
      return now >= scheduled; // Enabled from the scheduled time onward, no end
    }

    if ('isEnabled' in featureStatus) {
      return featureStatus.isEnabled();
    }

    return false;
  }

  /** True once a feature's window/deadline has closed (vs. not yet enabled, which isPast doesn't distinguish). */
  isPast(feature: keyof typeof features): boolean {
    if (this.enabledAll) {
      return false; // dev bypass: never treat a feature as closed
    }
    const featureStatus: EventAvailability | undefined = this.#features[feature];

    if (!featureStatus || typeof featureStatus === 'boolean') {
      return false;
    }

    const now = new Date();

    if ('end' in featureStatus) {
      return now > new Date(featureStatus.end);
    }

    if ('deadline' in featureStatus) {
      return now > new Date(featureStatus.deadline);
    }

    return false;
  }

  /** Cutoffs whose reveal moment has passed - staff can see these days' top-10 now. */
  getRevealedDailyLeaderboards(): { date: string; cutoffAt: string }[] {
    if (this.enabledAll) {
      return dailyLeaderboardCutoffs; // dev/staging bypass, same convention as isEnabled
    }
    const now = new Date();
    return dailyLeaderboardCutoffs.filter((c) => now >= new Date(c.cutoffAt));
  }
}
