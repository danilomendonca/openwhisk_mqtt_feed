'use strict';

const EventEmitter = require('events')

class MQTTSubscriptionMgr extends EventEmitter {
  constructor (mqtt) {
    super()
    this.connections = new Map()
    this.mqtt = mqtt
  }

  conn_client (url) {
    if (!this.connections.has(url)) {
      this.setup_client(url)
    }

    return this.connections.get(url)
  }

  setup_client (url) {
    const client = this.mqtt.connect(url)

    this.connections.set(url, {
      client: client,
      topics: new Map()
    })

    const events = ['connect', 'reconnect', 'close', 'offline']

    events.forEach(event => {
      client.on(event, () => {
        console.log(`Connection (${url}) status event: ${event}`)
        if (event === 'connect') this.emit('connected', url)
        if (event === 'offline') this.emit('disconnected', url)
      })
    })

    client.on('error', error => console.error('Connection error (${url}):', error))

    client.on('message', (topic, message) => {
      this.emit('message', url, topic, message.toString())
    })
  }

  remove_client (url) {
    if (this.connections.has(url)) {
      this.connections.get(url).client.end()
      this.connections.delete(url)
    }
  }

  is_connected (url) {
    if (!this.connections.has(url)) {
      return false
    }

    return this.connections.get(url).client.connected
  }

  subscribe (url, topic) {
    const topic_client = this.conn_client(url)
    const listener_count = (topic_client.topics.get(topic) || 0)

    if (!listener_count) {
      topic_client.client.subscribe(topic, (err, topics) => this.on_subscribe(err, topics, url))
    }

    topic_client.topics.set(topic, listener_count + 1)
  }

  unsubscribe (url, topic) {
    const topic_client = this.conn_client(url)
    const listener_count = (topic_client.topics.get(topic) || 0)

    if (listener_count === 1) {
      topic_client.client.unsubscribe(topic)
      topic_client.topics.delete(topic)
    }

    if (!topic_client.topics.size) {
      this.remove_client(url)
    }
  }

  on_subscribe (err, topics, url) {
    if (err) {
      return console.error(err)
    }
    topics.forEach(topic => console.log(`Subscribed to ${url}#${topic.topic}`))
  }
}

module.exports = MQTTSubscriptionMgr
