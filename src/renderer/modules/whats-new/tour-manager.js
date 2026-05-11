import { driver } from '../../../../node_modules/driver.js/dist/driver.js.mjs';

/**
 * Manages "What's New" guided tours using Driver.js.
 * Loads tour data, checks profile preferences, executes pre/post actions,
 * and drives the tour UI.
 */
/**
 * Unwrap IPC response objects that return { success, data/value }.
 */
function unwrap(result) {
  if (result && typeof result === 'object') {
    if ('data' in result) return result.data;
    if ('value' in result) return result.value;
  }
  return result;
}

export class TourManager {
  constructor(tourData) {
    this.tourData = tourData;
    this.helpers = {};
    this.activeDriver = null;
    this.currentSteps = null;
  }

  getTourForVersion(version) {
    if (!version) return null;

    const exactTour = this.tourData.tours[version];
    if (exactTour) return exactTour;

    const baseVersion = String(version).split('-')[0];
    if (baseVersion && baseVersion !== version) {
      return this.tourData.tours[baseVersion] || null;
    }

    return null;
  }

  async getAppVersion() {
    return unwrap(await window.secureElectronAPI.app.getVersion());
  }

  async shouldAutoTrigger() {
    // Suppress in E2E — the Driver.js overlay intercepts pointer events
    // and would block test interactions.
    if (window.electronTest?.isE2E) return false;

    const version = await this.getAppVersion();
    const tour = this.getTourForVersion(version);
    if (!tour) return false;

    const toursSeen = unwrap(await window.secureElectronAPI.profile.getPreference('tours_seen'));
    const seen = Array.isArray(toursSeen) ? toursSeen : [];
    return !seen.includes(version);
  }

  async markTourSeen(version) {
    const toursSeen = unwrap(await window.secureElectronAPI.profile.getPreference('tours_seen'));
    const seen = Array.isArray(toursSeen) ? toursSeen : [];
    if (!seen.includes(version)) {
      seen.push(version);
    }
    await window.secureElectronAPI.profile.setPreference('tours_seen', seen);
  }

  buildDriverSteps(steps) {
    return steps.map((step) => {
      const driverStep = {
        popover: {
          title: step.title,
          description: step.description,
          side: step.side || 'bottom',
          align: step.align || 'center',
        },
      };
      if (step.element) {
        driverStep.element = step.element;
      }
      return driverStep;
    });
  }

  shouldSkipStep(step) {
    if (!step.element) return false;
    if (!step.skipIfMissing) return false;
    const el = document.querySelector(step.element);
    if (!el) return true;
    return el.offsetParent === null && getComputedStyle(el).position !== 'fixed';
  }

  registerHelper(name, fn) {
    this.helpers[name] = fn;
  }

  async executeAction(action) {
    if (!action) return;

    switch (action.type) {
      case 'openModal': {
        const { safeShowModal } = await import('../ui/bootstrap-helpers.js');
        await safeShowModal(action.target, { module: 'whats-new', function: 'executeAction' });
        break;
      }
      case 'closeModal': {
        const { safeHideModal } = await import('../ui/bootstrap-helpers.js');
        await safeHideModal(action.target, { module: 'whats-new', function: 'executeAction' });
        break;
      }
      case 'click': {
        const el = document.querySelector(action.target);
        if (el) el.click();
        break;
      }
      case 'function': {
        const fn = this.helpers[action.name];
        if (fn) {
          await fn();
        } else {
          window.debugLog?.warn(`Tour helper function "${action.name}" not registered`, {
            module: 'whats-new',
            function: 'executeAction',
          });
        }
        break;
      }
      case 'hide': {
        const el = document.querySelector(action.target);
        if (el) el.style.display = 'none';
        break;
      }
      default:
        window.debugLog?.warn(`Unknown tour action type: ${action.type}`, {
          module: 'whats-new',
          function: 'executeAction',
        });
    }
  }

