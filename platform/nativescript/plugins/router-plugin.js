import { isPlainObject } from 'shared/util'

const operations = ['push', 'replace', 'go']

let mode

export default (mode = {
  name: 'NativeScriptHistory',

  factory(ancestor) {
    return class NativeScriptHistory extends ancestor {
      constructor(router, base) {
        super(router, base)
        this.router = router
        this.operation = 'push'

        operations.forEach(name => {
          this[name] = (...args) => {
            if (args.length > 1) {
              ;({ args, entry: this.currentEntry } = this._extractEntry(args))
            }

            this.operation = name
            super[name](...args)
          }
        })
      }

      _extractEntry(args) {
        let entry

        for (let i = 1; i < args.length; i++) {
          if (isPlainObject(args[i])) {
            entry = args[i]
            delete args[i]
          }
        }

        args = args.filter(n => n)

        return { args, entry }
      }
    }
  }
})
