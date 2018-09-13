import { setFrame, getFrame, deleteFrame } from '../../util/frame'
import { extend } from 'shared/util'
import { ios } from 'tns-core-modules/application'

let idCounter = 1

const propMap = {
  transition: 'transition',
  'ios:transition': 'transitioniOS',
  'android:transition': 'transitionAndroid'
}

export default {
  props: {
    id: {
      default: 'default'
    },
    transition: {
      type: [String, Object],
      default: _ => ({ name: 'slide', duration: 200 })
    },
    'ios:transition': {
      type: [String, Object],
      default: ''
    },
    'android:transition': {
      type: [String, Object],
      default: ''
    },
    // injected by the template compiler
    hasRouterView: {
      default: false
    }
  },
  data() {
    return {
      properties: {}
    }
  },
  created() {
    let properties = {}

    if (getFrame(this.$props.id)) {
      properties.id = this.$props.id + idCounter++
    }

    this.properties = Object.assign({}, this.$attrs, this.$props, properties)

    setFrame(this.properties.id, this)
  },
  destroyed() {
    deleteFrame(this.properties.id)
  },
  render(h) {
    return h(
      'NativeFrame',
      {
        attrs: this.properties,
        on: this.$listeners
      },
      this.$slots.default
    )
  },
  computed: {
    store() {
      return this.$router && this.$router.history.store || {}
    },

    operation() {
      return this.store.operation || 'navigate'
    },

    isGoingBack() {
      return this.store && this.store.isGoingBack ? ios ? undefined : true : false
    }
  },
  methods: {
    _getFrame() {
      return this.$el.nativeView
    },

    _composeTransition() {
      const result = {}
      const root = this.store.entry || this

      for (const prop in propMap) {
        if (root[prop]) {
          const name = propMap[prop]
          result[name] = {}

          if (typeof root[prop] === 'string') {
            result[name].name = root[prop]
          } else {
            extend(result[name], root[prop])
          }
        }
      }

      return result
    },

    notifyPageMounted(pageVm) {
      this.$nextTick(_ =>
        this[this.operation]({
          create: () => pageVm.$el.nativeView
        })
      )
    },

    navigate(entry, back = this.isGoingBack) {
      const frame = this._getFrame()

      if (back || (ios && this.isGoingBack === undefined)) {
        frame.goBack(this.isGoingBack ? undefined : entry)
        return
      }

      entry.clearHistory && this.$emit('beforeReplace', entry)
      !entry.clearHistory && this.$emit('beforePush', entry)

      // resolve the page from the entry and attach a navigatedTo listener
      // to fire the frame events
      const page = entry.create()

      page.once('navigatedTo', () => {
        this.$emit('navigated', entry)
        entry.clearHistory && this.$emit('replace', entry)
        !entry.clearHistory && this.$emit('push', entry)
      })

      page.on('navigatedFrom', args => {
        if (args.isBackNavigation) {
          page.off('navigatedFrom')

          const router = this.$router
          const history = router.history

          if (router && ios) {
            history.index -= 1
            history.updateRoute(history.stack[history.index])
          }

          this.$emit('back', entry)
        }
      })

      entry.create = () => page

      const transition = this._composeTransition()

      Object.assign(entry, transition, entry)

      frame.navigate(entry)
    },

    back(backstackEntry = null) {
      this.navigate(backstackEntry, true)
    },

    push(entry) {
      this.navigate(entry)
    },

    replace(entry) {
      entry.clearHistory = true

      this.navigate(entry)
    },

    go(entry) {
      this.navigate(entry)
    }
  }
}