  waitForDomSettle() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 300));
    });
  }

  async cleanupFromStep(steps, currentIndex) {
    const step = steps[currentIndex];
    if (step && step.postAction) {
      await this.executeAction(step.postAction);
    }
  }

  getThemeClass() {
    const html = document.documentElement;
    const theme = html.getAttribute('data-bs-theme');
    return theme === 'dark' ? 'driver-popover-dark' : 'driver-popover-light';
  }

  async launchTour(version, { markSeen = true } = {}) {
    if (this.activeDriver) {
      const previousDriver = this.activeDriver;
      previousDriver.destroy();
      await this.waitForDomSettle();
      if (this.activeDriver === previousDriver) {
        this.activeDriver = null;
        this.currentSteps = null;
      }
    }

    const tour = this.getTourForVersion(version);
    if (!tour) {
      window.debugLog?.info(`No tour found for version ${version}`, {
        module: 'whats-new',
        function: 'launchTour',
      });
      return;
    }

    // Only pre-filter steps that have NO preAction — steps with preActions
    // may create/show their target elements, so defer skip checks to runtime.
    const activeSteps = tour.steps.filter(
      (step) => step.preAction || !this.shouldSkipStep(step),
    );
    if (activeSteps.length === 0) {
      window.debugLog?.info('All tour steps skipped (elements missing)', {
        module: 'whats-new',
        function: 'launchTour',
      });
      if (markSeen) await this.markTourSeen(version);
      return;
    }

    this.currentSteps = activeSteps;
    let currentStepIndex = 0;

    const driverSteps = this.buildDriverSteps(activeSteps);
    const themeClass = this.getThemeClass();

    const onComplete = async () => {
      if (markSeen) await this.markTourSeen(version);
      this.activeDriver = null;
      this.currentSteps = null;
    };

    /**
     * Transition to a step: run postAction on current, preAction on target,
     * then move Driver.js. This ensures async actions complete before
     * Driver.js positions the popover.
     *
     * Optimization: if the current step's postAction closes a modal and the
     * target step's preAction reopens the same modal, skip both to avoid
     * a visible close/reopen flicker.
     */
    const transitionTo = async (targetIndex) => {
      const currentStep = activeSteps[currentStepIndex];
      const targetStep = activeSteps[targetIndex];

      // Check if post/pre actions cancel out (e.g., close then reopen same modal)
      const postAction = currentStep?.postAction;
      const preAction = targetStep?.preAction;
      const actionsRedundant = postAction && preAction
        && postAction.type === 'closeModal' && preAction.type === 'openModal'
        && postAction.target === preAction.target;
      // Also check function-based: same named helper on consecutive steps
      const sameFunctionHelper = postAction && preAction
        && preAction.type === 'function' && currentStep?.preAction?.type === 'function'
        && preAction.name === currentStep.preAction.name;
      const skipBoth = actionsRedundant || sameFunctionHelper;

      // PostAction for current step (unless redundant with next preAction)
      if (currentStep && postAction && !skipBoth) {
        await this.executeAction(postAction);
        await this.waitForDomSettle();
      }

      // PreAction for target step (unless redundant with previous postAction)
      if (targetStep && preAction && !skipBoth) {
        await this.executeAction(preAction);
        await this.waitForDomSettle();
      }

      // Runtime skip check after preAction
      if (targetStep && this.shouldSkipStep(targetStep)) {
        window.debugLog?.info(`Skipping tour step "${targetStep.title}" — element not found`, {
          module: 'whats-new',
          function: 'launchTour',
        });
        if (targetStep.postAction) {
          await this.executeAction(targetStep.postAction);
          await this.waitForDomSettle();
        }
        // Skip forward or backward depending on direction
        const direction = targetIndex > currentStepIndex ? 1 : -1;
        const nextTarget = targetIndex + direction;
        if (nextTarget >= 0 && nextTarget < activeSteps.length) {
          await transitionTo(nextTarget);
        }
        return;
      }

      currentStepIndex = targetIndex;
      this.activeDriver.moveTo(targetIndex);
    };

    this.activeDriver = driver({
      showProgress: true,
      steps: driverSteps,
      popoverClass: `whats-new-popover ${themeClass}`,
      nextBtnText: 'Next',
      prevBtnText: 'Previous',
      doneBtnText: 'Done',
      // Intercept Next/Prev to run pre/post actions before Driver.js moves
      onNextClick: async () => {
        const nextIndex = currentStepIndex + 1;
        if (nextIndex < activeSteps.length) {
          await transitionTo(nextIndex);
        } else {
          // Last step — trigger destroy; cleanup happens in onDestroyStarted.
          if (this.activeDriver) this.activeDriver.destroy();
        }
      },
      onPrevClick: async () => {
        const prevIndex = currentStepIndex - 1;
        if (prevIndex >= 0) {
          await transitionTo(prevIndex);
        }
      },
      onDestroyStarted: async () => {
        // Driver.js calls this when destroy() begins (overlay click, Escape,
        // or our own programmatic destroy from the last step). The callback
        // prevents auto-teardown — we must call destroy() at the end to finalize
        // (remove overlay/popover). Re-entry is guarded so cleanup runs once.
        if (this._tourClosing) return;
        this._tourClosing = true;
        const driverRef = this.activeDriver;
        try {
          await this.cleanupFromStep(activeSteps, currentStepIndex);
          await onComplete();
          if (driverRef) driverRef.destroy();
        } finally {
          this._tourClosing = false;
        }
      },
    });

    // Run preAction for the first step BEFORE starting the tour
    const firstStep = activeSteps[0];
    if (firstStep && firstStep.preAction) {
      await this.executeAction(firstStep.preAction);
      await this.waitForDomSettle();
    }

    this.activeDriver.drive();
  }
}
