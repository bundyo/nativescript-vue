export const PAGE_REF = '__vuePageRef__'
import { ios } from 'tns-core-modules/application'

const cache = new Map()

export default {
  render(h) {
    return h(
      'NativePage',
      {
        attrs: this.$attrs,
        on: this.$listeners
      },
      this.$slots.default
    )
  },
  created() {
    if (this.$router) {
      this.$parent.$vnode.data.keepAlive = true
    }
  },
  mounted() {
    this.$el.nativeView[PAGE_REF] = this

    const frame = this._findParentFrame()

    if (frame) {
      frame.notifyPageMounted(this)
    }

    const handler = e => {
      if (e.isBackNavigation) {
        this.$el.nativeView.off('navigatedFrom', handler)

        if (!this.$router) {
          return this.$parent.$destroy()
        }

        if (ios) {
          this._findParentFrame().isGoingBack = undefined
          const history = this.$router.history

          history.index -= 1
          history.updateRoute(history.stack[history.index])
        }
      }

      this._rollCacheQueue(this.$parent)
    }
    this.$el.nativeView.on('navigatedFrom', handler)
  },
  methods: {
    _rollCacheQueue(instance) {
      if (!this.$router) {
        return
      }

      cache.set(this.$route.path, instance)

      if (cache.size > this.$router.cacheSize) {
        const entries = Array.from(cache.entries())

        instance = entries.shift()

        if (cache.delete(instance[0])) {
          instance[1].$vnode.data.keepAlive = false
          instance[1].$destroy()
        }
      }
    },

    _findParentFrame() {
      let frame = this.$parent

      while (frame && frame.$options.name !== 'Frame') {
        frame = frame.$parent
      }

      return frame
    }
  },
  deactivated() {
    const frame = this._findParentFrame()

    if (frame && this.$router) {
      frame.notifyPageLeaving(this.$router.history)

      if (this._watcher) {
        this._watcher.teardown()
      }

      let i = this._watchers.length

      while (i--) {
        this._watchers[i].teardown()
      }
    }
  }
}
