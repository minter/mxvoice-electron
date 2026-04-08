import { driver } from 'driver.js';

/**
 * Manages "What's New" guided tours using Driver.js.
 * Loads tour data, checks profile preferences, executes pre/post actions,
 * and drives the tour UI.
 */
export class TourManager {
  constructor(tourData) {
    this.tourData = tourData;
    this.helpers = {};
    this.activeDriver = null;
    this.currentSteps = null;
  }

  getTourForVersion(version) {
    return this.tourData.tours[version] || null;
  }

  async shouldAutoTrigger() {
    const version = await window.secureElectronAPI.app.getVersion();
    const tour = this.getTourForVersion(version);
    if (!tour) return false;

    const toursSeen = await window.secureElectronAPI.profile.getPreference('tours_seen');
    const seen = Array.isArray(toursSeen) ? toursSeen : [];
    return !seen.includes(version);
  }

  async markTourSeen(version) {
    const toursSeen = await window.secureElectronAPI.profile.getPreference('tours_seen');
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
    const tour = this.getTourForVersion(version);
    if (!tour) {
      window.debugLog?.info(`No tour found for version ${version}`, {
        module: 'whats-new',
        function: 'launchTour',
      });
      return;
    }

    const activeSteps = tour.steps.filter((step) => !this.shouldSkipStep(step));
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

    this.activeDriver = driver({
      showProgress: true,
      steps: driverSteps,
      popoverClass: `whats-new-popover ${themeClass}`,
      nextBtnText: 'Next',
      prevBtnText: 'Previous',
      doneBtnText: 'Done',
      onHighlightStarted: async (_el, step, opts) => {
        currentStepIndex = opts.index;
        const tourStep = activeSteps[opts.index];
        if (tourStep && tourStep.preAction) {
          await this.executeAction(tourStep.preAction);
          await this.waitForDomSettle();
        }
      },
      onDeselected: async (_el, step, opts) => {
        const tourStep = activeSteps[opts.index];
        if (tourStep && tourStep.postAction) {
          await this.executeAction(tourStep.postAction);
          await this.waitForDomSettle();
        }
      },
      onDestroyStarted: async () => {
        await this.cleanupFromStep(activeSteps, currentStepIndex);
        await onComplete();
      },
    });

    this.activeDriver.drive();
  }
}
