const net = require('net')
const util = require('util')
const events = require('events')
const MessageBuffer = require('./message_buffer')

function Gpsd (options) {
  options = options || {}
  this.port = options.port || 2947
  this.hostname = options.hostname || 'localhost'
  this.parse = options.parse !== undefined ? options.parse : true
  this.reconnectInterval = options.reconnectInterval || 0
  this.reconnectThreshold = options.reconnectThreshold || 0
  this.connected = false
  this.socket = new net.Socket()
  this.socket.setEncoding('ascii')
  this.lastReceived = null

  events.EventEmitter.call(this)
  const received = new MessageBuffer('\n')

  this.reconnect = () => {
    const now = new Date().getTime()
    if (!this.lastReceived) this.lastReceived = now
    const threshold = this.reconnectThreshold * 1000
    const diff = now - this.lastReceived
    if (diff > threshold) {
      this.emit('reconnecting')
      this.connected = false
      this.socket.destroy()
      this.connect()
    }
  }

  this.handleMessage = message => {
    message = message.replace(/\}\{/g, '}\n{')
    const info = message.split('\n')
    let data
    for (var index = 0; index < info.length; index++) {
      if (info[index]) {
        if (!this.parse) {
          this.emit('raw', info[index])
        } else {
          try {
            data = JSON.parse(info[index])
            this.emit(data.class, data)
          } catch (error) {
            this.emit('error', {
              message: 'Bad message format',
              cause: info[index],
              error: error
            })
            continue
          }
        }
      }
    }
  }

  this.initListeners = () => {
    this.socket.on('data', this.onData)
    this.socket.on('close', this.onClose)
    this.socket.on('timeout', this.onTimeout)
    this.socket.on('connect', this.onConnect)
    this.socket.on('error', this.onError)
  }

  this.onData = payload => {
    this.lastReceived = new Date().getTime()
    received.push(payload)
    while (!received.isFinished()) {
      this.handleMessage(received.handleData())
    }
  }

  this.onClose = err => {
    this.emit('disconnected', err)
    this.connected = false
  }

  this.onTimeout = () => {
    this.emit('timeout')
    this.connected = false
    this.socket.end()
  }

  this.onConnect = sock => {
    this.connected = true
    this.emit('connected', sock)
  }

  this.onError = err => {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') return
    this.emit('socket', err)
  }

  if (this.reconnectInterval > 0 && this.reconnectThreshold > 0) {
    setInterval(this.reconnect, this.reconnectInterval * 1000)
  }

  return this
}

util.inherits(Gpsd, events.EventEmitter)

Gpsd.prototype.connect = function (callback) {
  this.socket.removeAllListeners()
  this.initListeners()
  this.socket.connect(this.port, this.hostname)
  this.socket.setKeepAlive(true, 5000)
  if (callback !== undefined) {
    this.socket.once('connect', sock => {
      callback(sock)
    })
  }
}

Gpsd.prototype.disconnect = function (callback) {
  this.unwatch()
  this.socket.end()

  if (callback !== undefined) {
    this.socket.once('close', err => {
      callback(err)
    })
  }
}

Gpsd.prototype.isConnected = function () {
  return this.connected
}

Gpsd.prototype.watch = function (options) {
  var watch = { class: 'WATCH', json: true, nmea: false }
  if (options) watch = options
  this.socket.write('?WATCH=' + JSON.stringify(watch))
}

Gpsd.prototype.unwatch = function () {
  this.socket.write('?WATCH={"class": "WATCH", "json":true, "enable":false}\n')
}

Gpsd.prototype.version = function () {
  this.socket.write('?VERSION;\n')
}

Gpsd.prototype.devices = function () {
  this.socket.write('?DEVICES;\n')
}

Gpsd.prototype.device = function () {
  this.socket.write('?DEVICE;\n')
}

module.exports = Gpsd
