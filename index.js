const net = require('net')
const util = require('util')
const events = require('events')
const MessageBuffer = require('./message_buffer')

function Gpsd (options) {
  options = options || {}
  this.port = options.port || 2947
  this.hostname = options.hostname || 'localhost'
  this.autoReconnect = options.autoReconnect || 0
  this.parse = options.parse !== undefined ? options.parse : true
  this.connected = false
  this.socket = new net.Socket()
  this.socket.setEncoding('ascii')

  events.EventEmitter.call(this)

  const received = new MessageBuffer('\n')

  this.reconnect = () => {
    if (this.reconnectInterval) return
    this.reconnectInterval = setInterval(() => {
      this.emit('reconnecting')
      this.socket.connect(this.port, this.hostname)
    }, this.autoReconnect * 1000)
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

  this.socket.on('data', payload => {
    received.push(payload)
    while (!received.isFinished()) {
      this.handleMessage(received.handleData())
    }
  })

  this.socket.on('close', err => {
    this.connected = false
    if (this.autoReconnect > 0) {
      this.reconnect()
    } else {
      this.emit('disconnected', err)
    }
  })

  this.socket.on('connect', sock => {
    this.connected = true
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval)
      this.reconnectInterval = undefined
    }
    this.emit('connected', sock)
  })

  this.socket.on('error', err => {
    if (err.code === 'ECONNREFUSED') {
      this.emit('error.connection')
    } else {
      this.emit('error.socket', err)
    }
  })

  return (this)
}

util.inherits(Gpsd, events.EventEmitter)

Gpsd.prototype.connect = function (callback) {
  this.socket.connect(this.port, this.hostname)

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
