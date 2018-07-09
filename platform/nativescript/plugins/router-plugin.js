import { before } from '../util/index'
import { Page } from 'tns-core-modules/ui/page'
import { android } from 'tns-core-modules/application'

const NativeScriptHistory = (function() {
  function NativeScriptHistory(router, history) {
    this.router = router
    this.history = history

    android.on('activityBackPressed', function(args) {
      args.cancel = true

      router.back()
    })
    ;['stack', 'index', 'current'].forEach(name => {
      Object.defineProperty(NativeScriptHistory.prototype, name, {
        get: () => {
          return this.history[name]
        },
        set: value => {
          this.history[name] = value
        }
      })
    })
  }

  NativeScriptHistory.prototype.push = function push(
    location,
    onComplete,
    onAbort
  ) {
    this.history.push.call(
      this.history,
      location,
      route => {
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  NativeScriptHistory.prototype.replace = function replace(
    location,
    onComplete,
    onAbort
  ) {
    this.history.replace.call(
      this.history,
      location,
      route => {
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  NativeScriptHistory.prototype.go = function go(n) {
    this.history.go.call(this.history, n)
  }

  NativeScriptHistory.prototype.getCurrentLocation = function getCurrentLocation() {
    return this.history.getCurrentLocation.call(this.history)
  }

  NativeScriptHistory.prototype.onReady = function onReady(...args) {
    this.history.onReady.call(this.history, ...args)
  }

  NativeScriptHistory.prototype.onError = function onError(...args) {
    this.history.onError.call(this.history, ...args)
  }

  NativeScriptHistory.prototype.listen = function listen(...args) {
    this.history.listen.call(this.history, ...args)
  }

  NativeScriptHistory.prototype.transitionTo = function transitionTo(...args) {
    this.history.transitionTo.call(this.history, ...args)
  }

  NativeScriptHistory.prototype.confirmTransition = function confirmTransition(
    ...args
  ) {
    this.history.confirmTransition.call(this.history, ...args)
  }

  NativeScriptHistory.prototype.updateRoute = function updateRoute(...args) {
    this.history.updateRoute.call(this.history, ...args)
  }

  NativeScriptHistory.prototype.updateRoute = function updateRoute(...args) {
    this.history.updateRoute.call(this.history, ...args)
  }

  NativeScriptHistory.prototype.ensureURL = function ensureURL(...args) {
    this.history.ensureURL.call(this.history, ...args)
  }

  return NativeScriptHistory
})()

export function patchDefaultRouter(router, Vue) {
  if (router.__patched_for_routing__) {
    return
  }

  router.__patched_for_routing__ = true

  router.history = new NativeScriptHistory(router, router.history)
}

export function patchRouter(router, Vue) {
  if (router.__patched_for_page_routing__) {
    return
  }
  router.__patched_for_page_routing__ = true

  // The problem: When using router.replace() to set the initial route
  // the history index stays -1, which then causes an issue when visiting a route,
  // going back, and then trying to visit again (the active route is not changed on nav back)
  // This fixes it, since it allows the router.go logic to run
  router.history.index = 0

  // initial navigation states
  router.isBackNavigation = false
  router.shouldNavigate = true
  router.pageStack = []
  router.pageTransition = null

  router.setPageTransition = (transition, duration, curve) => {
    if (typeof transition === 'string') {
      return (router.pageTransition = {
        name: transition,
        duration,
        curve
      })
    }

    router.pageTransition = transition
  }

  router._beginBackNavigation = (shouldNavigate = true) => {
    if (router.isBackNavigation) {
      throw new Error(
        'router._beginBackNavigation was called while already navigating back.'
      )
    }

    router.isBackNavigation = true
    router.shouldNavigate = shouldNavigate
  }

  router._finishBackNavigation = () => {
    if (!router.isBackNavigation) {
      throw new Error(
        'router._finishBackNavigation was called while there was no back navigation.'
      )
    }

    router.isBackNavigation = false
  }

  router.go = before(router.go, router, n => {
    if (n === -1 && !router.isBackNavigation) {
      router._beginBackNavigation()
    }
  })

  router.afterEach(() => {
    if (router.isBackNavigation) {
      if (router.shouldNavigate) {
        Vue.navigateBack()
      }
      router.pageStack.pop()
      const page = router.pageStack[router.pageStack.length - 1]

      const callback = ({ isBackNavigation }) => {
        if (isBackNavigation) {
          router._finishBackNavigation()
        }
        page.off(Page.navigatedToEvent, callback)
      }

      page.on(Page.navigatedToEvent, callback)

      return
    }

    const component = router.getMatchedComponents()[0]

    router.app
      .$navigateTo(component, {
        context: { router },
        transition: router.pageTransition
        // Todo: add transitionAndroid and transitionIOS
      })
      .then(page => {
        router.pageStack.push(page)

        page.on(Page.navigatedFromEvent, ({ isBackNavigation }) => {
          if (isBackNavigation && !router.isBackNavigation) {
            router._beginBackNavigation(false)
            router.back()
          }
        })
      })
  })
}

export default {
  install(Vue) {
    Vue.mixin({
      beforeCreate() {
        if (!this.$options.router) {
          // If there is no router, we don't care
          return
        }

        const router = this.$options.router
        const isPageRouting = router.options.pageRouting
        const self = this

        if (isPageRouting) {
          patchRouter(router, Vue)
        } else {
          patchDefaultRouter(router, Vue)

          return
        }

        // Overwrite the default $start function
        this.$start = () => {
          this.__is_root__ = true
          this.__started__ = true // skips the default start procedure
          this.$options.render = () => {} // removes warning for no render / template

          // Mount the root component
          const placeholder = Vue.$document.createComment('placeholder')
          self.$mount(placeholder)

          const initial = router.getMatchedComponents()[0]

          this.$navigateTo(
            initial,
            {
              context: { router },
              clearHistory: true
            },
            page => {
              router.pageStack.push(page)
            }
          )
        }
      }
    })
  }
}
