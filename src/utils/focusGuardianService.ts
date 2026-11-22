import { audioEngine } from './audioEngine';

/**
 * Focus Guardian Service
 *
 * Implements browser visibility monitoring, rate-limited focus reminder notifications,
 * distraction event logging, and motivational reinforcement for study sessions.
 *
 * Technical Note:
 * On the web platform, Focus Guardian uses the W3C Page Visibility API (`document.visibilityState`).
 * While modern browser security sandboxes strictly prevent web apps from accessing
 * the operating system's native process tree to identify specific external applications,
 * the Page Visibility API reliably detects whenever the user leaves the study tab,
 * minimizes the browser, or switches away to another application.
 */

const NOTIFICATION_COOLDOWN_MS = 25000; // 25 seconds cooldown

export const GUARDIAN_MOTIVATIONAL_MESSAGES = [
  "You've got this! Return to your studies and complete your session.",
  "Deep focus builds top ranks. Resist the urge to check other apps!",
  "Distraction is temporary, regret is permanent. Return to your target now!",
  "You are stronger than your impulse. Lock back into your study zone!",
  "Every uninterrupted minute sharpens your memory retention. Keep pushing!",
];

export const GUARDIAN_NOTIFICATION_BODY =
  "📚 You're studying right now! Stay focused on your studies. Avoid using other apps until your session ends.";

class FocusGuardianService {
  private lastNotificationTimestamp: number = 0;

  /**
   * Check if web notifications are supported in this browser
   */
  public isNotificationSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Get current browser notification permission status
   */
  public getPermissionStatus(): 'default' | 'granted' | 'denied' | 'unsupported' {
    if (!this.isNotificationSupported()) return 'unsupported';
    try {
      return Notification.permission;
    } catch {
      return 'unsupported';
    }
  }

  /**
   * Request notification permission from the student
   */
  public async requestPermission(): Promise<'default' | 'granted' | 'denied' | 'unsupported'> {
    if (!this.isNotificationSupported()) return 'unsupported';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('Focus Guardian notification request failed:', e);
      return 'unsupported';
    }
  }

  /**
   * Send the rate-limited Focus Guardian reminder notification
   */
  public triggerFocusReminderNotification(subjectName?: string): boolean {
    const now = Date.now();
    const elapsed = now - this.lastNotificationTimestamp;

    // Play distraction alert sound
    audioEngine.playDistractionWarning();

    // Rate-limit notifications to prevent spam
    if (elapsed < NOTIFICATION_COOLDOWN_MS) {
      console.log(`Focus Guardian: Notification cooldown active (${Math.round((NOTIFICATION_COOLDOWN_MS - elapsed) / 1000)}s remaining)`);
      return false;
    }

    this.lastNotificationTimestamp = now;

    // Check if system notifications are available
    if (this.isNotificationSupported() && Notification.permission === 'granted') {
      try {
        const title = subjectName
          ? `Focus Guardian: ${subjectName} Study Session Active!`
          : "Focus Guardian: Active Study Session Alert!";

        const notification = new Notification(title, {
          body: GUARDIAN_NOTIFICATION_BODY,
          tag: 'focus-guardian-reminder', // Replaces previous notification if still open
          silent: false,
        });

        // Clicking notification brings student back to the window
        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Auto-close after 8 seconds
        setTimeout(() => {
          try {
            notification.close();
          } catch {
            // ignore
          }
        }, 8000);

        return true;
      } catch (err) {
        console.warn('Focus Guardian: Notification display error', err);
      }
    }

    return false;
  }

  /**
   * Get a random motivational punchline
   */
  public getRandomMotivationalMessage(): string {
    const idx = Math.floor(Math.random() * GUARDIAN_MOTIVATIONAL_MESSAGES.length);
    return GUARDIAN_MOTIVATIONAL_MESSAGES[idx];
  }

  /**
   * Get the primary motivational message specified by the prompt
   */
  public getPrimaryMotivationalMessage(): string {
    return GUARDIAN_MOTIVATIONAL_MESSAGES[0];
  }
}

export const focusGuardian = new FocusGuardianService();
