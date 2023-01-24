import session from 'express-session'
import { AllSessionsResult, MongoSessionCleanupStrategy, MongoStoreBase, MongoStoreParams } from './MongoStoreBase'
import Timeout = NodeJS.Timeout

const debug = require('debug')('mongo-express-session')

// This had to be done because of the dynamic
// inheritance from session.Store
// I prefer to not include express-session as a
// dependency of this package, so I have to
// do this hack to tell typescript the proper typings
interface IMongoStore {
  new (config: MongoStoreParams)
  get: (sid: string, callback: (err: any, session?: session.SessionData | null) => void) => void
  set: (sid: string, session: session.SessionData, callback?: (err?: any) => void) => void
  destroy: (sid: string, callback?: (err?: any) => void) => void
  all: (callback: (err: any, obj?: { [sid: string]: session.SessionData } | null) => void) => void
  length: (callback: (err: any, length?: number | null) => void) => void
  clear: (callback?: (err?: any) => void) => void
  touch: (sid: string, session: session.SessionData, callback?: (err?: any) => void) => void
}

export default function mongoStoreFactory(session): IMongoStore {
  const Store = session.Store

  // Doesn't like the new (config: MongoStoreParams) interface
  // @ts-ignore
  class MongoStore extends Store implements IMongoStore {
    mongoStore: MongoStoreBase
    cleanupTimer: Timeout | number

    constructor(config: MongoStoreParams) {
      super(config)

      this.mongoStore = new MongoStoreBase(config)
      if (config.cleanupStrategy === MongoSessionCleanupStrategy.interval) {
        debug('Using interval cleanup strategy')

        this.cleanupTimer = setInterval(async () => {
          try {
            await this.mongoStore.removeExpiredSessions()
          } catch (e) {
            // ignore
          }
          // 5 mins
        }, config.cleanupInterval || 300000)
      }
    }

    get(sid: string, callback: (err: any, session?: session.SessionData | null) => void) {
      this.mongoStore
        .get(sid)
        .then((data) => {
          callback(null, data)
        })
        .catch(callback)
    }

    set(sid: string, session: session.SessionData, callback?: (err?: any) => void) {
      this.mongoStore.set(sid, session).then(callback).catch(callback)
    }

    destroy(sid: string, callback?: (err?: any) => void) {
      this.mongoStore.destroy(sid).then(callback).catch(callback)
    }

    // @ts-ignore
    all(callback: (err: any, obj?: AllSessionsResult) => void) {
      this.mongoStore
        .all()
        .then((data) => {
          callback(null, data)
        })
        .catch(callback)
    }

    length(callback: (err: any, length?: number | null) => void) {
      this.mongoStore
        .length()
        .then((length) => {
          callback(null, length)
        })
        .catch(callback)
    }

    clear(callback?: (err?: any) => void) {
      this.mongoStore.clear().then(callback).catch(callback)
    }

    touch(sid: string, session: session.SessionData, callback?: (err?: any) => void) {
      this.mongoStore.touch(sid, session).then(callback).catch(callback)
    }
  }

  // @ts-ignore
  return MongoStore
}
