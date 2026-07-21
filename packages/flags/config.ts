export const features = {
  "login": true,
  "registering": true,
  "team-joining": {
    start: "2026-07-19T18:00:00+07:00",
    end: "2026-07-21T23:59:59+07:00",
  },
  "group-choosing": {
    start: "2026-07-19T18:00:00+07:00",
    end: "2026-07-21T23:59:59+07:00",
  },
  "group-announcement": {
    scheduled: "2026-07-23T18:00:00+07:00",
  },
  "game-playing": {
    start: "2026-07-25T00:00:00+07:00",
    end: "2026-07-27T23:59:59+07:00",
  },
  "game-allow-non-freshmen": true
} satisfies Record<string, EventAvailability>;

/**
 * Represents a date-time string in ISO 8601 format with Thailand timezone (+07:00).
 * Example: "2025-07-19T12:00:00+07:00"
 */
export type FestivalDateTime = `${string}-${string}-${string}T${string}:${string}:${string}+07:00`;

/**
 * Represents an event/activity that runs during a specific time window.
 * Both registration periods and activity sessions use this pattern.
 */
export type EventTimeWindow = {
  /**
   * When the event/activity opens or becomes available.
   * Example: "2025-07-19T12:00:00+07:00"
   */
  start: FestivalDateTime;
  /**
   * When the event/activity closes or ends.
   * Example: "2025-07-21T23:59:59+07:00"
   */
  end: FestivalDateTime;
}

/**
 * Represents an event/activity that is scheduled for the future.
 * Used for announcements, planned activities, or upcoming features.
 */
export type ScheduledEvent = {
  /**
   * The scheduled date and time when the event will occur.
   * Example: "2025-07-22T12:00:00+07:00"
   */
  scheduled: FestivalDateTime;
}

/**
 * Represents an event/activity with a deadline.
 * Used for submissions, registrations, or time-sensitive actions.
 */
export type EventWithDeadline = {
  /**
   * The deadline until which the event/activity remains available.
   * Example: "2025-07-21T23:59:59+07:00"
   */
  deadline: FestivalDateTime;
}

/**
 * Represents an event/activity that is always available or permanently disabled.
 * Used for features that don't depend on time constraints.
 */
export type AlwaysAvailable = boolean;

/**
 * Custom switch type for event availability.
 */
export type CustomSwitch = {
  isEnabled: () => boolean;
}

/**
 * Union type representing all possible states of a festival event or activity.
 */
export type EventAvailability = EventTimeWindow | ScheduledEvent | AlwaysAvailable | EventWithDeadline | CustomSwitch;
