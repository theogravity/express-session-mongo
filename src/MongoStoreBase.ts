import session from 'express-session'
import { Collection, MongoClient } from 'mongodb'
import { millisecondsToSeconds } from 'date-fns'

const debug = require('debug')('mongo-express-session')

export enum MongoSessionCleanupStrategy {
  /**
   * Use the mongo index TTL to clean out expired entries. Once this is set, you will have to
   * manually remove the 'updated_at_ttl_idx' index from your collection if you want to use the
   * interval strategy.
   */
  native = 'native',
  /**
   * Use a timer to periodically clean out expired entries.
   */
  interval = 'interval',
}

export interface MongoStoreParams {
  /**
   * The mongo client
   */
  client: MongoClient

  /**
   * Name of the database to use
   */
  dbName: string

  /**
   * Name of the collection to use for session data
   */
  collection: string

  /**
   * Strategy ('native' or 'interval') to use to clean up expired entries.
   * Default is 'native'. Native will create an index with a TTL to expire objects.
   */
  cleanupStrategy?: MongoSessionCleanupStrategy

  /**
   * Session TTL in milliseconds
   */
  ttlMs: number

  /**
   * Session id prefix. Default is no prefix
   */
  prefix?: string

  /**
   * Only applies if cleanup strategy is 'interval'. Triggers a timer in milliseconds to run a
   * cleanup on expired session rows. Default is 5 minutes.
   */
  cleanupInterval?: number
}

export type AllSessionsResult = session.SessionData[] | { [sid: string]: session.SessionData } | null

export interface SessionData {
  sessionId: string
  data: string
  /**
   * Expires timestamp in milliseconds since epoch
   */
  expiresMs: number
  updatedAt: Date
}

export class MongoStoreBase {
  hasInit: boolean
  config: MongoStoreParams
  client: MongoClient
  collection: Collection<SessionData>
  prefix: string

  constructor(config: MongoStoreParams) {
    this.hasInit = false
    this.config = config
    this.prefix = config.prefix || ''
    this.client = null
  }

  getSid(sid: string) {
    return this.prefix + sid
  }

  async init() {
    if (!this.client) {
      if (!this.config.client) {
        throw new Error('express-session-mongo: client not defined')
      }

      if (!this.config.dbName) {
        throw new Error('express-session-mongo: dbName not defined')
      }

      if (!this.config.collection) {
        throw new Error('express-session-mongo: collection not defined')
      }

      debug('Creating indexes for the session collection')

      this.client = this.config.client
      this.collection = this.client.db(this.config.dbName).collection<SessionData>(this.config.collection)

      await this.collection.createIndex(
        {
          sessionId: 1,
        },
        {
          unique: true,
          name: 'session_id_idx',
        },
      )

      await this.collection.createIndex(
        {
          expiresMs: 1,
          sessionId: 1,
        },
        {
          name: 'session_id_expires_idx',
        },
      )

      if (!this.config.cleanupStrategy || this.config.cleanupStrategy === MongoSessionCleanupStrategy.native) {
        debug('Using native cleanup strategy')

        await this.collection.createIndex(
          {
            updatedAt: 1,
          },
          {
            name: 'updated_at_ttl_idx',
            expireAfterSeconds: millisecondsToSeconds(this.config.ttlMs),
          },
        )
      }

      this.hasInit = true
    }
  }

  async get(sid: string): Promise<session.SessionData | null> {
    const formattedSid = this.getSid(sid)

    debug(`Getting session: ${formattedSid}`)

    await this.init()
    const time = new Date().getTime()

    const resp = await this.collection.findOne({
      expiresMs: {
        $gt: time,
      },
      sessionId: formattedSid,
    })

    if (!resp) {
      return null
    }

    debug(`Session found: ${formattedSid}`)

    return resp.data
  }

  async set(sid: string, session: session.SessionData): Promise<void> {
    await this.init()
    const formattedSid = this.getSid(sid)

    const msTtl = new Date().getTime() + this.config.ttlMs

    debug(`Setting session: ${formattedSid}`)

    await this.collection.updateOne(
      {
        sessionId: formattedSid,
      },
      {
        $set: {
          sessionId: formattedSid,
          data: session,
          expiresMs: msTtl,
          updatedAt: new Date(),
        },
      },
      {
        upsert: true,
      },
    )
  }

  async destroy(sid: string): Promise<void> {
    await this.init()
    const formattedSid = this.getSid(sid)

    debug(`Destroying session: ${formattedSid}`)

    await this.collection.deleteOne({
      sessionId: formattedSid,
    })
  }

  async all(): Promise<AllSessionsResult> {
    await this.init()

    const time = new Date().getTime()

    debug(`Fetching all sessions`)

    const results = await this.collection
      .find({
        expiresMs: {
          $gt: time,
        },
      })
      .toArray()

    return results.map((result) => result.data)
  }

  async length(): Promise<number | null> {
    await this.init()

    const time = new Date().getTime()

    debug(`Getting session counts`)

    return this.collection.countDocuments({
      expiresMs: {
        $gt: time,
      },
    })
  }

  async clear(): Promise<void> {
    await this.init()

    debug(`Clearing all sessions`)

    await this.collection.deleteMany({})
  }

  async touch(sid: string, session: session.SessionData): Promise<void> {
    const formattedSid = this.getSid(sid)

    debug(`Refreshing session: ${formattedSid}`)

    await this.init()
    await this.set(sid, session)

    debug(`Refresh session complete: ${formattedSid}`)
  }

  /**
   * Have to manually call this to remove stale entries
   */
  async removeExpiredSessions() {
    await this.init()
    const time = new Date().getTime()

    debug(`Removing expired sessions`)

    await this.collection.deleteMany({
      expiresMs: {
        $lt: time,
      },
    })
  }
}
