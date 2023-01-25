# mongo-express-session

[![npm version](https://badge.fury.io/js/mongo-express-session.svg)](https://badge.fury.io/js/mongo-express-session) ![built with typescript](https://camo.githubusercontent.com/92e9f7b1209bab9e3e9cd8cdf62f072a624da461/68747470733a2f2f666c61742e62616467656e2e6e65742f62616467652f4275696c74253230576974682f547970655363726970742f626c7565) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![CircleCI](https://circleci.com/gh/theogravity/mongo-express-session/tree/master.svg?style=svg)](https://circleci.com/gh/theogravity/mongo-express-session/tree/master)

A session store for `express-session` using mongoDB.

- Does not have the `mongodb` client as a dependency. Use your own `mongodb` client, meaning you can
configure your client to however you need it to work with this store.
- Can auto-expire using mongo indexes or with an interval.
- Fully unit tested. PRs welcomed.

<!-- TOC -->

- [Install](#install)
- [Usage](#usage)
- [`MongoStore` options](#mongostore-options)
- [Debugging](#debugging)

<!-- TOC END -->

## Install

`$ npm i mongo-express-session --save`

## Usage

```typescript
import { MongoClient } from 'mongodb'
import * as express from 'express'
import * as session from 'express-session'
import { mongoStoreFactory } from 'mongo-express-session'

const MongoStore = mongoStoreFactory(session)
const app = express()

// Create and connect your mongo client
const client = await MongoClient.connect(...)

app.use(session({
    store: new MongoStore({
      client,
      dbName: 'my-database',
      collection: 'sessions',
      ttlMs: 10000,
    }),
    //... don't forget other expres-session options you might need
}))
```

## `MongoStore` options

```typescript
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
```

```typescript
enum MongoSessionCleanupStrategy {
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
```

# Debugging

This module uses `debug` under the name `mongo-express-session`. When starting up your app, do the following:

`$ DEBUG=mongo-express-session node app.js`
